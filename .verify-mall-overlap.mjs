import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const OUT = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad'

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
console.log('カラム:', Object.keys(posts[0] ?? {}).join(', '))
console.log('---- slug | status | category | 本文長(raw) | title ----')
for (const p of posts.sort((a, b) => String(a.slug).localeCompare(String(b.slug)))) {
  console.log([
    p.slug,
    p.status ?? '',
    p.category ?? '',
    String(p.content ?? '').length,
    (p.title ?? ''),
  ].join(' | '))
}
fs.writeFileSync(`${OUT}/posts.json`, JSON.stringify(posts, null, 2))
for (const p of posts) {
  fs.writeFileSync(`${OUT}/db-${p.slug}.md`, `# ${p.title}\n\nstatus=${p.status} category=${p.category} published_at=${p.published_at} updated_at=${p.updated_at}\nexcerpt=${p.excerpt}\nmeta_description=${p.meta_description ?? ''}\n\n---\n\n${p.content ?? ''}`)
}
console.log('書き出し:', OUT)
