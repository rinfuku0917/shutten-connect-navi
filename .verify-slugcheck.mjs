import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// 1000行制限を避けて全件取る
const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await db.from('posts')
    .select('id, slug, title, status, category, published_at, created_at')
    .order('created_at', { ascending: true })
    .range(from, from + 499)
  if (error) { console.error('ERR', error.message); break }
  rows.push(...data)
  if (data.length < 500) break
}

console.log('=== posts 総数（anonで見える範囲） ===', rows.length)
console.log('status内訳:', rows.reduce((a, r) => (a[r.status] = (a[r.status] || 0) + 1, a), {}))
console.log('\n=== 全記事 ===')
for (const r of rows) {
  console.log([r.status.padEnd(9), (r.slug || '').padEnd(42), r.category, '|', r.title].join(' '))
}

// TOPICS の slug（main tree の route.ts から機械的に抽出）
const src = fs.readFileSync('app/api/cron/blog/route.ts', 'utf8')
const block = src.slice(src.indexOf('const TOPICS'), src.indexOf('\n]', src.indexOf('const TOPICS')))
const topics = [...block.matchAll(/\{ slug: '([^']+)', cat: '([^']+)', theme: '([^']+)' \}/g)]
  .map(m => ({ slug: m[1], cat: m[2], theme: m[3] }))

const usedSlugs = new Set(rows.map(r => r.slug))
console.log('\n=== TOPICS を上から順に、新ロジックで判定 ===')
console.log('TOPICS件数:', topics.length)
let order = 0
for (const t of topics) {
  const hit = usedSlugs.has(t.slug)
  if (!hit) order++
  console.log(`${hit ? 'ある(skip)' : `ない(${order}番目に生成される)`}  ${t.slug.padEnd(30)} ${t.theme.slice(0, 30)}`)
}

const missing = topics.filter(t => !usedSlugs.has(t.slug))
console.log('\n新ロジックで「未執筆」と判定されるテーマ数:', missing.length, '/', topics.length)
console.log('うち、DBに似た内容の記事が既にありそうなもの（人手確認用）:')
for (const t of missing) console.log('  -', t.slug, '|', t.theme)
