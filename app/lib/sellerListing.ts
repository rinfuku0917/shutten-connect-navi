// 出店者ページを「検索に出す価値がある」と見なす条件。
//
// ここが唯一の正で、2か所が同じものを読む：
//   ・app/sitemap.ts              … サイトマップに入れる出店者を選ぶ
//   ・app/sellers/page.tsx        … 一覧の下の「すべての出店者」に並べる出店者を選ぶ
//
// なぜ2か所でそろえるか（2026-09-24）:
//   サイトマップには583人が入っているのに、一覧のHTMLは先頭30人ぶんしか
//   リンクしていなかった（ページ送りが button で、クローラーがたどれない）。
//   残り553ページは「サイトマップにしか無い孤立ページ」で、
//   AGENTS.md の「サイトマップにしか無い孤立ページにしない」に反していた。
//   条件が食い違うと、リンクした先がサイトマップに無い（またはその逆）になるため、
//   判定を1か所にまとめる。

export type SellerContentCheck = {
  /** 屋号（店舗名）。空なら公開ページが noindex なので対象外 */
  shopName?: string | null
  photos?: unknown
  bio?: string | null
  /** menus 表にその出店者の行があるか */
  hasMenu?: boolean
  /**
   * menus 表を読めたか。読めなかったときは絞り込まない（true 扱いにする）。
   * 読めないのに絞ると、メニューだけを登録している出店者が全員こぼれ、
   * サイトマップと一覧が黙って縮む
   */
  menusOk?: boolean
}

/** 紹介文が「名前と都道府県だけ」と差が出る長さの目安 */
export const SELLER_BIO_MIN = 30

/** 公開ページを検索に出す（＝サイトマップにも一覧にも入れる）出店者か */
export function sellerHasContent(s: SellerContentCheck): boolean {
  // 屋号が無い出店者は対象外。公開ページは本名を出さない作りなので、
  // 屋号が無いページは誰の紹介か分からない（ページ側も noindex にしてある）
  if (!String(s.shopName ?? '').trim()) return false
  // menus が読めなかったときは絞らない
  if (s.menusOk === false) return true
  const photos = Array.isArray(s.photos) ? s.photos.filter(Boolean) : []
  const bio = typeof s.bio === 'string' ? s.bio.trim() : ''
  return photos.length > 0 || s.hasMenu === true || bio.length >= SELLER_BIO_MIN
}
