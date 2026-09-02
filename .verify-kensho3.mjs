import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync(new URL('./.verify-kensho-dump.json', import.meta.url), 'utf8'))

// 平日/週末を思わせる語が fee 本文に出る案件を全部出す
const WD = /平日|ウィークデー|月〜金|月～金|月-金/
const WE = /週末|土日|土・日|休日|祝|土曜|日曜/
let n = 0
for (const p of pub) {
  const fee = (p.fee || '').replace(/\r?\n/g, ' ⏎ ')
  if (WD.test(fee) || WE.test(fee)) {
    n++
    console.log(`[${n}] ${p.title} <${p.place_type}> price_fixed=${p.price_fixed} share=${p.price_share_pct} cfa=${p.company_fixed_amount} dtf=${p.day_type_fees ? 'Y' : '-'}`)
    console.log(`     fee: ${fee}`)
  }
}
console.log('=== 平日/週末語を含む fee 件数:', n, '/', pub.length)
