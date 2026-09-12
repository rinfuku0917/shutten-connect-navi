// 出店者の一覧・公開ページ・サイトマップから外す屋号。
//
// 運営が動作確認や取り込みのために作ったアカウントで、
// お客様に見せるものではない。
//
// なぜ切り出したか:
//   同じ配列を app/sellers/page.tsx と app/sellers/[id]/page.tsx に
//   別々に書いていた。サイトマップでも同じ判定が必要になり、
//   3か所に同じものが並ぶことになった。片方だけ直すと、
//   「一覧には出ないのにサイトマップには入っている」がまた起きる。

export const EXCLUDED_SHOP_NAMES = ['株式会社nav', '株式会社アーク']

/** その屋号を隠すか */
export function isExcludedShop(shopName: string | null | undefined): boolean {
  return EXCLUDED_SHOP_NAMES.includes((shopName ?? '').trim())
}
