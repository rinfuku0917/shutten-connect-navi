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

// 2026-09-13 時点でトップに手書きされていた値。数えられないときだけ使う
const FALLBACK = { sellers: 3521, places: 301 }

export type SiteStats = { sellers: number; places: number; counted: boolean }

export async function getSiteStats(): Promise<SiteStats> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return { ...FALLBACK, counted: false }
  try {
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
    const [s, p] = await Promise.all([
      // 登録している出店者。承認の前後を問わず、出店者として登録した数
      db.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller'),
      // これまでに掲載した出店場所（募集終了を含む）。トップでは「◯+」と出す
      db.from('places').select('id', { count: 'exact', head: true }).eq('status', 'published'),
    ])
    const sellers = s.error || typeof s.count !== 'number' ? FALLBACK.sellers : s.count
    const places = p.error || typeof p.count !== 'number' ? FALLBACK.places : p.count
    // 手書きの値より大きく減っていたら、数え方か権限の異常とみなして手書きの値を出す
    // （登録は基本的に増える一方なので、半分を切ることは普通は起きない）
    return {
      sellers: sellers < FALLBACK.sellers / 2 ? FALLBACK.sellers : sellers,
      places: places < FALLBACK.places / 2 ? FALLBACK.places : places,
      counted: !s.error && !p.error,
    }
  } catch {
    return { ...FALLBACK, counted: false }
  }
}
