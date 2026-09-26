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
  const min = Math.min(minApplyDays(p), Math.max(selectable, 1))
  if (min <= 1 || picked >= min) return null
  return {
    need: min - picked,
    message: picked === 0
      ? `この案件は${min}日以上でお申し込みください`
      : `あと${min - picked}日選んでください（この案件は${min}日以上でのお申し込みです）`,
  }
}
