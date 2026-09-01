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

// anon が draft を見られるのか確認
const { data: d, error: de } = await db.from('posts').select('slug,status').eq('status', 'draft')
console.log('anonで見えるdraft:', de ? 'ERR ' + de.message : d.length + '件', d?.map(x => x.slug) || '')

const { data: rows } = await db.from('posts').select('slug,title,content').range(0, 499)

// 駐車場2本の見出しを比べる
const heads = s => [...String(s || '').matchAll(/^#{2,3}\s*(.+)$/gm)].map(m => m[1].trim())
const a = rows.find(r => r.slug === 'auto-mtarczbg-37pazo')
const b = rows.find(r => r.slug === 'auto-mtgh64lh-jwwkxe')
console.log('\n=== 駐車場の2本を比べる ===')
for (const p of [a, b]) {
  console.log(`\n[${p.slug}] ${p.title}  (${p.content.length}字)`)
  heads(p.content).forEach(h => console.log('   ##', h))
}
const ha = new Set(heads(a.content)), hb = new Set(heads(b.content))
const common = [...ha].filter(h => hb.has(h))
console.log('\n完全一致する見出し:', common.length, '/', ha.size, 'と', hb.size)

// TOPICS 13件それぞれについて、既存記事にテーマが近いものがないか（見出し語の重なりで粗く見る）
const src = fs.readFileSync('app/api/cron/blog/route.ts', 'utf8')
const block = src.slice(src.indexOf('const TOPICS'), src.indexOf('\n]', src.indexOf('const TOPICS')))
const topics = [...block.matchAll(/\{ slug: '([^']+)', cat: '([^']+)', theme: '([^']+)' \}/g)].map(m => ({ slug: m[1], theme: m[3] }))

const KEY = ['営業許可', '保健所', '立地', '出店場所', '原価', '価格', 'メニュー', '駐車場', '定期開催', '曜日', 'イベント', '台数', '車両', '保険', 'リピーター', '設備', '電源', '選び方']
console.log('\n=== TOPICS と既存記事のテーマ重なり（キーワード一致で粗く） ===')
for (const t of topics) {
  const tk = KEY.filter(k => t.theme.includes(k))
  const hits = rows.filter(r => tk.length && tk.some(k => r.title.includes(k))).map(r => r.slug)
  console.log(`${t.slug.padEnd(30)} 語[${tk.join(',')}] → 既存で近そう: ${hits.join(', ') || '(なし)'}`)
}
