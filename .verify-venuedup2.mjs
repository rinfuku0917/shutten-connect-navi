import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data); if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)

const z2h = s => (s || '').replace(/[Ａ-Ｚａ-ｚ０-９％＋（）]/g, c => {
  const m = { '％': '%', '＋': '+', '（': '(', '）': ')' }
  return m[c] || String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
})

// ---- 料率をテキストから拾う（構造化カラム優先、無ければ fee 文言） ----
const pctCol = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
function pctText(p) {
  const t = z2h(p.fee || '')
  const m = [...t.matchAll(/(\d{1,2})\s*%/g)].map(x => +x[1])
  // 「+税」の税率(8/10)を料率と誤認しないよう、税の直前の数字は除外
  const clean = [...t.matchAll(/(\d{1,2})\s*%/g)].filter(x => !/^\s*(の)?税/.test(t.slice(x.index + x[0].length))).map(x => +x[1])
  return (clean.length ? clean : m)[0] ?? null
}
const pctOf = p => pctCol(p) > 0 ? pctCol(p) : (pctText(p) ?? 0)

const rateTally = arr => { const r = {}; for (const p of arr) { const v = pctOf(p); if (v > 0) r[v] = (r[v] || 0) + 1 } return r }
const show = (label, r) => { const t = Object.values(r).reduce((a, b) => a + b, 0)
  console.log(`${label}: ${JSON.stringify(r)} 母数=${t} 10%=${r[10] || 0} (${(100 * (r[10] || 0) / t).toFixed(1)}%)`) }

console.log('公開中:', pub.length)
show('\n【名寄せ前】料率', rateTally(pub))

// ---- 会場名の正規化（強め）: 【】/() を落とし、日付・修飾語を落とす ----
const stripDeco = s => z2h(s)
  .replace(/【[^】]*】/g, '')
  .replace(/\([^)]*\)/g, '')
  .replace(/[0-9]{1,2}\/[0-9]{1,2}/g, '')
  .replace(/[\s　]/g, '')
const TAIL = /(学内ランチ出店|学内キッチンカー出店|キッチンカー出店|学内出店|ランチ出店|出店|スケジュール|空き曜日|案内可能|学園祭|文化祭|学祭|オープンキャンパス|イベント|\d月|毎週.*)+$/g
const core = s => stripDeco(s).replace(/[／\/].*$/, '').replace(TAIL, '').replace(/[・、,]+$/, '')

// グループ化: core が一致、または一方が他方を包含
const items = pub.map(p => ({ p, c: core(p.title) })).filter(x => x.c.length >= 3)
const parent = new Map()
const find = x => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x) } return x }
for (const it of items) parent.set(it.p.id, it.p.id)
for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
  const a = items[i].c, b = items[j].c
  if (a === b || (a.length >= 5 && b.length >= 5 && (a.includes(b) || b.includes(a)))) {
    const ra = find(items[i].p.id), rb = find(items[j].p.id); if (ra !== rb) parent.set(ra, rb)
  }
}
const groups = new Map()
for (const it of items) { const r = find(it.p.id); if (!groups.has(r)) groups.set(r, []); groups.get(r).push(it.p) }
const dups = [...groups.values()].filter(v => v.length > 1).sort((a, b) => b.length - a.length)

console.log('\n=== 会場重複グループ（2件以上） ===')
let extra = 0
for (const v of dups) {
  const rates = v.map(p => pctOf(p))
  console.log(` [${v.length}件] ${core(v[0].title)}  料率=${rates.join('/')}`)
  for (const p of v) console.log(`     type=${p.place_type} pct=${pctOf(p)} fee=${JSON.stringify(p.fee)} | ${p.title}`)
  extra += v.length - 1
}
console.log(`\n重複グループ ${dups.length} / 余剰件数(名寄せで消える数) ${extra}`)

// ---- 名寄せ後の料率分布 ----
const dedup = []
for (const [, v] of groups) {
  const c = {}; for (const p of v) { const r = pctOf(p); if (r > 0) c[r] = (c[r] || 0) + 1 }
  if (!Object.keys(c).length) { dedup.push(v[0]); continue }
  const best = +Object.entries(c).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
  dedup.push(v.find(p => pctOf(p) === best))
}
show('\n【会場名寄せ後】料率', rateTally(dedup))

// ---- 記事本文の他の箇所に「同じ会場」への断りがあるか ----
const md = fs.readFileSync(new URL('./docs/blog/food-truck-fee-guide.md', import.meta.url), 'utf8')
console.log('\n=== 本文中の「注意書き」候補行 ===')
md.split('\n').forEach((l, i) => {
  if (/同じ|重複|名寄せ|まとめて|運営会社|複数|含まれ|注意/.test(l) && l.trim()) console.log(`  L${i + 1}: ${l.trim()}`)
})
