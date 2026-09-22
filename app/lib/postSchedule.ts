// 記事の予約公開。
//
// posts.published_at（公開日）が未来の記事は、status='published' でも
// 公開日が来るまで公開側のどこにも出さない。
//
// 以前は未来の日付を受けていなかった。受けると、その日を待たずに
// 今日から一覧にも記事ページにも出てしまうため。
// 記事を1日1本ずつ出したいので、公開日が来るまで隠す仕組みにした。
//
// 公開側で posts を読む場所は、どこも次の2つのどちらかで絞ること。
//   - 問い合わせ: .or(visiblePostsFilter(nowIso))
//   - 取ってきた1件: isPostVisible(post.published_at, nowIso)
// 使っている場所: app/blog/page.tsx, app/blog/[slug]/page.tsx,
//   app/blog/category/host/page.tsx, app/page.tsx, app/sitemap.ts,
//   app/api/posts/route.ts（GET の all でない方）
//
// 時刻の比較は UTC の ISO 文字列と DB の timestamptz で行う。
// どちらも絶対時刻なので、日本時間で表示していてもずれは出ない
// （日本時間に直すのは、画面の入力と表示のときだけ）。
//
// 公開日が来てから画面に出るまでの遅れは、各ページの revalidate で決まる
// （記事ページと /blog は60秒、トップと /blog/category/host は600秒、サイトマップは3600秒）。
// 期限切れ後の最初の1回は古い版を返し、裏で作り直す（ISR の仕様）ので、
// 実際には「期限＋次に人が来るまで」遅れる。
// 公開日前に記事ページを開かれて 404 が作られていても、同じ60秒で作り直される。

/** 予約できる先の上限（日数）。打ち間違いで 3026 年のような日付にならないように */
export const POST_SCHEDULE_MAX_DAYS = 366

/**
 * 公開してよい記事だけに絞る .or() の条件。
 *
 * published_at が空の公開記事は、これまでどおり出す
 * （API は公開時に必ず日時を入れるが、SQL で直接公開したものに空が残りうる）。
 * nowIso は new Date().toISOString() の形（末尾 Z）を渡す。
 * `,` `(` `)` を含まないので .or() の区切りを壊さない。
 */
export function visiblePostsFilter(nowIso: string): string {
  return `published_at.is.null,published_at.lte.${nowIso}`
}

/** 取ってきた記事が、いま公開してよいか（公開日が今以前、または空） */
export function isPostVisible(publishedAt: string | null | undefined, nowIso: string): boolean {
  if (!publishedAt) return true
  const t = new Date(publishedAt).getTime()
  // 読めない日付は、表示側の既定（出す）に倒さず隠す。壊れた値で先に出るよりよい
  if (isNaN(t)) return false
  return t <= new Date(nowIso).getTime()
}

/** status='published' かつ公開日が未来＝予約中か */
export function isScheduledPost(status: string, publishedAt: string | null | undefined, nowIso: string): boolean {
  return status === 'published' && !!publishedAt && !isPostVisible(publishedAt, nowIso)
}

export type PublishedAtPick =
  | { ok: true; iso: string | null }
  | { ok: false; error: string }

/**
 * 運営が指定した公開日を、保存できる形に直す。
 *
 * 画面からは datetime-local の「2026-09-21T14:30」で来る（タイムゾーンなし）。
 * サイトの日付は日本時間で出しているので、+09:00 として読む。
 * 空欄は { ok: true, iso: null }（呼び出し側が保存した時刻などを入れる）。
 * 未来の日付は予約公開として受ける。ただし POST_SCHEDULE_MAX_DAYS 日先まで。
 *
 * 読めない日付・上限を超えた日付を黙って「今」に置き換えない。
 * 置き換えると、予約したつもりの記事が今すぐ公開されてしまう。
 */
export function pickPublishedAt(input: unknown, nowIso: string): PublishedAtPick {
  if (input == null) return { ok: true, iso: null }
  if (typeof input !== 'string') return { ok: false, error: '公開日の形式が正しくありません' }
  const s = input.trim()
  if (!s) return { ok: true, iso: null }
  // 日付だけ（2026-09-21）なら朝9時、分まであれば その時刻を日本時間として読む
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T09:00:00+09:00'
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) ? s + '+09:00'
    : s
  const t = new Date(iso)
  if (isNaN(t.getTime())) return { ok: false, error: '公開日の形式が正しくありません' }
  const limit = new Date(nowIso).getTime() + POST_SCHEDULE_MAX_DAYS * 24 * 60 * 60 * 1000
  if (t.getTime() > limit) {
    return { ok: false, error: `公開日は${POST_SCHEDULE_MAX_DAYS}日先までにしてください（${fmtScheduleJst(t.toISOString(), nowIso)} が指定されました）` }
  }
  return { ok: true, iso: t.toISOString() }
}

/**
 * 予約の日時を日本時間で短く出す（例「9/25 10:00」。年が今年でなければ「2027/1/5 10:00」）。
 * 端末の時計・タイムゾーンに左右されないよう Asia/Tokyo を指定する。
 */
export function fmtScheduleJst(iso: string, nowIso: string): string {
  const parts = (d: Date) => Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Tokyo', year: 'numeric', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(d).map(p => [p.type, p.value]),
  )
  const t = new Date(iso)
  if (isNaN(t.getTime())) return ''
  const p = parts(t)
  const nowYear = parts(new Date(nowIso)).year
  const md = `${p.month}/${p.day} ${p.hour}:${p.minute}`
  return p.year === nowYear ? md : `${p.year}/${md}`
}
