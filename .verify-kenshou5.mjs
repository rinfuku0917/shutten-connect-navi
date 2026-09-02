import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const rows = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('posts').select('*').range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  rows.push(...data); if (data.length < 500) break
}
console.log('posts 全行:', rows.length)
console.log('列:', Object.keys(rows[0] || {}).join(', '))

for (const slug of ['renting-parking-space', 'food-truck-fee-guide', 'kitchen-car-required-documents']) {
  const p = rows.find(r => r.slug === slug)
  if (!p) { console.log(`\n### ${slug}: 見つからない`); continue }
  const body = p.content || p.body || p.markdown || ''
  console.log(`\n### ${slug}  published=${p.published} status=${p.status ?? '-'} 本文${body.length}字`)
  // 「110件」「48件」「97件」「51件」が本文のどこに出るか
  for (const kw of ['110件', '51件', '48件', '97件', '常設']) {
    const hits = [...body.matchAll(new RegExp(kw, 'g'))].map(m => m.index)
    console.log(`  「${kw}」 ${hits.length}回`)
    for (const i of hits) console.log('     …' + body.slice(Math.max(0, i - 60), i + 60).replace(/\n/g, '⏎'))
  }
}
