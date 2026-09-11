// 「何を見て知ったか」の選択肢。
//
// 登録の画面（app/register/page.tsx）と、管理画面の集計で同じ一覧を使う。
// ここを増やすだけで両方に反映される。
//
// 並びは、実際に多いと見込まれる順。迷ったら上から選べるようにしている。
// 出店者と募集者で入口が違うため、それぞれの一覧を持つ。

export type SignupSource = { value: string; label: string }

// 募集する側（お店を呼びたい施設・企業）
export const HOST_SOURCES: SignupSource[] = [
  { value: 'search', label: 'Google・Yahoo!などの検索' },
  { value: 'sales', label: '弊社からのご連絡（電話・メール・訪問）' },
  { value: 'referral', label: '知人・取引先からの紹介' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'line', label: '公式LINE' },
  { value: 'x', label: 'X（旧Twitter）' },
  { value: 'seen_onsite', label: '実際の出店・イベントを見た' },
  { value: 'expo', label: '展示会・商談会' },
  { value: 'paper', label: 'チラシ・資料・郵送物' },
  { value: 'other', label: 'その他' },
]

// 出店する側（キッチンカー・物販）
export const SELLER_SOURCES: SignupSource[] = [
  { value: 'search', label: 'Google・Yahoo!などの検索' },
  { value: 'instagram', label: 'Instagram' },
  { value: 'line', label: '公式LINE' },
  { value: 'referral', label: '出店者仲間・知人からの紹介' },
  { value: 'x', label: 'X（旧Twitter）' },
  { value: 'jmty', label: 'ジモティー' },
  { value: 'seen_onsite', label: '実際の出店・イベントを見た' },
  { value: 'sales', label: '弊社からのご連絡' },
  { value: 'paper', label: 'チラシ・資料・郵送物' },
  { value: 'other', label: 'その他' },
]

export function sourcesFor(role: 'seller' | 'host'): SignupSource[] {
  return role === 'host' ? HOST_SOURCES : SELLER_SOURCES
}

// 記録された値から、画面に出す名前を引く。
// 一覧から消した値が過去のデータに残っていても、そのまま出せるようにする
export function sourceLabel(value: string | null | undefined): string {
  if (!value) return '未回答'
  const hit = [...HOST_SOURCES, ...SELLER_SOURCES].find(s => s.value === value)
  return hit ? hit.label : value
}
