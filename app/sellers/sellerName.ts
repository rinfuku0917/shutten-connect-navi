// 出店者一覧で使う「店名の見せ方」と「並び順」。
//
// 一覧のカードと、並び替えの両方が同じ判定を使う必要があるため、
// ここにまとめている。片方だけ変えると、
// 「店名が出ているのに未登録あつかいで後ろに回る」といったことが起きる。

export type SellerLike = {
  shop_name: string | null
  photos: string[] | null
}

// 法人名は屋号ではないので、一覧では店名として出さない。
// 「株式会社◯◯」と並んでも、どんな車か分からないため。
const CORPORATE_MARKERS = ['株式会社', '合同会社', '有限会社', '合資会社', '合名会社', '(株)', '（株）', '(有)', '（有）']

export function isCorporateName(name: string): boolean {
  return CORPORATE_MARKERS.some((m) => name.includes(m))
}

/** 一覧に出す店名。出せるものが無ければ null（カードは「（店名未登録）」になる） */
export function displayShopName(s: SellerLike): string | null {
  const name = (s.shop_name ?? '').trim()
  if (!name || isCorporateName(name)) return null
  return name
}

export function hasPhoto(s: SellerLike): boolean {
  return Array.isArray(s.photos) && s.photos.length > 0
}

// 見た目のそろい方で順位をつける。小さいほど前に出す。
//
// 写真を先に見るのは、一覧が画像の並びだから。
// 写真が無いカードは頭文字だけの四角になり、そこだけ空いて見える。
//   0 … 写真も店名もある
//   1 … 写真だけある（絵が入るので、並びとしては成立する）
//   2 … 店名だけある
//   3 … どちらも無い
export function completenessRank(s: SellerLike): number {
  const photo = hasPhoto(s)
  const name = displayShopName(s) !== null
  if (photo && name) return 0
  if (photo) return 1
  if (name) return 2
  return 3
}

/**
 * 一覧に出す順に並べ替える。
 * 写真と店名がそろっているものを前に、どちらも無いものを後ろに。
 * 同じ並びの中では、これまでどおり店名の五十音順にする。
 */
export function sortForListing<T extends SellerLike>(sellers: T[]): T[] {
  return [...sellers].sort((a, b) => {
    const d = completenessRank(a) - completenessRank(b)
    if (d !== 0) return d
    const an = displayShopName(a) ?? ''
    const bn = displayShopName(b) ?? ''
    return an.localeCompare(bn, 'ja')
  })
}
