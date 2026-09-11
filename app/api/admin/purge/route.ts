import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { writePurgeLog, purgeSummary } from '../../../lib/purgeLog'

// 取り消し済みの記録を、運営が完全に消す。
//
// 出店の取消しは、取り消したその場で行ごと消すようになった
// （app/api/applications/cancel-approved/route.ts）。
// それでもこの入口が残っているのは、次の2つのため。
//   ・方針を変える前に取り消した出店が、status='cancelled' で残っている
//   ・取り消しはできたが削除だけ失敗した出店が残る（応答の purged が false）
//
// 請求書の取消しは、これまでどおり voided_at を立てて行を残す。
// お金が動いた事実の証跡なので、消すかどうかは運営が1件ずつ決める。
//   ・出店 … status='cancelled' で、売上報告も有効な請求書も無いもの
//   ・請求書 … voided_at があり、入金確認済みでないもの
// どちらも「一度取り消してあるもの」だけに限っている。
//
// 消した内容は purge_log に残す。
// 出店ぶんは、案件名・出店日・出店者の屋号とID・取り消した理由。
// 行が無くなってもキャンセル料を請求できるようにするため（/cancel-policy）。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// 呼び出し元をアクセストークンで確かめる。body のIDは信用しない
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(req: Request, db: any): Promise<{ uid: string } | NextResponse> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: userData, error: uErr } = await db.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

  const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: '運営のみが操作できます' }, { status: 403 })

  return { uid }
}


export async function POST(req: Request) {
  try {
    const body = await req.json()
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const auth = await requireAdmin(req, db)
    if (auth instanceof NextResponse) return auth
    const uid = auth.uid

    // ===== 取り消し済みの出店を消す =====
    if (body.action === 'application') {
      const id = String(body.id ?? '').trim()
      if (!id) return NextResponse.json({ error: '対象が指定されていません' }, { status: 400 })

      const { data: app } = await db
        .from('applications')
        .select('id, seller_id, place_id, apply_date, status, cancel_reason, places(title), profiles!applications_seller_id_fkey(name, shop_name)')
        .eq('id', id).maybeSingle()
      if (!app) return NextResponse.json({ error: '出店が見つかりませんでした' }, { status: 404 })

      // 取り消してあるものだけ。生きている出店をここから消せてはいけない
      if (app.status !== 'cancelled') {
        return NextResponse.json(
          { error: 'まだ取り消されていません。先に「この出店を取り消す」で取り消してから、削除してください' },
          { status: 409 },
        )
      }

      // 売上報告が残っていると、消したときに金額だけが浮く
      // （sales.application_id は ON DELETE SET NULL）
      const { data: sales } = await db
        .from('sales').select('id, sale_date').eq('application_id', id)
      if (sales && sales.length > 0) {
        return NextResponse.json({
          error: 'この出店には売上報告が' + sales.length + '件残っています（'
            + sales.map((s: { sale_date: string }) => s.sale_date).join('、')
            + '）。先に「売上管理」でその報告を削除してください',
        }, { status: 409 })
      }

      // 取り消していない請求書が紐づいていると、請求の相手が分からなくなる
      const { data: invs } = await db
        .from('invoices').select('invoice_no').eq('application_id', id).is('voided_at', null)
      if (invs && invs.length > 0) {
        return NextResponse.json({
          error: 'この出店には有効な請求書（' + invs.map((i: { invoice_no: string }) => i.invoice_no).join('、')
            + '）が紐づいています。先に「売上管理」でその請求書を取り消してください',
        }, { status: 409 })
      }

      const logged = await writePurgeLog(db, {
        kind: 'application', target_id: id, deleted_by: uid,
        summary: purgeSummary({
          placeTitle: (app as { places?: { title?: string } }).places?.title,
          applyDate: app.apply_date,
          // 出店者も残す。消したあとにキャンセル料を請求できるようにするため
          sellerName: (app as { profiles?: { name?: string; shop_name?: string } }).profiles?.shop_name
            || (app as { profiles?: { name?: string } }).profiles?.name,
          sellerId: app.seller_id,
          reason: app.cancel_reason,
        }),
      })

      // やり取りを先に消す。messages.application_id の外部キーが
      // 削除を止める設定（restrict / no action）だと、ここで消しておかないと
      // 出店そのものを消せない。取り消した出店の会話を残す意味もない
      const { error: mErr } = await db.from('messages').delete().eq('application_id', id)
      if (mErr) console.error('メッセージの削除に失敗しました', mErr.message)

      const { error } = await db.from('applications').delete().eq('id', id).eq('status', 'cancelled')
      if (error) {
        return NextResponse.json({
          error: '削除に失敗しました: ' + error.message
            + '（この出店に紐づく記録が残っている可能性があります）',
        }, { status: 500 })
      }
      return NextResponse.json({ success: true, logged })
    }

    // ===== 取り消し済みの請求書を消す =====
    if (body.action === 'invoice') {
      const id = String(body.id ?? '').trim()
      if (!id) return NextResponse.json({ error: '対象が指定されていません' }, { status: 400 })

      const { data: inv } = await db
        .from('invoices')
        .select('id, invoice_no, seller_id, period, total, paid_status, voided_at, void_reason')
        .eq('id', id).maybeSingle()
      if (!inv) return NextResponse.json({ error: '請求書が見つかりませんでした' }, { status: 404 })

      if (!inv.voided_at) {
        return NextResponse.json(
          { error: 'まだ取り消されていません。先に「取り消す」で取り消してから、削除してください' },
          { status: 409 },
        )
      }
      // 入金を受け取った記録は消さない。取り消してあっても、
      // お金が動いた事実の証跡は残す
      if (inv.paid_status === 'paid') {
        return NextResponse.json(
          { error: 'この請求書は入金確認済みです。お金が動いた記録は削除できません' },
          { status: 409 },
        )
      }

      const logged = await writePurgeLog(db, {
        kind: 'invoice', target_id: id, deleted_by: uid,
        // 請求書は載せる項目が出店と違う（番号・期間・金額）ので、
        // purgeSummary は使わずここで組む
        summary: [inv.invoice_no, inv.period, '¥' + Number(inv.total || 0).toLocaleString(), inv.void_reason || '']
          .filter(Boolean).join(' / '),
      })

      const { error } = await db.from('invoices').delete().eq('id', id).not('voided_at', 'is', null)
      if (error) return NextResponse.json({ error: '削除に失敗しました: ' + error.message }, { status: 500 })
      return NextResponse.json({ success: true, logged })
    }

    return NextResponse.json({ error: 'action が不正です' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
