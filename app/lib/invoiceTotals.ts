// 請求書の小計・消費税・合計。
//
// ここが唯一の正で、2か所が同じものを読む：
//   ・app/admin/invoice/page.tsx        … 画面の表示と、直したときの計算
//   ・app/api/admin/invoice/route.ts    … 保存するときの計算（action='save'）
//
// なぜ分けたか（2026-09-27 の依頼）:
//   キャンセル料は、出店しなかったことへの賠償であって、
//   何かを売ったわけではないので消費税の対象外（不課税）。
//   これまでは明細の合計に一律10%を掛けていたため、
//   キャンセル料にも消費税が乗ってしまっていた。
//   明細ごとに「不課税」の印を持たせ、印の無い行だけに税を掛ける。
//
// 印の無い請求書（これまでのもの）は、全額が課税対象として
// これまでと同じ額になる。過去の請求書の金額は変わらない。

export type InvoiceLine = {
  amount?: number | null
  /** 消費税の対象外（不課税）。キャンセル料など */
  taxFree?: boolean | null
}

export type InvoiceTotals = {
  /** 課税対象の小計（税抜） */
  taxable: number
  /** 不課税の小計 */
  taxFree: number
  /** 明細の合計（課税＋不課税）。invoices.subtotal に入れる額 */
  subtotal: number
  /** 消費税。課税対象にだけ掛ける */
  tax: number
  /** 税込合計 */
  total: number
}

const yenOf = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function invoiceTotals(items: InvoiceLine[] | null | undefined): InvoiceTotals {
  const list = Array.isArray(items) ? items : []
  let taxable = 0
  let taxFree = 0
  for (const it of list) {
    const a = yenOf(it?.amount)
    if (it?.taxFree) taxFree += a
    else taxable += a
  }
  // 1円未満は切り捨て。これまでの計算（Math.floor(小計 * 0.1)）と同じ
  const tax = Math.floor(taxable * 0.1)
  return { taxable, taxFree, subtotal: taxable + taxFree, tax, total: taxable + taxFree + tax }
}
