import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync(new URL('./.verify-donki-dump.json', import.meta.url), 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)
const donki = rows.find(r => /高井戸/.test(r.title || ''))

const has = s => !!s && (typeof s.placeFee === 'number' || typeof s.companyFee === 'number')
const sum = s => (typeof s.placeFee === 'number' ? s.placeFee : 0) + (typeof s.companyFee === 'number' ? s.companyFee : 0)
const dtfOf = r => (r.day_type_fees && typeof r.day_type_fees === 'object') ? r.day_type_fees : null

function fixedPair(r, donkiWeekendOverride) {
  const d = dtfOf(r)
  const wd0 = (r.price_fixed || 0) + (r.company_fixed_amount || 0)
  let wd = wd0, we = wd0
  if (d) {
    if (has(d.weekday)) wd = sum(d.weekday)
    if (has(d.weekend)) we = sum(d.weekend)
  }
  if (donkiWeekendOverride != null && r.id === donki.id) we = donkiWeekendOverride
  return { wd, we }
}
const pct = r => (r.price_share_pct || 0) + (r.company_share_pct || 0)
const hasFixed = r => {
  const d = dtfOf(r)
  if (d && (has(d.weekday) || has(d.weekend))) return true
  return ((r.price_fixed || 0) + (r.company_fixed_amount || 0)) > 0
}

const regular = pub.filter(r => r.place_type === 'regular')
const kinds = { 固定: [], 歩合: [], 併用: [], 応相談: [] }
for (const r of pub) {
  const f = hasFixed(r), p = pct(r) > 0
  const k = f && p ? '併用' : f ? '固定' : p ? '歩合' : '応相談'
  kinds[k].push(r)
}
console.log('全110件の分類:', Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.length])))
console.log('常設だけ:', Object.fromEntries(Object.entries(kinds).map(([k, v]) => [k, v.filter(r => r.place_type === 'regular').length])))

const fixedRegular = kinds['固定'].filter(r => r.place_type === 'regular')
console.log('\n固定制の常設案件:', fixedRegular.length, '件（記事は48件と書いている）')

const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
function report(ov, label) {
  const wd = [], we = []
  for (const r of fixedRegular) { const p = fixedPair(r, ov); wd.push(p.wd); we.push(p.we) }
  const mode = a => Object.entries(a.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {})).sort((x, y) => y[1] - x[1]).slice(0, 4)
  console.log(`\n[${label}]`)
  console.log('  平日: 中央値', med(wd), '最低', Math.min(...wd), '最高', Math.max(...wd), '| 多い順', JSON.stringify(mode(wd)))
  console.log('  週末: 中央値', med(we), '最低', Math.min(...we), '最高', Math.max(...we), '| 多い順', JSON.stringify(mode(we)))
}
report(null, 'day_type_fees のまま（高井戸 週末8,000）')
report(7500, 'fee本文どおり（高井戸 週末7,500）')

// 週末の上位・下位を確認
const weAll = fixedRegular.map(r => ({ t: r.title, ...fixedPair(r, null) })).sort((a, b) => b.we - a.we)
console.log('\n週末が高い順トップ8:'); weAll.slice(0, 8).forEach(x => console.log('  ', x.we, x.wd, x.t))
