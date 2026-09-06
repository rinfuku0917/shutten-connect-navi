import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../lib/mailTemplates'

// 出店料の入金まわり。invoices は RLS でクライアントから読めないため、
// 出店者・管理者どちらの操作もここを通す。
//
//   action='mine'    … 出店者が自分の請求書一覧を見る
//   action='report'  … 出店者が「振り込みました」と報告する → 運営へメール
//   action='list'    … 管理者が入金状況の一覧を見る
//   action='confirm' … 管理者が入金を確認する → 出店者へメール
//   action='void'    … 管理者が請求書を取り消す（行は消さず、取り消した印を付ける）
//   action='unvoid'  … 管理者が取り消しを取りやめる
//
// 呼び出し元はログイン中のアクセストークンで判定する（本人以外は触れない）。

const ADMIN_EMAIL = 'info@connect-navi.com'
const FROM_EMAIL = 'noreply@mail.connect-navi.com'

// 同じ請求書の振込報告が短時間に繰り返されたとき、運営へ何通も飛ばさない。
// notify 系と同じ方式。サーバーが入れ替わると消えるため、DBの報告時刻でも見る。
const recentReports = new Map<string, number>()
const REPORT_MAIL_INTERVAL = 10 * 60 * 1000 // 10分

const yen = (n: number) => '¥' + Number(n || 0).toLocaleString()
const jpDate = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // 呼び出し元をアクセストークンで確かめる（bodyのIDは信用しない）
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

    const { data: me } = await db.from('profiles').select('role, name, shop_name, email').eq('id', uid).maybeSingle()
    const isAdmin = me?.role === 'admin'

    const body = await req.json()
    const action = body.action

    // ===== 出店者：自分の請求書一覧 =====
    if (action === 'mine') {
      const { data, error } = await db
        .from('invoices')
        .select('id, invoice_no, period, issued_on, due_on, total, paid_status, paid_on, paid_name, paid_reported_at, paid_confirmed_at')
        .eq('seller_id', uid)
        // 取り消した請求書は出店者には見せない
        .is('voided_at', null)
        .order('issued_on', { ascending: false })
      if (error) return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
      return NextResponse.json({ items: data || [] })
    }

    // ===== 出店者：振込を報告する =====
    if (action === 'report') {
      const { invoiceId, paidOn, paidName } = body
      if (!invoiceId) return NextResponse.json({ error: '請求書が指定されていません' }, { status: 400 })

      const { data: inv, error: gErr } = await db
        .from('invoices').select('id, invoice_no, seller_id, period, total, paid_status, paid_reported_at, voided_at').eq('id', invoiceId).maybeSingle()
      if (gErr || !inv) return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })
      // 本人の請求書だけ報告できる
      if (inv.seller_id !== uid) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      if (inv.paid_status === 'paid') return NextResponse.json({ error: 'この請求書はすでに入金確認済みです' }, { status: 409 })
      // 取り消した請求書は出店者の一覧に出ないが、画面を開いたまま
      // 取り消された場合にここへ来るため、念のため止める
      if (inv.voided_at) {
        return NextResponse.json({ error: 'この請求書は取り消されています。運営にご確認ください' }, { status: 409 })
      }

      // 直前に同じ報告が来ていたら、記録は更新するがメールは送らない
      const now = Date.now()
      const lastMem = recentReports.get(invoiceId) || 0
      const lastDb = inv.paid_reported_at ? new Date(inv.paid_reported_at).getTime() : 0
      const skipMail = (now - Math.max(lastMem, lastDb)) < REPORT_MAIL_INTERVAL
      recentReports.set(invoiceId, now)
      // 溜まり続けないように、古いものを捨てる
      if (recentReports.size > 500) {
        for (const [k, t] of recentReports) if (now - t > REPORT_MAIL_INTERVAL) recentReports.delete(k)
      }

      const { data: upd, error: uErr2 } = await db.from('invoices').update({
        paid_status: 'reported',
        paid_reported_at: new Date().toISOString(),
        paid_on: paidOn || null,
        paid_name: paidName ? String(paidName).trim().slice(0, 100) : null,
      }).eq('id', invoiceId).select('id')
      if (uErr2) return NextResponse.json({ error: '保存に失敗しました: ' + uErr2.message }, { status: 500 })
      if (!upd || upd.length === 0) return NextResponse.json({ error: '保存できませんでした' }, { status: 500 })

      // 運営へ知らせる（メールが送れなくても報告自体は成功とする）
      const apiKey = process.env.RESEND_API_KEY
      if (apiKey && !skipMail) {
        try {
          const shop = me?.shop_name || me?.name || '(出店者)'
          // 文面は管理画面（メール文面タブ）で書き換えられる
          const def = MAIL_DEF_BY_KEY['payment-reported']
          const mail = await renderMail(db, 'payment-reported', { subject: def.subject, body: def.body }, {
            '屋号': shop,
            '請求書番号': inv.invoice_no,
            '対象月': inv.period,
            '金額': yen(inv.total),
            '振込日': paidOn ? jpDate(paidOn) : '（未記入）',
            '振込名義': paidName || '（未記入）',
          })
          await new Resend(apiKey).emails.send({
            from: '出店コネクトナビ <' + FROM_EMAIL + '>',
            to: ADMIN_EMAIL,
            subject: mail.subject,
            text: mail.text,
          })
        } catch (e) {
          console.error('入金報告の通知に失敗しました', e)
        }
      }
      return NextResponse.json({ success: true })
    }

    // ===== ここから管理者のみ =====
    if (!isAdmin) return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })

    // ===== 管理者：入金状況の一覧 =====
    if (action === 'list') {
      const { data, error } = await db
        .from('invoices')
        .select('id, invoice_no, seller_id, period, issued_on, due_on, total, paid_status, paid_on, paid_name, paid_reported_at, paid_confirmed_at, paid_memo, kind, voided_at, void_reason')
        .order('issued_on', { ascending: false })
        .limit(300)
      if (error) return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })

      // 出店者名を付ける
      const ids = Array.from(new Set((data || []).map(x => x.seller_id).filter(Boolean)))
      const nameById = new Map<string, string>()
      if (ids.length > 0) {
        const { data: ps } = await db.from('profiles').select('id, name, shop_name').in('id', ids)
        for (const p of ps || []) nameById.set(p.id, p.shop_name || p.name || '(出店者)')
      }
      return NextResponse.json({
        items: (data || []).map(x => ({ ...x, sellerName: nameById.get(x.seller_id) || '(出店者)' })),
      })
    }

    // ===== 管理者：入金を確認する / 取り消す =====
    if (action === 'confirm') {
      const { invoiceId, memo, undo } = body
      if (!invoiceId) return NextResponse.json({ error: '請求書が指定されていません' }, { status: 400 })

      const { data: inv, error: gErr } = await db
        .from('invoices').select('id, invoice_no, seller_id, period, total, paid_status, paid_reported_at').eq('id', invoiceId).maybeSingle()
      if (gErr || !inv) return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })

      // 取り消しは、間違えて確認済みにしたときに戻すためのもの。
      // 出店者から振込の報告が来ていた場合は「確認中」に戻す。
      // 未入金に落としてしまうと、振込日や名義が画面から消えて督促してしまう。
      const patch = undo
        ? { paid_status: inv.paid_reported_at ? 'reported' : 'unpaid', paid_confirmed_at: null }
        : { paid_status: 'paid', paid_confirmed_at: new Date().toISOString() }
      if (typeof memo === 'string') (patch as Record<string, unknown>).paid_memo = memo.slice(0, 500)

      const { data: upd, error: uErr3 } = await db.from('invoices').update(patch).eq('id', invoiceId).select('id')
      if (uErr3) return NextResponse.json({ error: '更新に失敗しました: ' + uErr3.message }, { status: 500 })
      if (!upd || upd.length === 0) return NextResponse.json({ error: '更新できませんでした' }, { status: 500 })

      // 入金を確認したときだけ、出店者へお礼を送る
      const apiKey = process.env.RESEND_API_KEY
      if (!undo && apiKey && inv.paid_status !== 'paid') {
        try {
          const { data: seller } = await db.from('profiles').select('name, shop_name, email').eq('id', inv.seller_id).maybeSingle()
          if (seller?.email) {
            const shop = seller.shop_name || seller.name || '出店者'
            // 文面は管理画面（メール文面タブ）で書き換えられる
            const def = MAIL_DEF_BY_KEY['payment-confirmed']
            const mail = await renderMail(db, 'payment-confirmed', { subject: def.subject, body: def.body }, {
              '屋号': shop,
              '請求書番号': inv.invoice_no,
              '対象月': inv.period,
              '金額': yen(inv.total),
            })
            await new Resend(apiKey).emails.send({
              from: '出店コネクトナビ <' + FROM_EMAIL + '>',
              to: seller.email,
              subject: mail.subject,
              text: mail.text,
            })
          }
        } catch (e) {
          console.error('入金確認の通知に失敗しました', e)
        }
      }
      return NextResponse.json({ success: true })
    }

    // ===== 管理者：請求書を取り消す =====
    //
    // 金額を間違えた、テストで作った、条件が変わった——出したものを
    // 無かったことにしたい場面はある。ただし行は消さない。
    //
    // 番号は「その年でいちばん大きい番号 + 1」で採番しているため、
    // 消すと次の発行で同じ番号が使い回される。先方に送ったあとだと、
    // 同じ番号の請求書が2枚できてしまう。
    // 取り消した印だけを付けて、番号と記録は残す。
    //
    // 取り消すと、出店者の「お支払い」欄からは消え、入金の集計からも外れる。
    if (action === 'void') {
      const { invoiceId, reason } = body
      if (!invoiceId) return NextResponse.json({ error: '請求書が指定されていません' }, { status: 400 })
      const { data: inv } = await db
        .from('invoices').select('id, invoice_no, paid_status, voided_at').eq('id', invoiceId).maybeSingle()
      if (!inv) return NextResponse.json({ error: '対象が見つかりませんでした' }, { status: 404 })
      if (inv.voided_at) {
        return NextResponse.json({ error: 'この請求書は既に取り消されています' }, { status: 409 })
      }
      // 入金済みのものを黙って取り消すと、受け取った金額の説明がつかなくなる。
      // 先に入金確認を取り消してもらう
      if (inv.paid_status === 'paid') {
        return NextResponse.json(
          { error: '入金確認済みの請求書は取り消せません。先に「確認を取り消す」を押してください' },
          { status: 409 },
        )
      }
      const { error: vErr } = await db.from('invoices').update({
        voided_at: new Date().toISOString(),
        voided_by: uid,
        void_reason: typeof reason === 'string' && reason.trim() ? reason.trim() : null,
      }).eq('id', invoiceId)
      if (vErr) return NextResponse.json({ error: '取り消しに失敗しました: ' + vErr.message }, { status: 500 })
      return NextResponse.json({ success: true, invoiceNo: inv.invoice_no })
    }

    // ===== 管理者：取り消しを取りやめる =====
    // 押し間違いを戻せるようにする。番号は変わらない。
    if (action === 'unvoid') {
      const { invoiceId } = body
      if (!invoiceId) return NextResponse.json({ error: '請求書が指定されていません' }, { status: 400 })
      const { data: up, error: rErr } = await db.from('invoices').update({
        voided_at: null, voided_by: null, void_reason: null,
      }).eq('id', invoiceId).select('invoice_no')
      if (rErr) return NextResponse.json({ error: '戻せませんでした: ' + rErr.message }, { status: 500 })
      if (!up || up.length === 0) return NextResponse.json({ error: '対象が見つかりませんでした' }, { status: 404 })
      return NextResponse.json({ success: true, invoiceNo: up[0].invoice_no })
    }

    return NextResponse.json({ error: '不明な操作です' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
