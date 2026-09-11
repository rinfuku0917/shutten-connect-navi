// 取り消した申込を、出店者の画面にいつまで見せるか。
//
// 行そのものは消さない（キャンセル料の判断と、繰り返す出店者の把握のため
// 運営は見る）。ただし本人の画面に何年も残り続けるのは気持ちのよいものではない、
// という指摘を受けて、本人の画面からだけ、一定の期間を過ぎたら見えなくしている。
// 直近のものは見えるので、経緯は追える。
//
// なぜこのファイルに切り出したか:
//   この30日の決まりは、はじめは出店者のマイページにしか入れていなかった。
//   案件ページの「この案件はエントリー済みです」には入れ忘れていて、
//   取り消した申込がいつまでも「エントリー済み」として出ていた。
//   同じ決まりを2か所に書くと、片方だけ直して食い違う。ここを唯一の正とする。

export const CANCELLED_VISIBLE_DAYS = 30

/**
 * 取り消した申込を、出店者の画面に出してよいか。
 *
 * 取り消し以外の申込は、いつでも出す（true）。
 * 出店日が決まっていない取消しは、申し込んだ日から数える。
 * どちらの日付も無い取消しは、いつのものか判断できないので出す。
 *
 * @param now 判定の基準日。渡さないと現在。テストのために受け取る
 */
export function showsCancelled(
  app: { status?: string | null; apply_date?: string | null; created_at?: string | null },
  now: Date = new Date(),
): boolean {
  if (app?.status !== 'cancelled') return true
  const limit = new Date(now.getTime() - CANCELLED_VISIBLE_DAYS * 86400000).toISOString().slice(0, 10)
  const d = app.apply_date || (app.created_at ? String(app.created_at).slice(0, 10) : '')
  if (!d) return true
  return d >= limit
}
