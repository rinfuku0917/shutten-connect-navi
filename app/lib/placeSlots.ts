// 1日あたりの募集台数（places.slots_per_day_min / slots_per_day_max）。
//
// ここが唯一の正で、次の画面が同じ関数を読む：
//   ・app/places/[id]/PlaceDetailClient.tsx          … 案件詳細の「出店条件」
//   ・app/dashboard/host/new-place/page.tsx          … 案件の作成（募集者・運営）
//   ・app/dashboard/host/edit-place/[id]/page.tsx    … 案件の編集（募集者・運営）
//   ・app/admin/page.tsx                             … 運営の新規案件
//   ・app/api/admin/create-place/route.ts            … その保存
//   ・app/places/segmentData.ts                      … 都道府県・カテゴリーの一覧の集計文
//
// なぜ要るか（2026-10-02 の運営からの指摘）:
//   案件詳細に「募集台数 5台」と出ていて、5日間の案件を見た出店者から
//   「1日に5台出店できる（合計25台）ということですか？」と問い合わせが来た。
//   別の案件では「4台も出店するんですか？」とも聞かれている。
//   「何に対して5台なのか」が書かれていないのが原因。
//
//   しかも、その 5 は誰かが入力した数ではなかった。
//   places.max_slots には列の既定値 5 が付いていて、
//   290件のうち262件が、入力されないまま 5 になっていた（2026-10-02 に本番で確認）。
//   「5台」は事実ではなく既定値で、施設ごとの本当の台数（1日1台、1日3〜5台など）を
//   入れる欄も無かった。
//
// どう直したか:
//   ・1日あたりの台数を、下限と上限の2つの数で持つ（「1日あたり3〜5台」を出せるように）
//   ・出すときは必ず「1日あたり」を付ける。数字だけを出さない
//   ・入っていない案件には何も出さない。
//     既定値の 5 を「1日あたり5台」と読み替えない（さいたま看護専門学校のように、
//     実際は5台ではない案件に、もっと強い言い方で誤りを告知することになるため）
//
// max_slots（最大枠数）の列は残してあるが、もうどこからも読まないし書かない。
// 列の既定値 5 も外した（supabase/migrations/20261002_slots_per_day.sql）。
// 消していないのは、入力された7件（1・2・3・4・6台）を運営が見返せるようにするため。

export type SlotsSource = {
  slots_per_day_min?: number | null
  slots_per_day_max?: number | null
}

/** 入れられる台数の上限。これより大きい数は入力の誤りとして捨てる */
const MAX_SLOTS = 999

/** 全角の数字を半角に直す（全角で入れる人がいるため） */
const toHalf = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))

/**
 * 文字の中から台数として読める数を、出てきた順にすべて取り出す。
 *
 * 数字のかたまりごとに1つの数として読む。数字以外を取り除いてつなげない。
 * つなげると、1つの欄に「3~5」と入れたときに 35 台になってしまう
 * （運営の依頼文にも「1日／3台~5台」という書き方があり、そう入れる人がいる）。
 *
 * 先頭の「1日」「1日あたり」は台数ではないので読み飛ばす（「1日3台」と入れた場合）。
 * 0・大きすぎる数は入力の誤りとして捨てる。
 */
function slotNumbers(raw: string | number | null | undefined): number[] {
  if (raw == null) return []
  const s = toHalf(String(raw)).replace(/1\s*日\s*(あたり|当たり|当り)?/g, ' ')
  return (s.match(/\d+/g) ?? [])
    .map(x => parseInt(x, 10))
    .filter(n => Number.isFinite(n) && n >= 1 && n <= MAX_SLOTS)
}

/**
 * 入力の文字を台数に直す。空欄・0・数字でないもの・大きすぎる数は null（未設定）。
 * 数が2つ以上入っているときは最初の1つ（幅として読むのは normalizeSlots）。
 *
 * 0 を「0台」として残さない。「募集していない」は案件を終了にして表すもので、
 * 0台と出しても出店者には意味が伝わらない。
 */
export function toSlots(raw: string | number | null | undefined): number | null {
  return slotNumbers(raw)[0] ?? null
}

/**
 * 2つの欄を「下限・上限」に整える。保存する形もこれ。
 *
 *   ・片方しか入っていない     → その数だけ（上限は空）
 *   ・同じ数                   → その数だけ（上限は空）
 *   ・大小が逆                 → 入れ替える（「5〜3」と入れても「3〜5」として扱う）
 *   ・1つの欄に「3~5」         → 3〜5 として読む
 *
 * 2つの欄に出てきた数をすべて集めて、いちばん小さい数と大きい数を取る。
 * 入力を止めたり赤字で注意したりはしない（料金の欄と同じ考え方。
 * 誤入力は、読む側で整えて捨てる）。
 */
export function normalizeSlots(
  rawMin: string | number | null | undefined,
  rawMax: string | number | null | undefined,
): { min: number | null; max: number | null } {
  const all = [...slotNumbers(rawMin), ...slotNumbers(rawMax)]
  if (all.length === 0) return { min: null, max: null }
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  return lo === hi ? { min: lo, max: null } : { min: lo, max: hi }
}

/**
 * 出店者に見せる文。「1日あたり1台」「1日あたり3〜5台」。入っていなければ空文字。
 *
 * 必ず「1日あたり」を付ける。数字だけ（「5台」）にすると、
 * 複数日の案件で「日数ぶん掛けるのか」と読まれる（上の指摘）。
 */
export function slotsPerDayText(p: SlotsSource | null | undefined): string {
  if (!p) return ''
  return slotsText(p.slots_per_day_min, p.slots_per_day_max)
}

/**
 * 2つの数（または入力中の文字）から文を作る。
 * 入力欄の下に「出店者の画面にはこう出ます」と見せるのに使う
 * （保存する前に、出る文をそのまま確かめられるように）。
 */
export function slotsText(
  rawMin: string | number | null | undefined,
  rawMax: string | number | null | undefined,
): string {
  const { min, max } = normalizeSlots(rawMin, rawMax)
  if (min == null) return ''
  return max == null ? `1日あたり${min}台` : `1日あたり${min}〜${max}台`
}
