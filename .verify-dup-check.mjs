import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()])
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, cols, mod) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(cols).range(from, from + 999)
    if (mod) q = mod(q)
    const { data, error } = await q
    if (error) { console.error(table, 'ERR', error.message); break }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const posts = await all('posts', '*')
console.log('posts total rows:', posts.length)
console.log('columns:', Object.keys(posts[0] || {}).join(', '))
console.log('')
const statuses = {}
for (const p of posts) statuses[p.status] = (statuses[p.status]||0)+1
console.log('status counts:', JSON.stringify(statuses))
console.log('')
const rows = posts.map(p => ({
  slug: p.slug, status: p.status, cat: p.category,
  pub: (p.published_at||'').slice(0,10), created: (p.created_at||'').slice(0,10),
  len: (p.content||'').length, title: p.title,
}))
rows.sort((a,b) => (a.pub||'zz').localeCompare(b.pub||'zz'))
for (const r of rows) console.log([r.status.padEnd(9), (r.pub||'--').padEnd(10), String(r.len).padStart(5), (r.cat||'').padEnd(12), r.slug.padEnd(38), r.title].join(' | '))
