import fs from 'node:fs'
const all = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json','utf8'))
const pub = all.filter(r=>r.status==='published' && !r.closed)
// Any record whose fee text mentions a weekday word AND a weekend/holiday word
const wd = /平日/, we = /週末|土日|土・日|祝|休日|土曜|日曜/
const cands = pub.filter(r=> wd.test(r.fee||'') && we.test(r.fee||''))
console.log('fee text mentions both 平日 and 週末系:', cands.length)
cands.forEach(r=>console.log(`  [${r.place_type}] ${r.title}\n     ${JSON.stringify(r.fee)}\n     dtf=${JSON.stringify(r.day_type_fees)}`))
console.log('\n=== records with day_type_fees having both weekday & weekend ===')
const dt = pub.filter(r=>r.day_type_fees && r.day_type_fees.weekday && r.day_type_fees.weekend)
console.log('count:', dt.length)
dt.forEach(r=>{
  const w=r.day_type_fees.weekday, k=r.day_type_fees.weekend
  const wt=(w.placeFee||0)+(w.companyFee||0), kt=(k.placeFee||0)+(k.companyFee||0)
  console.log(`  ${r.title} | weekday ${wt} / weekend ${kt} | diff ${kt-wt} | fee=${JSON.stringify(r.fee)}`)
})
