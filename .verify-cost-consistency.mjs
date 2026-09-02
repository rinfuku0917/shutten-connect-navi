// 読み取り専用の検証スクリプト。書き込みは一切しない。
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, cols, tweak = q => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999)
    q = tweak(q)
    const { data, error } = await q
    if (error) { console.log(`  [${table}] ERROR: ${error.message}`); return out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

// ---- 1. ブログ記事の実在確認 ----
const posts = await all('posts', '*')
console.log(`\n=== blog_posts: ${posts.length}件 ===`)
if (posts.length) console.log('カラム:', Object.keys(posts[0]).join(', '))
for (const p of posts) {
  const pub = p.published ?? p.status ?? p.is_published
  console.log(` ${String(pub).padEnd(10)} /blog/${p.slug}`)
}

const invite = posts.find(p => p.slug === 'how-to-invite-kitchen-car')
console.log('\n=== how-to-invite-kitchen-car ===')
if (!invite) {
  console.log('  DBに存在しない')
} else {
  const body = invite.content || invite.body || ''
  console.log('  存在する。published/status =', invite.published ?? invite.status)
  console.log('  本文長:', body.length)
  const hits = body.split('\n').filter(l => /3,?000|1万|10,?000|平日|出店料|常設|毎週|定期/.test(l))
  console.log('  --- 金額・頻度に触れる行 ---')
  hits.forEach(l => console.log('   |', l.trim().slice(0, 200)))
}
