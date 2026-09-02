import fs from 'node:fs'
const all = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json','utf8'))
const pub = all.filter(r=>r.status==='published' && !r.closed)
// how many have day_type_fees non-empty
const withDT = pub.filter(r=>r.day_type_fees && (Array.isArray(r.day_type_fees)? r.day_type_fees.length: Object.keys(r.day_type_fees).length))
console.log('with day_type_fees:', withDT.length)
console.log('sample day_type_fees:', JSON.stringify(withDT.slice(0,5).map(r=>({t:r.title, d:r.day_type_fees})),null,1))
console.log('---- price_fixed/share summary ----')
console.log('price_fixed non-null:', pub.filter(r=>r.price_fixed!=null).length)
console.log('price_share_pct non-null:', pub.filter(r=>r.price_share_pct!=null).length)
console.log('fee non-empty:', pub.filter(r=>r.fee && r.fee.trim()).length)
