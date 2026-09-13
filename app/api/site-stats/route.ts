import { getSiteStats } from '../../lib/siteStats'

// サイトの「登録出店者数」「出店場所の数」を返す。トップと /vendor に出している数字と同じもの。
//
// なぜ要るか:
//   出店場所の数はサービスキーで数えるため、手元からは確かめられない。
//   トップで控えの値が出ていないかを、ここで確かめる（counted と reason）。
//   登録出店者数は数えずに app/lib/officialStats.json の値を返す（理由は siteStats.ts）。
//
// 返すのは件数だけで、個人の情報は含まない（どちらもトップに出している数字）。
// counted が false のときは控えの値なので、記事に使わないこと。

// 呼ばれるたびに数える。キャッシュすると、ビルドのときや失敗したときの控えの値が
// そのまま残り、「いま数えられるか」を確かめる役に立たない。件数だけを数える軽い問い合わせ
export const dynamic = 'force-dynamic'

export async function GET() {
  const stats = await getSiteStats()
  return Response.json(stats)
}
