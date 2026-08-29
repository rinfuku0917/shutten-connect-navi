import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 出店料の入金まわり。invoices は RLS でクライアントから読めないため、
// 出店者・管理者どちらの操作もここを通す。
//
//   action='mine'    … 出店者が自分の請求書一覧を見る
//   action='report'  … 出店者が「振り込みました」と報告する → 運営へメール
//   action='list'    … 管理者が入金状況の一覧を見る
//   action='confirm' … 管理者が入金を確認する → 出店者へメール
//
// 呼び出し元はログイン中のアクセストークンで判定する（本人以外は触れない）。

const ADMIN_EMAIL = 'info@connect-navi.com'
const FROM_EMAIL = 'noreply@mail.connect-navi.com'

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
        .select('id, invoice_no, period, issued_on, due_on, total, paid_status, paid_on, paid_reported_at, paid_confirmed_at')
        .eq('seller_id', uid)
        .order('issued_on', { ascending: false })
      if (error) return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
      return NextResponse.json({ items: data || [] })
    }

    // ===== 出店者：振込を報告する =====
    if (action === 'report') {
      const { invoiceId, paidOn, paidName } = body
      if (!invoiceId) return NextResponse.json({ error: '請求書が指定されていません' }, { status: 400 })

      const { data: inv, error: gErr } = await db
        .from('invoices').select('id, invoice_no, seller_id, period, total, paid_status').eq('id', invoiceId).maybeSingle()
      if (gErr || !inv) return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })
      // 本人の請求書だけ報告できる
      if (inv.seller_id !== uid) return NextResponse.json({ error: '権限がありません' }, { status: 403 })
      if (inv.paid_status === 'paid') return NextResponse.json({ error: 'この請求書はすでに入金確認済みです' }, { status: 409 })

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
      if (apiKey) {
        try {
          const shop = me?.shop_name || me?.name || '(出店者)'
          await new Resend(apiKey).emails.send({
            from: '出店コネクトナビ <' + FROM_EMAIL + '>',
            to: ADMIN_EMAIL,
            subject: `【入金報告】${shop} 様 / ${inv.invoice_no}`,
            text: [
              '出店者から出店料の振込報告がありました。通帳をご確認ください。',
              '',
              `出店者: ${shop}`,
              `請求書番号: ${inv.invoice_no}`,
              `対象月: ${inv.period}`,
              `請求額(税込): ${yen(inv.total)}`,
              `振込日: ${paidOn ? jpDate(paidOn) : '（未記入）'}`,
              `振込名義: ${paidName || '（未記入）'}`,
              '',
              '▼ 入金の確認はこちら（管理画面 → 売上管理 → 入金状況）',
              'https://app.connect-navi.com/admin',
            ].join('\n'),
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
        .select('id, invoice_no, seller_id, period, issued_on, due_on, total, paid_status, paid_on, paid_name, paid_reported_at, paid_confirmed_at, paid_memo')
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
        .from('invoices').select('id, invoice_no, seller_id, period, total, paid_status').eq('id', invoiceId).maybeSingle()
      if (gErr || !inv) return NextResponse.json({ error: '請求書が見つかりません' }, { status: 404 })

      // 取り消しは、間違えて確認済みにしたときに戻すためのもの
      const patch = undo
        ? { paid_status: 'unpaid', paid_confirmed_at: null }
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
            await new Resend(apiKey).emails.send({
              from: '出店コネクトナビ <' + FROM_EMAIL + '>',
              to: seller.email,
              subject: '【出店コネクトナビ】出店料のご入金を確認いたしました',
              text: [
                `${shop} 様`,
                '',
                'いつも出店コネクトナビをご利用いただきありがとうございます。',
                '下記の出店料について、ご入金を確認いたしました。',
                '',
                `請求書番号: ${inv.invoice_no}`,
                `対象月: ${inv.period}`,
                `ご入金額(税込): ${yen(inv.total)}`,
                '',
                'お忙しいなかご対応いただき、誠にありがとうございました。',
                '引き続きどうぞよろしくお願いいたします。',
                '',
                '出店コネクトナビ運営事務局',
                '株式会社nav',
              ].join('\n'),
            })
          }
        } catch (e) {
          console.error('入金確認の通知に失敗しました', e)
        }
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: '不明な操作です' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
