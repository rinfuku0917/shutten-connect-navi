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

// ===== 曜日でまとめて選ぶ・1週おきにする =====
//
// なぜ要るか（2026-10-01 の運営からの相談）:
//   「火・木・金の枠で毎週出る」という出店者が、申し込むたびに
//   24日ぶんの日付を1つずつ押していた。
//   それまで画面にあったのは「当月を全選択」と「日程ぜんぶ」だけで、
//   曜日で絞ってまとめて選ぶ手立てが無かった。
//
// 案件側に新しい設定は足さない。選べる日付の集合に対する操作として作る。
// 使っている場所: app/components/ApplyDateCalendar.tsx

/** 日付（YYYY-MM-DD）を通し日数に直す。週の計算に使う */
export function dayNumber(date: string): number {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return NaN
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000)
}

/** 日付の曜日。0=日 … 6=土 */
export function dowOf(date: string): number {
  const [y, m, d] = String(date).slice(0, 10).split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

/**
 * 選べる日を曜日ごとにまとめる。
 *
 * 2日以上ある曜日だけ返す。1日しか無い曜日に「火曜 1日」と出しても、
 * カレンダーのマスを押すのと手間が変わらない。
 * 並びは日曜→土曜。各曜日の日付は古い順。
 */
export function dowGroups(dates: string[]): { dow: number; dates: string[] }[] {
  const map = new Map<number, string[]>()
  for (const d of [...dates].sort()) {
    const w = dowOf(d)
    if (!Number.isInteger(w)) continue
    const cur = map.get(w)
    if (cur) cur.push(d)
    else map.set(w, [d])
  }
  return [...map.entries()]
    .filter(([, ds]) => ds.length >= 2)
    .sort((a, b) => a[0] - b[0])
    .map(([dow, ds]) => ({ dow, dates: ds }))
}

/**
 * 選んでいる日を1週おきに間引くとき、外す日を返す。
 *
 * いちばん早い日を0週として7日ずつで週を数え、奇数週の日を外す。
 * 火木金を選んでから押すと、1週目の火木金・3週目の火木金…が残る。
 *
 * 週の区切りを日曜始まりにしないのは、火曜始まりの案件で
 * 最初の週だけ日数が変わってしまうため（選んだ日を基準にする）。
 */
export function biweeklyDrop(picked: string[]): string[] {
  const ds = [...picked].filter(d => Number.isFinite(dayNumber(d))).sort()
  if (ds.length === 0) return []
  const first = dayNumber(ds[0])
  return ds.filter(d => Math.floor((dayNumber(d) - first) / 7) % 2 === 1)
}

/** 1週おきにする意味があるか（2週以上にまたがって選んでいるか） */
export function canMakeBiweekly(picked: string[]): boolean {
  const ds = [...picked].filter(d => Number.isFinite(dayNumber(d))).sort()
  if (ds.length < 2) return false
  return Math.floor((dayNumber(ds[ds.length - 1]) - dayNumber(ds[0])) / 7) >= 1
}
