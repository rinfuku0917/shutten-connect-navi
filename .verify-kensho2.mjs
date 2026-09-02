import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync(new URL('./.verify-kensho-dump.json', import.meta.url), 'utf8'))

// ---- 1. structured column day_type_fees ----
const dtf = pub.filter(p => p.day_type_fees && (p.day_type_fees.weekday || p.day_type_fees.weekend))
console.log('--- day_type_fees が入っている案件:', dtf.length)
const sum = f => (Number(f?.placeFee) || 0) + (Number(f?.companyFee) || 0)
let bothStruct = 0, eqStruct = 0, cheaperStruct = 0, dearerStruct = 0
const diffs = []
for (const p of dtf) {
  const wd = p.day_type_fees.weekday, we = p.day_type_fees.weekend
  const a = sum(wd), b = sum(we)
  const has = wd && we && a > 0 && b > 0
  if (has) {
    bothStruct++
    if (a === b) eqStruct++
    else if (a < b) { cheaperStruct++; diffs.push(b - a) }
    else dearerStruct++
  }
  console.log(`  ${p.title} | 平日=${a} 週末=${b} ${has ? (a === b ? '同額' : a < b ? '平日安' : '平日高') : '片方のみ'}`)
}
console.log(`両方あり=${bothStruct} 同額=${eqStruct} 平日安=${cheaperStruct} 平日高=${dearerStruct}`)
diffs.sort((x, y) => x - y)
console.log('差額分布:', diffs.reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {}))
console.log('差額中央値:', diffs.length ? diffs[Math.floor((diffs.length - 1) / 2)] + '/' + diffs[Math.ceil((diffs.length - 1) / 2)] : '-')
