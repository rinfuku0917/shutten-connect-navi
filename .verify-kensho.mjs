import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) { console.log('ERR', table, error.message); return out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const posts = await all('posts', '*')
console.log('=== posts total:', posts.length)
console.log('columns:', posts.length ? Object.keys(posts[0]).join(', ') : '(none)')
for (const p of posts) {
  console.log([
    p.slug,
    'status=' + p.status,
    'pub=' + (p.published_at ?? '-'),
    'kw=' + JSON.stringify(p.target_keyword ?? null),
    'cat=' + JSON.stringify(p.category ?? null),
    'len=' + (p.content ? p.content.length : 0),
    'title=' + (p.title ?? '').slice(0, 40),
  ].join(' | '))
}
