import { getSiteStats } from '../../lib/siteStats'

// サイトの「登録出店者数」「出店場所の数」を返す。トップと /vendor に出している数字と同じもの。
//
// なぜ要るか:
//   記事の数字は scripts/blog-metrics.mjs が数えるが、登録出店者（profiles）は
//   サービスキーが無いと数えられず、手元からは読めない。記事には公開中の出店者（1,386）
//   しか書けず、実際の登録数（3,000超）とずれていた。ここから同じ値を受け取る。
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
