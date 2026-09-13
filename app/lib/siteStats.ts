import { createClient } from '@supabase/supabase-js'

// サイトに出す「登録出店者数」「出店場所の数」。**サーバー専用**（サービスキーを読む）。
//
// なぜ要るか:
//   トップの「登録出店者 3,521」と /vendor の「現在 3,521 店舗」が手書きで、
//   実数と照らす手段が無かった。出店者は増え続けるので、手書きの数字はすぐ古くなる。
//   記事の数字（scripts/blog-metrics.mjs）と違って点検の対象にも入っていなかった。
//   ページを作り直すたびにデータベースから数える。
//
// 数えられなかったとき（鍵が無い・通信の失敗）は、最後に手で確かめた値を出す。
// 0 や空欄を出すより、少し古い数字のほうが害が小さい。

import OFFICIAL from './officialStats.json'

// 登録出店者数は、データベースを数えずに営業資料の数字（officialStats.json）を出す。
//
//   2026-09-13 に /api/site-stats で確かめたところ、profiles の出店者は 3,521 の半分にも
//   届かず、トップにはずっと控えの値が出ていた。3,521 は営業資料の数字で、
//   このサービスのデータベースに入っている会員だけの数ではない。
//   運営の判断で、サイトと記事はこの数字に揃えることにした。
//   数えた値に切り替えると、表示が急に半分以下に下がるので、数えない。
//
// 出店場所の数は、これまでどおりデータベースから数える。
// 数えられないときは、最後に手で確かめた値を出す
const FALLBACK = { sellers: OFFICIAL.sellers, places: 301 }

// reason … 数えた値を使えなかった理由。画面には出さない。
//   /api/site-stats で確かめられるようにするため（2026-09-13、本番で控えの値が
//   出ていたのに、鍵が無いのか・読めないのか・少なすぎたのかが分からなかった）
export type SiteStatsReason = 'ok' | 'no-key' | 'places-error' | 'places-low' | 'exception'
export type SiteStats = { sellers: number; places: number; counted: boolean; reason: SiteStatsReason }

export async function getSiteStats(): Promise<SiteStats> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ...FALLBACK, counted: false, reason: 'no-key' }
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    // これまでに掲載した出店場所（募集終了を含む）。トップでは「◯+」と出す
    const p = await db.from('places').select('id', { count: 'exact', head: true }).eq('status', 'published')
    // 数えた値を使えるか。読めなかった、または手書きの値の半分を切っていたら使わない
    // （掲載は基本的に増える一方なので、半分を切るのは数え方か権限の異常）
    const okPlaces = !p.error && typeof p.count === 'number' && p.count >= FALLBACK.places / 2
    return {
      sellers: FALLBACK.sellers,
      places: okPlaces ? (p.count as number) : FALLBACK.places,
      // 出店場所の数を実際に数えられたときだけ true（登録出店者数は数えない決まり）
      counted: okPlaces,
      reason: p.error ? 'places-error' : !okPlaces ? 'places-low' : 'ok',
    }
  } catch {
    return { ...FALLBACK, counted: false, reason: 'exception' }
  }
}
