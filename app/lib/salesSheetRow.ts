// 経理用スプレッドシートへ送る1行の中身。
//
// 送る先は Google スプレッドシートに紐づけた Apps Script のウェブアプリ。
// URL と合い鍵は環境変数で持つ（SHEET_WEBHOOK_URL / SHEET_WEBHOOK_SECRET）。
//
// なぜ行の形をここに置くか:
//   送るきっかけは2つある。売上が報告されたとき（まだ請求書は無い）と、
//   請求書を発行したとき（発行状況が変わる）。同じ売上の行を2度送るので、
//   組み立てを1か所にしないと、2回目で列がずれる。
//   シート側は saleId をキーに、あれば上書き・なければ追加する。
//
// 列の並びは変えないこと。
//   Apps Script 側は HEADERS の並びで書き込む。途中に足すと、
//   すでにシートに入っている行と列がずれる。足すときは必ず末尾に。

/** シートの1行目（見出し）。並びを変えず、足すときは末尾に */
export const SHEET_HEADERS = [
  '売上ID',
  '報告日時',
  '出店者',
  '施設・案件',
  '出店日',
  '売上額',
  '取引先へ渡す額',
  '弊社の取り分',
  '確定手数料',
  '請求書ID',
  '発行状況',
  '入金状況',
  '入金日',
  '入金額',
] as const

export type SheetRow = Record<(typeof SHEET_HEADERS)[number], string | number>

/** 請求書の状態を、経理が読む日本語にする */
export function invoiceStateLabel(inv: { voided_at?: string | null } | null | undefined): string {
  if (!inv) return '未発行'
  if (inv.voided_at) return '取消し済み'
  return '発行済み'
}

/** 入金の状態を、経理が読む日本語にする */
export function paidStateLabel(inv: { paid_status?: string | null; voided_at?: string | null } | null | undefined): string {
  if (!inv) return '—'
  if (inv.voided_at) return '—'
  const s = String(inv.paid_status ?? 'unpaid')
  if (s === 'paid') return '入金確認済み'
  if (s === 'reported') return '振込報告済み'
  return '未入金'
}

type SaleLike = {
  id: string
  created_at?: string | null
  sale_date?: string | null
  revenue?: number | null
  place_fee?: number | null
  company_fee?: number | null
  fee?: number | null
  total_pay?: number | null
}

type InvoiceLike = {
  invoice_no?: string | null
  voided_at?: string | null
  paid_status?: string | null
  paid_on?: string | null
  paid_amount?: number | null
  total?: number | null
}

/**
 * 1件ぶんの行を組み立てる。
 *
 * 金額は数値で入れる（シート側で足し算できるように）。
 * 文字として入れると、経理が合計を出せない。
 */
export function buildSheetRow(
  sale: SaleLike,
  sellerName: string,
  placeTitle: string,
  invoice: InvoiceLike | null,
): SheetRow {
  // 確定手数料は、記録された total_pay を正とする。
  // 案件の料金設定はあとから変わることがあり、
  // 「報告した時点でいくらだったか」を残す必要があるため、
  // ここで計算し直さない
  const companyFee = typeof sale.company_fee === 'number' ? sale.company_fee
    : typeof sale.fee === 'number' ? sale.fee : 0
  const placeFee = typeof sale.place_fee === 'number' ? sale.place_fee : 0
  const totalPay = typeof sale.total_pay === 'number' ? sale.total_pay : (placeFee + companyFee)

  // 入金額は、実額が入っていればそれ。入っていなければ
  // 入金確認済みのときだけ請求額を入れる（未入金の行に額を入れない）
  const paidAmount = typeof invoice?.paid_amount === 'number'
    ? invoice.paid_amount
    : (invoice && !invoice.voided_at && invoice.paid_status === 'paid' && typeof invoice.total === 'number')
      ? invoice.total
      : ''

  return {
    '売上ID': sale.id,
    // 日時は 2026-09-12 16:53 の形にする。シート側で日付として読めるよう、
    // T ではなく空白で区切る
    '報告日時': sale.created_at ? String(sale.created_at).slice(0, 16).replace('T', ' ') : '',
    '出店者': sellerName || '(出店者)',
    '施設・案件': placeTitle || '(案件名なし)',
    '出店日': sale.sale_date || '',
    '売上額': typeof sale.revenue === 'number' ? sale.revenue : '',
    '取引先へ渡す額': placeFee,
    '弊社の取り分': companyFee,
    '確定手数料': totalPay,
    '請求書ID': invoice?.invoice_no || '',
    '発行状況': invoiceStateLabel(invoice),
    '入金状況': paidStateLabel(invoice),
    '入金日': (invoice && !invoice.voided_at && invoice.paid_on) ? invoice.paid_on : '',
    '入金額': paidAmount,
  }
}
