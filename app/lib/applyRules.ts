// 申込のときの「日数の決まり」。
//
// ここが唯一の正で、3か所が同じものを読む：
//   ・app/components/ApplyDateCalendar.tsx     … 案内と、足りないときの知らせ
//   ・app/places/[id]/PlaceDetailClient.tsx    … 送信前の確認
//   ・app/dashboard/host/new-place, edit-place … 募集者・運営の入力欄
//
// なぜ要るか（2026-09-26 の運営からの説明）:
//   美食EXPO は1日だけの出店を受け付けておらず、2日間か3日間でしか出られない。
//   ほかのイベントには「3日のうち2日でもよい」ところもある。
//   「全日まとめてのみ」にすると後者を受け付けられないので、下限だけを持たせる。

export type ApplyDaysSource = {
  /** 1回の申込で選ばないといけない最低の日数（places.min_apply_days） */
  min_apply_days?: number | null
  /**
   * 日数ごとの出店料（places.day_count_fees）。
   * 入っていれば、その表にある日数だけが選べる（最低日数より優先する）。
   * 「2日なら6万円、3日なら8万円」の案件では、2日か3日しか選べない
   */
  day_count_fees?: unknown
}

/** 選べる日数の一覧。日数ごとの金額を入れていない案件は空（＝下限だけで判断する） */
export function allowedDayCounts(p: ApplyDaysSource | null | undefined): number[] {
  const o = p?.day_count_fees
  if (!o || typeof o !== 'object' || Array.isArray(o)) return []
  return Object.keys(o as Record<string, unknown>)
    .map(k => parseInt(k, 10))
    .filter(n => Number.isFinite(n) && n > 0)
    .sort((a, b) => a - b)
}

/** その案件の最低出店日数。空・1・数字でない値は「1日から」として扱う */
export function minApplyDays(p: ApplyDaysSource | null | undefined): number {
  const n = Number(p?.min_apply_days ?? 0)
  if (!Number.isFinite(n) || n <= 1) return 1
  return Math.floor(n)
}

/**
 * 日数が足りているか。足りなければ画面に出す文を返す。
 *
 * selectable は「いま選べる日の数」。日程より下限が大きい案件
 * （3日の日程に「最低5日」と入ってしまった、過ぎた日が増えて選べる日が減った）では、
 * 選べる日を全部選んでも下限に届かない。そのときは下限ではなく
 * 「選べる日すべて」を求める。届かない数を求め続けると申し込めなくなる。
 */
export function applyDaysShortfall(
  p: ApplyDaysSource | null | undefined,
  picked: number,
  selectable: number,
): { need: number; message: string } | null {
  // 日数ごとの金額がある案件は、その日数ちょうどでないと額が決まらない。
  // 日程より多い日数（3日の日程に「5日」の行がある）は選びようがないので外す
  const counts = allowedDayCounts(p).filter(n => n <= Math.max(selectable, 1))
  if (counts.length > 0) {
    if (counts.includes(picked)) return null
    const list = counts.join('日または') + '日'
    const next = counts.find(n => n > picked)
    return {
      need: next != null ? next - picked : 0,
      message: picked === 0
        ? `この案件は${list}でのお申し込みです`
        : next != null
          ? `あと${next - picked}日選んでください（この案件は${list}でのお申し込みです）`
          : `選べるのは${list}です。${picked}日では申し込めません`,
    }
  }
  const min = Math.min(minApplyDays(p), Math.max(selectable, 1))
  if (min <= 1 || picked >= min) return null
  return {
    need: min - picked,
    message: picked === 0
      ? `この案件は${min}日以上でお申し込みください`
      : `あと${min - picked}日選んでください（この案件は${min}日以上でのお申し込みです）`,
  }
}
