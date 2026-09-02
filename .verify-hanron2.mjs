import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data: posts } = await sb.from('posts').select('*').range(0, 999)
const A = posts.find(p => p.slug === 'kitchen-car-business-license')
const B = posts.find(p => p.slug === 'kitchen-car-required-documents')

// === 1. 「必要書類」というリテラル文字列は本当に両方のタイトルに入っているか ===
console.log('=== リテラル「必要書類」の有無 ===')
for (const [n, p] of [['A', A], ['B', B]]) {
  console.log(`  ${n} title    : 必要書類=${p.title.includes('必要書類')}  必要な書類=${p.title.includes('必要な書類')}`)
  console.log(`      ${p.title}`)
  console.log(`  ${n} meta     : 必要書類=${p.meta_description.includes('必要書類')}  必要な書類=${p.meta_description.includes('必要な書類')}`)
  console.log(`  ${n} excerpt  : 必要書類=${p.excerpt.includes('必要書類')}  必要な書類=${p.excerpt.includes('必要な書類')}`)
  console.log(`  ${n} content  : 必要書類=${(p.content.match(/必要書類/g)||[]).length}回  必要な書類=${(p.content.match(/必要な書類/g)||[]).length}回`)
}

// === 2. タイトルにキーワード構成語が入っているか（食い合いの実態）===
console.log('\n=== タイトル内のクエリ構成語 ===')
for (const w of ['キッチンカー', '出店', '必要', '書類', '営業許可', '保健所', '取り方', '審査']) {
  console.log(`  ${w.padEnd(8)} A:${A.title.includes(w) ? '○' : '×'}  B:${B.title.includes(w) ? '○' : '×'}`)
}

// === 3. 別方式の重なり測定（3-gram Jaccard・見出し語の共有）===
const norm = s => s.replace(/[#*\-|\n\s、。「」（）()]/g, '')
const grams = (s, n) => { const g = new Set(); const t = norm(s); for (let i = 0; i + n <= t.length; i++) g.add(t.slice(i, i + n)); return g }
for (const n of [3, 5, 8]) {
  const ga = grams(A.content, n), gb = grams(B.content, n)
  const inter = [...ga].filter(x => gb.has(x)).length
  console.log(`\n  ${n}-gram Jaccard = ${(inter / (ga.size + gb.size - inter) * 100).toFixed(2)}%  (共有 ${inter} / A ${ga.size} / B ${gb.size})`)
}
// 共有された長い8-gram＝実際に重複している言い回し
const g8a = grams(A.content, 12), g8b = grams(B.content, 12)
const shared = [...g8a].filter(x => g8b.has(x))
console.log('\n  12文字以上そのまま重なる箇所の数:', shared.length)
console.log('  例:', shared.slice(0, 8))

// === 4. A の全文（内部リンク・出店への言及を確認）===
console.log('\n########## A 全文 ##########\n' + A.content)
