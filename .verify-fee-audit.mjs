import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const cols = 'id, title, prefecture, status, closed, fee, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, day_type_fees, schedule, place_type'

let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select(cols).range(from, from + 499)
  if (error) { console.error('ERR', error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 500) break
}

console.log('places rows fetched (anon visible):', all.length)
const statuses = {}
for (const p of all) statuses[`${p.status}|closed=${p.closed}`] = (statuses[`${p.status}|closed=${p.closed}`] || 0) + 1
console.log('status breakdown:', statuses)

const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('\n=== 公開中（published かつ closed でない）:', pub.length, '件 ===')

// ---- 分類 ----
const fixedOf = p => (p.price_fixed || 0) + (p.company_fixed_amount || 0)
const pctOf = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
const dtf = p => (p.day_type_fees && typeof p.day_type_fees === 'object') ? p.day_type_fees : null
const side = (p, k) => {
  const d = dtf(p); if (!d || !d[k]) return null
  const a = typeof d[k].placeFee === 'number' ? d[k].placeFee : null
  const b = typeof d[k].companyFee === 'number' ? d[k].companyFee : null
  if (a === null && b === null) return null
  return (a || 0) + (b || 0)
}
const schedDays = p => Array.isArray(p.schedule) ? p.schedule : []
const schedFeeDays = p => schedDays(p).filter(d => d && (typeof d.placeFee === 'number' || typeof d.companyFee === 'number'))

const cat = p => {
  const hasFixed = fixedOf(p) > 0 || side(p, 'weekday') !== null || side(p, 'weekend') !== null || schedFeeDays(p).length > 0
  const hasPct = pctOf(p) > 0
  if (hasFixed && hasPct) return '併用'
  if (hasFixed) return '固定'
  if (hasPct) return '歩合'
  return '応相談'
}

const counts = {}
for (const p of pub) counts[cat(p)] = (counts[cat(p)] || 0) + 1
console.log('\n--- 決め方の分類（自前集計） ---')
console.log(counts)

// ---- 料率分布 ----
const rate = {}
for (const p of pub) { const r = pctOf(p); if (r > 0) rate[r] = (rate[r] || 0) + 1 }
console.log('\n--- 歩合の料率分布 ---', rate, '合計', Object.values(rate).reduce((a, b) => a + b, 0))

// ---- 平日・週末の固定額を取り出す ----
// 平日額: day_type_fees.weekday があればそれ。無ければ案件全体の固定額。
// 週末額: day_type_fees.weekend があればそれ。無ければ案件全体の固定額。
// schedule に日ごとの金額がある案件はその幅も見る。
function weekdayAmt(p) {
  const s = side(p, 'weekday'); if (s !== null) return s
  const f = fixedOf(p); return f > 0 ? f : null
}
function weekendAmt(p) {
  const s = side(p, 'weekend'); if (s !== null) return s
  const f = fixedOf(p); return f > 0 ? f : null
}
const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; if (!n) return null; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
const summarize = (label, arr) => {
  console.log(`${label}: 件数 ${arr.length} / 中央値 ${med(arr)} / 最低 ${Math.min(...arr)} / 最高 ${Math.max(...arr)}`)
  const dist = {}; for (const v of arr) dist[v] = (dist[v] || 0) + 1
  console.log('   分布:', Object.entries(dist).sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}:${v}`).join(' '))
}

for (const [mode, filt] of [
  ['【A】固定額を持つ全案件（固定＋併用）', p => true],
  ['【B】純粋な固定制のみ（併用を除く）', p => cat(p) === '固定'],
  ['【C】併用のみ', p => cat(p) === '併用'],
]) {
  console.log(`\n=== ${mode} ===`)
  const set = pub.filter(filt)
  const wd = set.map(weekdayAmt).filter(v => v !== null)
  const we = set.map(weekendAmt).filter(v => v !== null)
  if (wd.length) summarize('  平日', wd)
  if (we.length) summarize('  週末・祝日', we)
}

// ---- schedule 由来の日ごと金額も含めた別数え方 ----
console.log('\n=== 参考: schedule に日ごと金額を持つ案件 ===')
const schedPlaces = pub.filter(p => schedFeeDays(p).length > 0)
console.log('件数:', schedPlaces.length)
for (const p of schedPlaces) {
  const t = schedFeeDays(p).map(d => (d.placeFee || 0) + (d.companyFee || 0))
  console.log(' -', p.title, '| cat=', cat(p), '| 日ごと:', [...new Set(t)].join(','), '| 全体固定:', fixedOf(p), '| pct:', pctOf(p))
}

console.log('\n=== 参考: day_type_fees を持つ案件 ===')
const dtfPlaces = pub.filter(p => side(p, 'weekday') !== null || side(p, 'weekend') !== null)
console.log('件数:', dtfPlaces.length)
const dtfPairs = {}
for (const p of dtfPlaces) {
  const k = `平日${side(p, 'weekday')}/週末${side(p, 'weekend')} cat=${cat(p)}`
  dtfPairs[k] = (dtfPairs[k] || 0) + 1
}
console.log(dtfPairs)

// ---- 併用9件の中身 ----
console.log('\n=== 併用の案件 ===')
for (const p of pub.filter(p => cat(p) === '併用')) {
  console.log(' -', p.title, '| 固定:', fixedOf(p), '| 平日:', weekdayAmt(p), '| 週末:', weekendAmt(p), '| pct:', pctOf(p), '| unit:', p.place_fixed_unit, p.company_fixed_unit, '| fee欄:', JSON.stringify(p.fee))
}

// ---- per_event 単位のもの ----
console.log('\n=== 参考: place_fixed_unit / company_fixed_unit の分布（固定額>0のもの） ===')
const units = {}
for (const p of pub.filter(p => fixedOf(p) > 0)) {
  const k = `${p.place_fixed_unit}/${p.company_fixed_unit}`
  units[k] = (units[k] || 0) + 1
}
console.log(units)
