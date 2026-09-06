'use client'
import { InvoiceScreen } from '../../../admin/invoice/page'

// 出店者が、自分あての請求書を見てPDFにする画面。
// /dashboard/seller/invoice?no=2026-0042 で開く。
//
// 紙面は運営側とまったく同じものを使う（app/admin/invoice/page.tsx）。
// 出店者に見せるぶんだけ別に書くと、体裁を直したときに
// 片方だけ古いまま残り、届く請求書と画面が食い違う。
//
// 見えるのは自分あての請求書だけ。取り消した請求書は開けない。
// その判定はサーバー側（/api/admin/invoice の action='open'）で行う。
// 画面から操作を隠すだけでは、番号を直接指定されたときに防げないため。
export default function SellerInvoicePage() {
  return <InvoiceScreen viewer='seller' />
}
