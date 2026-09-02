import fs from 'node:fs'
const all = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json','utf8'))
const pub = all.filter(r=>r.status==='published' && !r.closed)
console.log('=== search 与野 / 富谷 / イオンモール ===')
pub.filter(r=>/与野|富谷/.test(r.title)).forEach(r=>{
  console.log(`${r.title} | type=${r.place_type} | status=${r.status} closed=${r.closed}`)
  console.log(`  fee: ${JSON.stringify(r.fee)}`)
  console.log(`  pf=${r.price_fixed} share=${r.price_share_pct} cfix=${r.company_fixed_amount} cshare=${r.company_share_pct} dtf=${JSON.stringify(r.day_type_fees)}`)
})
console.log('\n=== all fee strings containing 20% or 20％ ===')
pub.filter(r=>/20\s*[%％]/.test(r.fee||'')).forEach(r=>{
  console.log(`${r.title} | type=${r.place_type}`)
  console.log(`  fee: ${JSON.stringify(r.fee)}`)
})
