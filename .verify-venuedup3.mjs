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
  const { data } = await sb.from('places').select('*').range(from, from + 499)
  all = all.concat(data); if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)
const z2h = s => (s || '').replace(/[Ａ-Ｚａ-ｚ０-９％＋（）]/g, c => ({ '％': '%', '＋': '+', '（': '(', '）': ')' }[c] || String.fromCharCode(c.charCodeAt(0) - 0xFEE0)))
const pctCol = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
const pctText = p => { const t = z2h(p.fee || ''); const m = [...t.matchAll(/(\d{1,2})\s*%/g)]; return m.length ? +m[0][1] : null }
const pctOf = p => pctCol(p) > 0 ? pctCol(p) : (pctText(p) ?? 0)

// 全歩合案件を列挙して手検算できるようにする
const shares = pub.filter(p => pctOf(p) > 0)
console.log('=== 歩合を含む案件 全リスト ===', shares.length, '件')
for (const p of shares.sort((a, b) => pctOf(a) - pctOf(b) || a.title.localeCompare(b.title)))
  console.log(`  ${String(pctOf(p)).padStart(2)}% | ${p.place_type.padEnd(7)} | ${p.title}  << ${p.fee}`)

// ---- 保守的な名寄せ: 住所が実質同一のものだけ束ねる ----
const na = s => z2h(s || '').replace(/[\s　\-−ー–—]/g, '').replace(/丁目|番地|号/g, '').replace(/\([^)]*\)/g, '')
const byAddr = new Map()
for (const p of shares) { const k = na(p.address); if (!k) continue; if (!byAddr.has(k)) byAddr.set(k, []); byAddr.get(k).push(p) }
console.log('\n=== 保守的名寄せ（正規化住所が完全一致するものだけ）===')
let consExtra = 0, cons10 = 0
for (const [k, v] of [...byAddr].filter(([, v]) => v.length > 1).sort((a, b) => b[1].length - a[1].length)) {
  console.log(` [${v.length}件] addr=${k}`)
  for (const p of v) console.log(`     ${pctOf(p)}% ${p.place_type} | ${p.title}`)
  consExtra += v.length - 1
  cons10 += v.filter(p => pctOf(p) === 10).length - (v.some(p => pctOf(p) === 10) ? 1 : 0)
}
console.log(`保守的な余剰: ${consExtra}件 / うち10%の余剰: ${cons10}件`)
const r0 = {}; for (const p of shares) r0[pctOf(p)] = (r0[pctOf(p)] || 0) + 1
console.log('名寄せ前:', r0, '10%割合', (100 * r0[10] / shares.length).toFixed(1) + '%')
console.log(`保守的名寄せ後: 10%=${r0[10] - cons10} 母数=${shares.length - consExtra} → ${(100 * (r0[10] - cons10) / (shares.length - consExtra)).toFixed(1)}%`)
