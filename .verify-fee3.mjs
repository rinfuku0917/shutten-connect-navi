import fs from 'node:fs'
const all = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json','utf8'))
const pub = all.filter(r=>r.status==='published' && !r.closed)
pub.forEach((r,i)=>{
  console.log(`[${i}] ${r.title} | pref=${r.prefecture} | type=${r.place_type} | recruit=${r.recruit}`)
  console.log(`     fee: ${JSON.stringify(r.fee)}`)
  console.log(`     pf=${r.price_fixed} unit=${r.place_fixed_unit} share=${r.price_share_pct} cfix=${r.company_fixed_amount} cshare=${r.company_share_pct} dtf=${r.day_type_fees?JSON.stringify(r.day_type_fees):'-'}`)
})
