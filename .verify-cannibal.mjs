// 食い合い検証用（読み取りのみ）
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

async function all(table, cols = '*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const posts = await all('posts')
console.log('posts 総数:', posts.length)
console.log('列:', Object.keys(posts[0] ?? {}).join(', '))
console.log()
const rows = posts.map(p => ({
  slug: p.slug, status: p.status, title: p.title,
  cat: p.category, len: String(p.content ?? '').length,
  updated: String(p.updated_at ?? p.created_at ?? '').slice(0, 10),
}))
rows.sort((a, b) => String(a.slug).localeCompare(String(b.slug)))
for (const r of rows) console.log(`${r.status.padEnd(10)} ${String(r.slug).padEnd(42)} ${String(r.cat ?? '-').padEnd(14)} ${String(r.len).padStart(6)}字 ${r.updated}  ${r.title}`)

fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts.json', JSON.stringify(posts, null, 1))
console.log('\n-> posts.json に保存')
