import { buildSheetRow, SHEET_HEADERS } from './salesSheetRow'

// 経理用スプレッドシートへ実際に送るところ。**サーバー専用**。
//
// 合い鍵（SHEET_WEBHOOK_SECRET）を読むので、画面から import してはいけない。
//
// なぜ関数に出したか:
//   送るきっかけが3つある。
//     ・売上が報告されたとき          → app/api/sheets/sales（画面から）
//     ・請求書を発行・取り消したとき   → app/api/admin/invoice（サーバー内）
//     ・入金を確認・取り消したとき     → app/api/invoice-payment（サーバー内）
//   後ろの2つで自分のAPIをHTTPで叩くと、アクセストークンを持ち回す必要があり、
//   Vercel の中で自分を呼ぶことにもなる。関数を直に呼ぶほうが確実で速い。

export type SheetSendResult = {
  /** 送れたか。設定が無いときは skipped が true で ok も true */
  ok: boolean
  skipped?: boolean
  reason?: string
  error?: string
  count: number
}

/** 連携の設定が入っているか */
export function sheetConfigured(): boolean {
  return !!(process.env.SHEET_WEBHOOK_URL && process.env.SHEET_WEBHOOK_SECRET)
}

/**
 * 売上を経理用シートへ送る。
 *
 * 送れても送れなくても sales の sheet_synced_at / sheet_error を書き換えるので、
 * 呼び出し側は結果を見なくてよい（運営の画面から送り直せる）。
 *
 * @param db サービスロールの Supabase クライアント
 * @param saleIds 送る売上のID。1度に200件まで
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sendSalesToSheet(db: any, saleIds: string[]): Promise<SheetSendResult> {
  const ids = Array.from(new Set(saleIds.filter(Boolean)))
  if (ids.length === 0) return { ok: true, count: 0 }
  if (ids.length > 200) return { ok: false, error: '一度に送れるのは200件までです', count: 0 }

  const url = process.env.SHEET_WEBHOOK_URL
  const secret = process.env.SHEET_WEBHOOK_SECRET
  if (!url || !secret) {
    // まだ設定していない環境。呼んだ側を失敗にしない
    return { ok: true, skipped: true, reason: 'not_configured', count: 0 }
  }

  // ---- 送る中身を集める ----
  const { data: sales, error: sErr } = await db
    .from('sales')
    .select('id, place_id, seller_id, sale_date, revenue, place_fee, company_fee, fee, total_pay, created_at')
    .in('id', ids)
  if (sErr) return { ok: false, error: '売上の取得に失敗しました: ' + sErr.message, count: 0 }

  type SaleRow = {
    id: string; place_id: string | null; seller_id: string
    sale_date: string | null; revenue: number | null
    place_fee: number | null; company_fee: number | null; fee: number | null
    total_pay: number | null; created_at: string | null
  }
  const rows = (sales || []) as SaleRow[]
  if (rows.length === 0) return { ok: true, count: 0 }

  // 名前と案件名をまとめて引く（1件ずつ引くと件数ぶん往復する）
  const sellerIds = Array.from(new Set(rows.map(r => r.seller_id).filter(Boolean)))
  const placeIds = Array.from(new Set(rows.map(r => r.place_id).filter(Boolean)))
  const [{ data: profs }, { data: places }, { data: invs }] = await Promise.all([
    sellerIds.length ? db.from('profiles').select('id, name, shop_name').in('id', sellerIds) : Promise.resolve({ data: [] }),
    placeIds.length ? db.from('places').select('id, title').in('id', placeIds) : Promise.resolve({ data: [] }),
    // その売上が載っている請求書。sale_ids に売上IDが入っている
    db.from('invoices')
      .select('invoice_no, sale_ids, voided_at, paid_status, paid_on, paid_amount, total, created_at')
      .overlaps('sale_ids', rows.map(r => r.id)),
  ])

  const nameOf = new Map<string, string>()
  for (const p of (profs || []) as { id: string; name?: string; shop_name?: string }[]) {
    nameOf.set(p.id, p.shop_name || p.name || '')
  }
  const titleOf = new Map<string, string>()
  for (const p of (places || []) as { id: string; title?: string }[]) titleOf.set(p.id, p.title || '')

  // 1つの売上に複数の請求書がぶら下がることがある（誤発行して出し直した）。
  // 取り消していないものを優先し、同じなら新しいほうを使う
  type Inv = {
    invoice_no: string; sale_ids: string[] | null; voided_at: string | null
    paid_status: string | null; paid_on: string | null; paid_amount: number | null
    total: number | null; created_at: string | null
  }
  const invOf = new Map<string, Inv>()
  for (const iv of (invs || []) as Inv[]) {
    for (const sid of (iv.sale_ids || [])) {
      const cur = invOf.get(sid)
      if (!cur) { invOf.set(sid, iv); continue }
      const curAlive = !cur.voided_at
      const newAlive = !iv.voided_at
      if (newAlive && !curAlive) { invOf.set(sid, iv); continue }
      if (newAlive === curAlive && String(iv.created_at || '') > String(cur.created_at || '')) invOf.set(sid, iv)
    }
  }

  const payload = rows.map(r => buildSheetRow(
    r,
    nameOf.get(r.seller_id) || '',
    r.place_id ? (titleOf.get(r.place_id) || '') : '',
    invOf.get(r.id) || null,
  ))

  // ---- 送る ----
  let ok = false
  let errText = ''
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, headers: SHEET_HEADERS, rows: payload }),
      // Apps Script は遅いことがある。長すぎる待ちは避ける
      signal: AbortSignal.timeout(30000),
    })
    const t = await res.text()
    if (!res.ok) {
      errText = 'HTTP ' + res.status + ' ' + t.slice(0, 300)
    } else if (!t.startsWith('ok')) {
      // Apps Script は失敗してもHTMLで200を返すことがある。
      // 合い鍵が違う・スクリプトが古いのを、成功と取り違えないようにする
      errText = '返答が想定と違います（合い鍵かデプロイをご確認ください）: ' + t.slice(0, 300)
    } else {
      ok = true
    }
  } catch (e) {
    errText = e instanceof Error ? e.message : '送信に失敗しました'
  }

  // ---- 結果を1行ごとに残す ----
  // ここが失敗しても送信の結果は返す（記録できないことと送れたことは別）
  const now = new Date().toISOString()
  try {
    if (ok) await db.from('sales').update({ sheet_synced_at: now, sheet_error: null }).in('id', rows.map(r => r.id))
    else await db.from('sales').update({ sheet_error: errText.slice(0, 500) }).in('id', rows.map(r => r.id))
  } catch (e) {
    console.error('シート送信の記録に失敗しました', e)
  }

  return ok
    ? { ok: true, count: rows.length }
    : { ok: false, error: errText, count: 0 }
}

/**
 * 請求書に載っている売上を送り直す。
 * 発行・取り消し・入金確認で「発行状況」「入金状況」が変わるため。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resendSheetForInvoice(db: any, invoiceId: string): Promise<void> {
  if (!invoiceId || !sheetConfigured()) return
  try {
    const { data } = await db.from('invoices').select('sale_ids').eq('id', invoiceId).maybeSingle()
    const ids = (data?.sale_ids || []) as string[]
    // 事前請求（advance）は売上に紐づかないので sale_ids が空。何もしない
    if (!ids.length) return
    await sendSalesToSheet(db, ids)
  } catch (e) {
    // 送れなかったことは sales.sheet_error に残る。呼んだ側の処理は止めない
    console.error('シートへの送り直しに失敗しました', e)
  }
}
