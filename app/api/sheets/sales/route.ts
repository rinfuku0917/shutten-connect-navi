import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { sendSalesToSheet, sheetConfigured } from '../../../lib/sheetSend'

// 売上報告を、経理用のGoogleスプレッドシートへ送る窓口（画面から呼ばれる）。
//
// 送る中身と実際の送信は app/lib/sheetSend.ts が持つ。
// 請求書の発行・入金の確認からは、その関数を直に呼んでいる。
//
// 置き方（Apps Script の貼り方とVercelの環境変数）は
// docs/sheet-webhook.gs の冒頭に書いてある。
//
// なぜ画面から直接 Apps Script を叩かないのか:
//   合い鍵をブラウザに置くことになり、誰でもシートに行を足せてしまう。

export const maxDuration = 60

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// 呼び出し元をアクセストークンで確かめる。
// 運営だけでなく、自分の売上を報告した出店者からも呼ばれる。
// 誰の売上かは saleId から引くので、body の出店者IDは信用しない。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireUser(req: Request, db: any): Promise<{ uid: string; isAdmin: boolean } | NextResponse> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
  const { data: userData, error: uErr } = await db.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
  const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
  return { uid, isAdmin: me?.role === 'admin' }
}

export async function POST(req: Request) {
  try {
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const auth = await requireUser(req, db)
    if (auth instanceof NextResponse) return auth

    const body = await req.json().catch(() => ({}))
    // retryPending … 未送信のものをまとめて送り直す（運営のみ）
    const retryPending = body?.retryPending === true
    const rawIds: unknown = body?.saleIds ?? (body?.saleId ? [body.saleId] : [])
    let ids: string[] = Array.isArray(rawIds) ? rawIds.map(String).filter(Boolean) : []

    if (!sheetConfigured()) {
      // まだ設定していない環境。呼んだ側を失敗にしない
      return NextResponse.json({ skipped: true, reason: 'not_configured' })
    }

    if (retryPending) {
      if (!auth.isAdmin) return NextResponse.json({ error: '運営のみが実行できます' }, { status: 403 })
      // 一度に送りすぎないよう上限を置く。残りは次の実行で送る
      const { data, error } = await db
        .from('sales').select('id').is('sheet_synced_at', null)
        .order('created_at', { ascending: true }).limit(200)
      if (error) return NextResponse.json({ error: '未送信の取得に失敗しました: ' + error.message }, { status: 500 })
      ids = (data || []).map((r: { id: string }) => r.id)
    }

    if (ids.length === 0) return NextResponse.json({ sent: 0, failed: 0 })

    // 出店者は、自分の売上だけ送れる。
    // 他人のIDを混ぜて呼ばれても、ここで止める
    if (!auth.isAdmin) {
      const { data: mine, error } = await db
        .from('sales').select('id').in('id', ids).eq('seller_id', auth.uid)
      if (error) return NextResponse.json({ error: '売上の確認に失敗しました' }, { status: 500 })
      const allowed = new Set(((mine || []) as { id: string }[]).map(r => r.id))
      if (allowed.size !== ids.length) {
        return NextResponse.json({ error: '自分の売上以外は送れません' }, { status: 403 })
      }
    }

    const res = await sendSalesToSheet(db, ids)
    if (!res.ok) {
      // 送れなかったことは sales.sheet_error に残っている。
      // 画面から押した「送り直す」のときは、理由を出す
      return NextResponse.json({ sent: 0, failed: ids.length, error: res.error }, { status: 502 })
    }
    return NextResponse.json({ sent: res.count, failed: 0, skipped: res.skipped ?? false })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// 未送信の件数と直近の失敗を返す。管理画面の「送り直す」の横に出す
export async function GET(req: Request) {
  try {
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const auth = await requireUser(req, db)
    if (auth instanceof NextResponse) return auth
    if (!auth.isAdmin) return NextResponse.json({ error: '運営のみが参照できます' }, { status: 403 })

    const configured = sheetConfigured()
    const { count, error } = await db
      .from('sales').select('id', { count: 'exact', head: true }).is('sheet_synced_at', null)
    if (error) {
      // 列がまだ無い環境（SQL未実行）。画面でやることを案内する
      return NextResponse.json({
        configured,
        needsSetup: true,
        error: '売上の表に列が足りません。Supabase の SQL Editor で '
          + 'supabase/migrations/20260912_sales_sheet_sync.sql を実行してください。',
      })
    }
    // 直近の失敗の理由を1つ出す。原因の切り分けに使う
    const { data: last } = await db
      .from('sales').select('sheet_error').not('sheet_error', 'is', null)
      .order('created_at', { ascending: false }).limit(1)
    return NextResponse.json({
      configured,
      pending: count ?? 0,
      lastError: (last && last[0]?.sheet_error) || null,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
