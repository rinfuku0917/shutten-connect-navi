import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('.verify-datecheck-places.json','utf8'))
const norm = s => String(s).replace(/[０-９％]/g, c => '０１２３４５６７８９％'.indexOf(c) < 10 ? '0123456789'[('０１２３４５６７８９'.indexOf(c))] : '%')
let fixed=[], share=[], both=[], none=[]
for (const p of pub) {
  const f = norm(p.fee || '')
  const hasShare = /%|パーセント|歩合/.test(f)
  const hasYen  = /[0-9][0-9,]*\s*円|¥/.test(f)
  if (hasShare && hasYen) both.push(p.fee)
  else if (hasYen) fixed.push(p.fee)
  else if (hasShare) share.push(p.fee)
  else none.push(p.fee)
}
console.log('■ 自前の再集計（fee のテキストから分類）')
console.log('固定制:', fixed.length, '/ 歩合制:', share.length, '/ 併用:', both.length, '/ 応相談など:', none.length, '= 合計', pub.length)
console.log('記事の表 :  固定50 / 歩合44 / 併用9 / 応相談7')
console.log('応相談グループの中身:', JSON.stringify(none))
console.log('併用グループの中身:', JSON.stringify(both))
// 歩合の料率内訳（歩合のみ＋併用）
const rate = {}
for (const f of share.concat(both)) {
  const m = norm(f).match(/(\d+(?:\.\d+)?)\s*%/)
  if (m) rate[m[1]] = (rate[m[1]]||0)+1
}
console.log('歩合の料率内訳:', JSON.stringify(rate), '合計', Object.values(rate).reduce((a,b)=>a+b,0))
console.log('記事    : 10%=36件 / 15%=13件 / 20%=4件（歩合53件）')
