import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json','utf8'))
const byType = pub.reduce((a,p)=>(a[p.place_type]=(a[p.place_type]||0)+1,a),{})
console.log('place_type:', byType)
console.log('--- fee texts ---')
pub.forEach((p,i)=>console.log(`${String(i+1).padStart(3)} [${p.place_type}] pf=${p.price_fixed} sh=${p.price_share_pct} dtf=${p.day_type_fees?JSON.stringify(p.day_type_fees):'-'} | ${JSON.stringify(p.fee)} | ${p.title}`))
