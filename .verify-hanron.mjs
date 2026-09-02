import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function fetchAll(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) { console.log('ERR', table, error.message); return out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const posts = await fetchAll('posts', '*')
const A = posts.find(p => p.slug === 'kitchen-car-business-license')
const B = posts.find(p => p.slug === 'kitchen-car-required-documents')

for (const [name, p] of [['A business-license', A], ['B required-documents', B]]) {
  console.log('\n##########', name)
  console.log('  status      :', p.status)
  console.log('  published_at:', p.published_at)
  console.log('  category    :', JSON.stringify(p.category))
  console.log('  target_kw   :', JSON.stringify(p.target_keyword))
  console.log('  title       :', p.title)
  console.log('  meta_desc   :', p.meta_description)
  console.log('  excerpt     :', p.excerpt)
  console.log('  content len :', p.content.length)
}

// --- 独自の重なり測定: 見出し単位 + 語の出現回数 ---
const headings = s => s.split('\n').filter(l => /^#{2,3} /.test(l)).map(l => l.trim())
console.log('\n=== A の見出し ===');  headings(A.content).forEach(h => console.log('  ' + h))
console.log('\n=== B の見出し ===');  headings(B.content).forEach(h => console.log('  ' + h))

const terms = ['営業許可', '保健所', '必要書類', '書類', 'PL保険', '損害賠償', '検体', '検便',
               '食品衛生責任者', '申請', '手数料', '費用', '応募', '審査', '設備', '車両', 'シンク', '給水']
console.log('\n=== 語の出現回数 (A=営業許可 / B=必要書類) ===')
console.log('  語'.padEnd(20), 'A', ' B')
for (const t of terms) {
  const ca = (A.content.match(new RegExp(t, 'g')) || []).length
  const cb = (B.content.match(new RegExp(t, 'g')) || []).length
  console.log('  ' + t.padEnd(18), String(ca).padStart(2), String(cb).padStart(3))
}

// --- 相互リンクの有無（本文中の /blog/ リンクを全部出す）---
const links = s => [...s.matchAll(/\]\((\/[^)]*)\)/g)].map(m => m[1])
console.log('\n=== A の内部リンク ==='); console.log('  ', JSON.stringify(links(A.content)))
console.log('=== B の内部リンク ==='); console.log('  ', JSON.stringify(links(B.content)))

// --- 他記事から2本へのリンク（回遊の実態）---
console.log('\n=== 他記事から business-license / required-documents へのリンク ===')
for (const p of posts) {
  const l = links(p.content).filter(u => /business-license|required-documents/.test(u))
  if (l.length) console.log(`  ${p.slug} [${p.status}] -> ${JSON.stringify(l)}`)
}

// --- A の本文で「必要書類」がどう使われているか（前後の文脈）---
console.log('\n=== A 本文中の「書類」周辺 ===')
for (const m of A.content.matchAll(/書類/g)) {
  console.log('  …' + A.content.slice(Math.max(0, m.index - 45), m.index + 45).replace(/\n/g, '⏎') + '…')
}
