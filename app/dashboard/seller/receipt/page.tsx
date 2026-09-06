'use client'
import { ReceiptScreen } from '../../../admin/receipt/page'

// 出店者が、自分あての領収書を見てPDFにする画面。
// /dashboard/seller/receipt?no=2026-0042 で開く。
//
// 紙面は運営側とまったく同じものを使う（app/admin/receipt/page.tsx）。
// 誰の領収書を出せるか、入金が済んでいるかの判定はサーバー側で行う。
export default function SellerReceiptPage() {
  return <ReceiptScreen viewer='seller' />
}
