import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all = []
for (let f = 0; ; f += 500) { const { data } = await sb.from('places').select('*').range(f, f + 499); all = all.concat(data); if (data.length < 500) break }
const pub = all.filter(p => p.status === 'published' && !p.closed)
const z2h = s => (s || '').replace(/[Ａ-Ｚａ-ｚ０-９％＋（）]/g, c => ({ '％': '%', '＋': '+', '（': '(', '）': ')' }[c] || String.fromCharCode(c.charCodeAt(0) - 0xFEE0)))
const pctCol = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
const pctText = p => { const m = [...z2h(p.fee || '').matchAll(/(\d{1,2})\s*%/g)]; return m.length ? +m[0][1] : null }
const pctOf = p => pctCol(p) > 0 ? pctCol(p) : (pctText(p) ?? 0)
const shares = pub.filter(p => pctOf(p) > 0)

// 会場コア名（記号・日付・修飾語を除去）
const core = s => z2h(s).replace(/【[^】]*】/g, '').replace(/\([^)]*\)/g, '').replace(/[（][^）]*[）]/g, '')
  .replace(/[0-9]{1,2}\/[0-9]{1,2}/g, '').replace(/[\s　]/g, '')
  .replace(/(学内ランチ出店|学内キッチンカー出店|キッチンカー出店|学内出店|ランチ出店|出店|スケジュール|空き曜日|案内可能|オープンキャンパス|イベント|\d月|毎週.*)+$/g, '')
  .replace(/[／\/].*$/, '').replace(/[・、,]+$/, '')

// 「同一会場 かつ 同一料率」でのみ束ねる（別料率＝別機会として残す）
const key = p => core(p.title) + '#' + pctOf(p)
const g = new Map()
for (const p of shares) { const k = key(p); if (!g.has(k)) g.set(k, []); g.get(k).push(p) }

const before = {}; for (const p of shares) before[pctOf(p)] = (before[pctOf(p)] || 0) + 1
const after = {}; for (const [k, v] of g) { const r = pctOf(v[0]); after[r] = (after[r] || 0) + 1 }
const sum = o => Object.values(o).reduce((a, b) => a + b, 0)

console.log('=== 束ねたグループ（同一会場×同一料率が2件以上）===')
let removed = 0
for (const [k, v] of [...g].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length)) {
  console.log(` [${v.length}→1] ${k}`); v.forEach(p => console.log(`      ${p.place_type} | ${p.title} | ${p.fee}`))
  removed += v.length - 1
}
console.log(`\n束ねて消えた件数: ${removed}`)
console.log('名寄せ前:', before, '母数', sum(before), `10%=${(100 * before[10] / sum(before)).toFixed(1)}%`)
console.log('名寄せ後:', after, '母数', sum(after), `10%=${(100 * after[10] / sum(after)).toFixed(1)}%`)

// 記事の分母53で言い直すと
console.log(`\n記事の分母(53)基準に換算: 10%は 36→${36 - (before[10] - after[10])}件、53→${53 - removed}件 = ${(100 * (36 - (before[10] - after[10])) / (53 - removed)).toFixed(1)}%`)
