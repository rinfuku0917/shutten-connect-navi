import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
const get = (k) => env.split('\n').find((l) => l.startsWith(k + '='))?.slice(k.length + 1).trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

async function all(table, cols, mod = (q) => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await mod(sb.from(table).select(cols).range(from, from + 999))
    if (error) { console.log(`  [${table}] error:`, error.message); return out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const posts = await all('posts', '*')
console.log('=== blog_posts:', posts.length, '件（匿名キーで見える範囲）')
for (const p of posts) {
  const body = p.content || p.body || ''
  console.log(`- slug=${p.slug} published=${p.published ?? p.status ?? '?'} updated=${p.updated_at ?? ''} len=${body.length}`)
}

const target = posts.find((p) => p.slug === 'kitchen-car-required-documents')
if (target) {
  const body = target.content || target.body || ''
  const md = fs.readFileSync(new URL('./docs/blog/kitchen-car-required-documents.md', import.meta.url), 'utf8')
  const mdBody = md.replace(/^---[\s\S]*?\n---\n/, '')
  console.log('\n=== DB本文とmd本文の一致:', body.trim() === mdBody.trim())
  const row = body.split('\n').filter((l) => /営業許可証|運転免許証/.test(l) && l.includes('|'))
  console.log('=== DB本文の該当行:')
  row.forEach((l) => console.log('   ', l))
} else {
  console.log('\n=== kitchen-car-required-documents は匿名キーでは取得できない（＝未公開の可能性）')
}

// 他記事に同種の年数表記がないか
for (const p of posts) {
  const body = p.content || p.body || ''
  const hits = body.split('\n').filter((l) => /営業許可.*(年|期限|有効期間)/.test(l))
  if (hits.length) {
    console.log(`\n=== ${p.slug} の営業許可に関する行:`)
    hits.forEach((l) => console.log('   ', l.slice(0, 200)))
  }
}
