import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('.verify-datecheck-places.json','utf8'))
// fee 系フィールドの中身を確認
const sample = pub.slice(0,6).map(p=>({fee:p.fee, price_fixed:p.price_fixed, price_share_pct:p.price_share_pct, day_type_fees:p.day_type_fees, place_fixed_unit:p.place_fixed_unit}))
console.log(JSON.stringify(sample, null, 1))
console.log('fee が非空の件数:', pub.filter(p=>p.fee && String(p.fee).trim()).length)
