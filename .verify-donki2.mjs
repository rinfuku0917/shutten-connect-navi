import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync(new URL('./.verify-donki-dump.json', import.meta.url), 'utf8'))

const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('published & not closed:', pub.length)
console.log('place_type breakdown:', pub.reduce((a, r) => (a[r.place_type] = (a[r.place_type] || 0) + 1, a), {}))

const donki = rows.find(r => /高井戸/.test(r.title || ''))
console.log('--- donki schedule:', JSON.stringify(donki.schedule))
console.log('--- donki genres/place_type:', donki.place_type)

// feeText() の再現（PlaceDetailClient.tsx）
function perDayFeeRange(schedule) {
  if (!Array.isArray(schedule)) return null
  const totals = schedule.filter(d => d && (typeof d.placeFee === 'number' || typeof d.companyFee === 'number'))
    .map(d => (typeof d.placeFee === 'number' ? d.placeFee : 0) + (typeof d.companyFee === 'number' ? d.companyFee : 0))
  if (!totals.length) return null
  return { min: Math.min(...totals), max: Math.max(...totals) }
}
function feeText(p) {
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  const range = perDayFeeRange(p.schedule)
  if (range) {
    const parts = [range.min === range.max ? range.min.toLocaleString() + '円/日' : range.min.toLocaleString() + '円〜' + range.max.toLocaleString() + '円/日']
    if (pct > 0) parts.push('売上の' + pct + '%')
    return parts.join(' ＋ ')
  }
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  if (fixed === 0 && pct === 0) return p.fee || '要相談'
  const unit = p.place_fixed_unit === 'per_event' ? '期間' : '日'
  const parts = []
  if (fixed > 0) parts.push(fixed.toLocaleString() + '円/' + unit)
  if (pct > 0) parts.push('売上の' + pct + '%')
  return parts.join(' ＋ ')
}
console.log('--- 案件ページに出る出店料表示:', JSON.stringify(feeText(donki)))

// day_type_fees を持つ公開案件を全部並べて、fee本文の金額と突き合わせる
const sum = s => s ? ((typeof s.placeFee === 'number' ? s.placeFee : 0) + (typeof s.companyFee === 'number' ? s.companyFee : 0)) : null
const has = s => !!s && (typeof s.placeFee === 'number' || typeof s.companyFee === 'number')
const dtfRows = pub.filter(r => r.day_type_fees && (has(r.day_type_fees.weekday) || has(r.day_type_fees.weekend)))
console.log('\n=== day_type_fees を持つ公開案件:', dtfRows.length, '件 ===')
for (const r of dtfRows) {
  const wd = has(r.day_type_fees.weekday) ? sum(r.day_type_fees.weekday) : null
  const we = has(r.day_type_fees.weekend) ? sum(r.day_type_fees.weekend) : null
  // 本文から円の数字を全部拾う
  const nums = [...String(r.fee || '').matchAll(/([0-9][0-9,]*)\s*円/g)].map(m => Number(m[1].replace(/,/g, '')))
  const mismatch = (wd != null && nums.length && !nums.includes(wd)) || (we != null && nums.length && !nums.includes(we))
  console.log([mismatch ? '★ズレ' : '  一致', r.title, '| 平日', wd, '週末', we, '| 本文の数字', JSON.stringify(nums), '| type', r.place_type].join(' '))
}

// 記事の集計を、週末7,500と8,000の両方で再計算
const regular = pub.filter(r => r.place_type === 'regular')
function stats(useText) {
  const wdArr = [], weArr = []
  for (const r of regular) {
    const d = r.day_type_fees
    if (!d) continue
    if (has(d.weekday)) wdArr.push(sum(d.weekday))
    if (has(d.weekend)) {
      let v = sum(d.weekend)
      if (useText && r.id === donki.id) v = 7500
      weArr.push(v)
    }
  }
  const med = a => { const s = [...a].sort((x, y) => x - y); const n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2 }
  return { n_wd: wdArr.length, wd_med: med(wdArr), wd_min: Math.min(...wdArr), wd_max: Math.max(...wdArr),
           n_we: weArr.length, we_med: med(weArr), we_min: Math.min(...weArr), we_max: Math.max(...weArr) }
}
console.log('\n=== day_type_fees ベースの常設案件の集計 ===')
console.log('day_type_fees のまま(週末8,000):', JSON.stringify(stats(false)))
console.log('fee本文どおり (週末7,500):', JSON.stringify(stats(true)))
