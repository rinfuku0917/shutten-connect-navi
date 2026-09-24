// 出店者プロフィールの必須項目。
//
// ここが唯一の正で、2か所が同じものを読む：
//   ・出店者ダッシュボード（app/dashboard/seller/page.tsx）… 保存前の検査と「必須」の印
//   ・案件への申込の入口（app/places/[id]/PlaceDetailClient.tsx）… 未完成なら申込を止める
//
// なぜ必須にしたか（2026-09-24）:
//   施設へ出す資料と公開される出店者ページの中身は、ここで入れた内容で決まる。
//   にもかかわらず、出店者1,386人のうち全部そろっていたのは7人だけで、
//   車両種別・車両サイズ・紹介文・設備・決済は99%が空だった（実測）。
//   運営が申込のたびに個別に催促していたため、入口で入れてもらう形にした。
//
// SNS（Instagram など）は必須にしない。アカウントを持っていない出店者を
// 永久に止めてしまうため。住所も入れていない（この画面に入力欄が無い）。
//
// 車種と車両サイズは、車両を使う販売形態（キッチンカー・移動販売車）のときだけ必須。
// 販売形態には「店頭出店（実店舗）」「テント・ブース」もあり、
// 車両を持たない出店者を無条件に必須にすると、保存も申込も永久にできなくなる。

export type SellerProfileCheck = {
  name?: string | null
  shop_name?: string | null
  email?: string | null
  phone?: string | null
  /** ジャンル。JSONの配列文字列（'["食事","スイーツ"]'）か、古い自由入力 */
  genre?: string | null
  areas?: string[] | null
  bio?: string | null
  sales_type?: string | null
  vehicle_type?: string | null
  size_length?: string | number | null
  size_width?: string | number | null
  size_height?: string | number | null
  equipment?: string | null
  takeout_bag?: string | null
  payment_methods?: string[] | null
  photos?: string[] | null
  /** 登録済みメニューの件数。menus は別の表なので、件数だけ渡す */
  menuCount?: number | null
}

/** 車両を使う販売形態か（車種・車両サイズを必須にするかの判定） */
export const VEHICLE_SALES_TYPES = ['キッチンカー', '移動販売車']
export function usesVehicle(salesType: unknown): boolean {
  const t = (salesType == null ? '' : String(salesType)).trim()
  // 未選択のうちは車両項目を必須にしない（販売形態を選ぶのが先）
  if (!t) return false
  return VEHICLE_SALES_TYPES.some(v => t.includes(v))
}

/** 入っているか。空文字・空白だけ・空配列・0は未入力として扱う */
const filled = (v: unknown): boolean => {
  if (v == null) return false
  if (Array.isArray(v)) return v.length > 0
  if (typeof v === 'number') return isFinite(v) && v > 0
  return String(v).trim() !== ''
}

/** ジャンルは JSON の配列文字列で入っている（古いものはカンマ区切り）。
 *  app/dashboard/seller/page.tsx の parseGenres と同じ読み方にそろえる */
export function parseSellerGenres(v: unknown): string[] {
  const t = (v == null ? '' : String(v)).trim()
  if (!t) return []
  if (t.startsWith('[')) {
    try {
      const j = JSON.parse(t)
      if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean)
    } catch { /* 古い自由入力はカンマ区切りとして扱う */ }
  }
  return t.split(/[,、，]/).map(x => x.trim()).filter(Boolean)
}

/** 必須項目。画面の並びと同じ順にしておく（不足の案内をこの順で出す） */
export const SELLER_REQUIRED: { key: string, label: string, ok: (p: SellerProfileCheck) => boolean }[] = [
  { key: 'name', label: '氏名', ok: p => filled(p.name) },
  { key: 'shop_name', label: '店舗名（屋号）', ok: p => filled(p.shop_name) },
  { key: 'email', label: 'メール', ok: p => filled(p.email) },
  { key: 'phone', label: '電話番号', ok: p => filled(p.phone) },
  { key: 'photos', label: '店舗・商品写真（1枚以上）', ok: p => filled(p.photos) },
  { key: 'menus', label: '提供メニュー（1件以上）', ok: p => filled(p.menuCount) },
  { key: 'bio', label: '紹介文・特徴', ok: p => filled(p.bio) },
  { key: 'sales_type', label: '販売形態', ok: p => filled(p.sales_type) },
  // 車両を使う形態のときだけ必須（テント・店頭出店の人は空でよい）
  { key: 'vehicle_type', label: '車種', ok: p => !usesVehicle(p.sales_type) || filled(p.vehicle_type) },
  // 車両サイズは3つそろって初めて掲載できる表記になる（片方だけでは使えない）
  { key: 'size', label: '車両サイズ（全長・全幅・高さ）', ok: p => !usesVehicle(p.sales_type) || (filled(p.size_length) && filled(p.size_width) && filled(p.size_height)) },
  { key: 'equipment', label: '設備', ok: p => filled(p.equipment) },
  // 「有料」を選んで金額が空のままだと、公開ページに「有料」とだけ出て
  // いくらなのか分からない。編集中の '有料：円' も未入力として扱う
  { key: 'takeout_bag', label: 'テイクアウトの袋（有料なら金額も）', ok: p => {
    const t = (p.takeout_bag == null ? '' : String(p.takeout_bag)).trim()
    if (!t) return false
    if (t.startsWith('有料')) return /[0-9]/.test(t)
    return true
  } },
  { key: 'payment_methods', label: '利用できる決済', ok: p => filled(p.payment_methods) },
  { key: 'genre', label: 'ジャンル', ok: p => parseSellerGenres(p.genre).length > 0 },
  { key: 'areas', label: '活動エリア', ok: p => filled(p.areas) },
]

/** 未入力の必須項目。画面の並び順で返す */
export function missingSellerFields(p: SellerProfileCheck): { key: string, label: string }[] {
  return SELLER_REQUIRED.filter(f => !f.ok(p)).map(({ key, label }) => ({ key, label }))
}

export function isSellerProfileComplete(p: SellerProfileCheck): boolean {
  return SELLER_REQUIRED.every(f => f.ok(p))
}

/** プロフィールを読むときの列。2か所で同じものを読むためにここに置く */
export const SELLER_PROFILE_COLUMNS =
  'name, shop_name, email, phone, genre, areas, bio, sales_type, vehicle_type, size_length, size_width, size_height, equipment, takeout_bag, payment_methods, photos'

export const PROFILE_REQUIRED_NOTE =
  '必ず全ての項目を正確にご記載ください。ここに入れた内容が、施設へ提出する資料と、公開される出店者ページに使われます。'

/** 上の呼びかけに必ず添える。氏名・メール・電話が公開されると誤解すると、
 *  かえって空欄にされてしまう（公開ページには店舗名から下だけが出る） */
export const PROFILE_PRIVACY_NOTE =
  '氏名・メール・電話番号は公開ページには出ません（運営と、出店が決まった施設への連絡にだけ使います）。'
