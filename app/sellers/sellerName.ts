// 出店者一覧で使う「店名の見せ方」と「並び順」。
//
// 一覧のカードと、並び替えの両方が同じ判定を使う必要があるため、
// ここにまとめている。片方だけ変えると、
// 「店名が出ているのに未登録あつかいで後ろに回る」といったことが起きる。

export type SellerLike = {
  shop_name: string | null
  photos: string[] | null
}

// 法人名（株式会社◯◯など）も一覧に出す。
//
// 以前は「法人名は屋号ではないので出さない」としていたが、
// 詳細ページは shop_name をそのまま出しているため、
// 一覧では「（店名未登録）」なのに開くと「モバコン株式会社」と出る食い違いがあった
// （2026-09-24 に指摘。168件が該当）。運営の判断で、会社名も屋号も出すことにした。
//
// 本名（profiles.name）は出さない。これは公開用ビュー public_sellers に
// 本名の列が無いことで担保している（supabase/migrations/20260919_public_sellers_no_name.sql）。
// ここで扱う shop_name は出店者が「店舗名」として自分で入れた値。
const CORPORATE_MARKERS = ['株式会社', '合同会社', '有限会社', '合資会社', '合名会社', '(株)', '（株）', '(有)', '（有）']

/** 法人名かどうか。並び順や表示の出し分けには使っていないが、
 *  「会社名か屋号か」を見分けたい場面のために残している */
export function isCorporateName(name: string): boolean {
  return CORPORATE_MARKERS.some((m) => name.includes(m))
}

/** 一覧に出す店名。空のときだけ null（カードは「（店名未登録）」になる） */
export function displayShopName(s: SellerLike): string | null {
  const name = (s.shop_name ?? '').trim()
  return name || null
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
