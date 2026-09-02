import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json', 'utf8'))

// 出店料の決め方を、金額欄（company_fixed_amount / company_share_pct / day_type_fees）から分類
function dayFee(p, k) {
  const d = p.day_type_fees
  if (!d || !d[k]) return null
  const v = d[k]
  const a = (v.companyFee ?? 0) + (v.placeFee ?? 0)
  return a > 0 ? a : null
}
function classify(p) {
  const fixed = (p.company_fixed_amount || 0) > 0 || dayFee(p, 'weekday') || dayFee(p, 'weekend')
  const pct = (p.company_share_pct || 0) > 0
  if (fixed && pct) return '併用'
  if (fixed) return '固定'
  if (pct) return '歩合'
  return '応相談'
}
const cls = {}
for (const p of pub) { const c = classify(p); (cls[c] ||= []).push(p) }
console.log('■ 出店料の決め方（110件）')
for (const [k, v] of Object.entries(cls)) console.log('  ', k, v.length)

console.log('\n■ 常設/単発 × 決め方')
for (const t of ['regular', 'event']) {
  const row = {}
  for (const p of pub.filter(x => x.place_type === t)) { const c = classify(p); row[c] = (row[c] || 0) + 1 }
  console.log('  ', t, row)
}

console.log('\n■ 歩合の料率（歩合＋併用）')
const rates = {}
for (const p of pub) { const c = classify(p); if (c === '歩合' || c === '併用') rates[p.company_share_pct] = (rates[p.company_share_pct] || 0) + 1 }
console.log('  ', rates, '合計', Object.values(rates).reduce((a, b) => a + b, 0))

console.log('\n■ 応相談（金額欄が空）の一覧')
for (const p of (cls['応相談'] || [])) console.log('   ', p.prefecture, '|', p.place_type, '|', JSON.stringify(p.title).slice(0, 40), '| fee=', JSON.stringify(p.fee))

// 平日/週末
console.log('\n■ day_type_fees を持つ案件')
const withDay = pub.filter(p => dayFee(p, 'weekday') && dayFee(p, 'weekend'))
console.log('  平日・週末の両方に金額あり:', withDay.length)
const diffs = {}
let wdCheaper = 0, same = 0, weCheaper = 0
for (const p of withDay) {
  const wd = dayFee(p, 'weekday'), we = dayFee(p, 'weekend')
  if (wd < we) { wdCheaper++; diffs[we - wd] = (diffs[we - wd] || 0) + 1 }
  else if (wd === we) same++
  else weCheaper++
}
console.log('  平日が安い:', wdCheaper, '/ 同額:', same, '/ 平日が高い:', weCheaper)
console.log('  差額の分布:', diffs)

const wdVals = withDay.map(p => dayFee(p, 'weekday')).sort((a, b) => a - b)
const weVals = withDay.map(p => dayFee(p, 'weekend')).sort((a, b) => a - b)
const med = a => a.length % 2 ? a[(a.length - 1) / 2] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2
console.log('  平日 中央値', med(wdVals), '最低', wdVals[0], '最高', wdVals.at(-1))
console.log('  週末 中央値', med(weVals), '最低', weVals[0], '最高', weVals.at(-1))
const cnt = a => a.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {})
console.log('  平日の金額分布', cnt(wdVals))
console.log('  週末の金額分布', cnt(weVals))

// 同額13/14 の検証
console.log('\n■ 平日=週末 の案件')
for (const p of withDay) { const wd = dayFee(p, 'weekday'), we = dayFee(p, 'weekend'); if (wd === we) console.log('   ', p.prefecture, wd, '|', p.title.slice(0, 34)) }

// 固定制（day_type_fees なし）の常設案件
console.log('\n■ 固定を含む常設案件で day_type_fees を持たないもの')
const fixedRegular = pub.filter(p => p.place_type === 'regular' && (classify(p) === '固定' || classify(p) === '併用'))
console.log('  常設の固定＋併用:', fixedRegular.length, '/ うち day_type_fees あり:', fixedRegular.filter(p => p.day_type_fees).length)
for (const p of fixedRegular.filter(p => !dayFee(p, 'weekday'))) console.log('   単一額:', p.company_fixed_amount, '|', p.prefecture, '|', p.title.slice(0, 34))
