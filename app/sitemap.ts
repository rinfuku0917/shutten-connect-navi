import type { MetadataRoute } from 'next'
import { createClient } from '@supabase/supabase-js'
import { SITE_URL } from './lib/seo'

// Google に「このサイトにはどのページがあるか」を伝える一覧。
//
// 案件の詳細ページ（/places/[id]）は、一覧ページからのリンクが
// JavaScript の実行後にしか出てこない。そのため、ここに載せないと
// 300件以上ある案件ページが Google に見つけてもらえない。
//
// 1時間ごとに作り直す。案件が増えても自動で載る。

export const revalidate = 3600

// Supabase の1回の取得は既定で1000件までなので、それを超える分は分けて取る
const CHUNK = 1000

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// 日付として使えないものは undefined にして、lastModified を省く
function when(...vals: unknown[]): Date | undefined {
  for (const v of vals) {
    if (typeof v !== 'string' || !v) continue
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return undefined
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  // 静的ページの更新日。毎回の生成時刻を入れると「毎時更新」と誤って伝わるので、
  // 実際に手を入れたときだけここを変える。
  const STATIC_UPDATED = new Date('2026-09-01T00:00:00Z')

  // ログインしなくても見られるページだけを載せる
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/vendor`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/vendor/event`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/vendor/cost`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/vendor/area/tokyo`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/saitama`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/kanagawa`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/chiba`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/ibaraki`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/osaka`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/vendor/area/gunma`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/vendor/area/tochigi`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/vendor/area/hyogo`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/places`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/sellers`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/space`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/sell`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/company`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const db = client()
  // 環境変数が無いときでも静的ページだけは返す（ビルドを落とさない）
  if (!db) return staticPages

  const urls: MetadataRoute.Sitemap = []

  try {
    // 公開中の案件
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await db
        .from('places')
        .select('id, posted_at, created_at, closed_at')
        .eq('status', 'published')
        // 募集終了した案件は載せない。応募できないページに検索から人を送らないため
        .eq('closed', false)
        .range(from, from + CHUNK - 1)
      if (error || !data || data.length === 0) break
      for (const p of data) {
        if (!p.id) continue
        urls.push({
          url: `${SITE_URL}/places/${p.id}`,
          lastModified: when(p.posted_at, p.created_at) ?? now,
          changeFrequency: 'weekly',
          priority: 0.7,
        })
      }
      if (data.length < CHUNK) break
    }

    // 公開中の記事
    {
      const { data } = await db
        .from('posts')
        .select('slug, updated_at, published_at')
        .eq('status', 'published')
      for (const p of data || []) {
        if (!p.slug) continue
        urls.push({
          url: `${SITE_URL}/blog/${p.slug}`,
          lastModified: when(p.updated_at, p.published_at) ?? now,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    }

    // 掲載を承認した出店者
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await db
        .from('profiles')
        .select('id, created_at')
        .eq('role', 'seller')
        .eq('approval_status', 'approved')
        .range(from, from + CHUNK - 1)
      if (error || !data || data.length === 0) break
      for (const s of data) {
        if (!s.id) continue
        urls.push({
          url: `${SITE_URL}/sellers/${s.id}`,
          lastModified: when(s.created_at) ?? now,
          changeFrequency: 'monthly',
          priority: 0.5,
        })
      }
      if (data.length < CHUNK) break
    }
  } catch {
    // 取得に失敗しても、静的ページ分のサイトマップは返す
    return staticPages
  }

  return [...staticPages, ...urls]
}
