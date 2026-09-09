import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// テストで作った記録を、運営が完全に消す。
//
// なぜ要るか:
//   出店の取消し（status='cancelled'）も請求書の取消し（voided_at）も、
//   行を残す作りにしている。キャンセル料の根拠が消えると困るからで、
//   ふだんはこれで正しい。
//   ただしテストで作った出店や、二重に発行してしまった請求書が
//   一覧に残り続けるのは別の話で、運営が片づけられないと
//   本物の記録が埋もれていく。
//
// 消せるのは「すでに取り消してあるもの」だけにする。
//   ・出店 … status='cancelled' で、売上報告も有効な請求書も無いもの
//   ・請求書 … voided_at があり、入金確認済みでないもの
// 一度取り消す手間を挟むことで、本番の記録を1回の操作で消せないようにしている。
//
// 消した内容は purge_log に残す。あとから「何を消したか」を追えるようにするため。

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

// 消した記録を残す。表が無くても本体の削除は止めない
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function writeLog(db: any, row: Record<string, unknown>) {
  try {
    await db.from('purge_log').insert(row)
  } catch (e) {
    console.error('purge_log への記録に失敗しました', e)
  }
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
        .select('id, seller_id, place_id, apply_date, status, cancel_reason, places(title)')
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

      await writeLog(db, {
        kind: 'application', target_id: id, deleted_by: uid,
        summary: [
          (app as { places?: { title?: string } }).places?.title || '(案件名なし)',
          app.apply_date || '(日付なし)',
          app.cancel_reason || '',
        ].filter(Boolean).join(' / '),
      })

      const { error } = await db.from('applications').delete().eq('id', id).eq('status', 'cancelled')
      if (error) return NextResponse.json({ error: '削除に失敗しました: ' + error.message }, { status: 500 })
      return NextResponse.json({ success: true })
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

      await writeLog(db, {
        kind: 'invoice', target_id: id, deleted_by: uid,
        summary: [inv.invoice_no, inv.period, '¥' + Number(inv.total || 0).toLocaleString(), inv.void_reason || '']
          .filter(Boolean).join(' / '),
      })

      const { error } = await db.from('invoices').delete().eq('id', id).not('voided_at', 'is', null)
      if (error) return NextResponse.json({ error: '削除に失敗しました: ' + error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'action が不正です' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
