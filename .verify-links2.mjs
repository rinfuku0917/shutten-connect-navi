import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const out = []
for (let f = 0; ; f += 500) {
  const { data } = await sb.from('posts').select('slug,title,status,content').range(f, f + 499)
  out.push(...data); if (data.length < 500) break
}

// 手法2: markdown構文を一切見ず、"/blog/" の文字列を素朴に全部数える
console.log('=== 手法2: 本文中の "/blog/" 出現を素で全部拾う ===')
let total = 0
for (const p of out) {
  const hits = [...(p.content || '').matchAll(/\/blog\/([^\s)"'\]<>,。、）]*)/g)].map(m => m[1])
  if (hits.length) { console.log(` ${p.slug} (${p.status}) => ${hits.join(', ')}`); total += hits.length }
}
console.log('合計リンク出現:', total)

// 手法3: ローカル原稿 .md との突き合わせ
console.log('\n=== 手法3: docs/blog/*.md 原稿の /blog/ リンク ===')
for (const f of fs.readdirSync('docs/blog').filter(f => f.endsWith('.md') && !f.includes('previous') && f !== 'TEMPLATE.md')) {
  const md = fs.readFileSync('docs/blog/' + f, 'utf8')
  const hits = [...md.matchAll(/\/blog\/([^\s)"'\]<>,。、）]*)/g)].map(m => m[1])
  console.log(` ${f}: ${hits.length ? hits.join(', ') : '(なし)'}`)
}

// DB と原稿の差分（リンクだけ）
console.log('\n=== DB と原稿でリンクが食い違う記事 ===')
for (const f of fs.readdirSync('docs/blog').filter(f => f.endsWith('.md') && !f.includes('previous') && f !== 'TEMPLATE.md')) {
  const slug = f.replace(/\.md$/, '')
  const p = out.find(x => x.slug === slug)
  if (!p) { console.log(` ${slug}: DBに無し（下書き or 未投入）`); continue }
  const a = [...fs.readFileSync('docs/blog/' + f, 'utf8').matchAll(/\/blog\/([^\s)"'\]<>,。、）]*)/g)].map(m => m[1]).sort().join('|')
  const b = [...(p.content || '').matchAll(/\/blog\/([^\s)"'\]<>,。、）]*)/g)].map(m => m[1]).sort().join('|')
  console.log(` ${slug}: ${a === b ? '一致' : `不一致\n   原稿:${a}\n   DB  :${b}`}`)
}

// FG が「探し方」に言及しているか（リンクなしの断り書きがないか）
console.log('\n=== food-truck-fee-guide 内の「探し方 / 場所を探す」言及 ===')
const fg = out.find(p => p.slug === 'food-truck-fee-guide')
for (const m of (fg.content || '').matchAll(/[^\n]*(探し方|探す|見つけ)[^\n]*/g)) console.log('  ', m[0].trim().slice(0, 180))

console.log('\n=== renting-parking-space 内の他記事リンク行 ===')
const rp = out.find(p => p.slug === 'renting-parking-space')
for (const m of (rp.content || '').matchAll(/[^\n]*\/blog\/[^\n]*/g)) console.log('  ', m[0].trim().slice(0, 200))

console.log('\n=== supermarket-food-truck 原稿の他記事リンク行 ===')
const sm = fs.readFileSync('docs/blog/supermarket-food-truck.md', 'utf8')
for (const m of sm.matchAll(/[^\n]*\/blog\/[^\n]*/g)) console.log('  ', m[0].trim().slice(0, 200))

// 孤立とされた記事が /blog 一覧から辿れるか（＝真の孤児か）の材料
console.log('\n=== 公開記事数と /blog のページング (PER_PAGE=10) ===')
const pub = out.filter(p => p.status === 'published')
console.log('公開:', pub.length, '→ /blog は', Math.ceil(pub.length / 10), 'ページ。全記事が一覧から1〜2クリックで到達可能')
