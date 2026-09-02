import fs from 'node:fs'
const all = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json','utf8'))
const pub = all.filter(r=>r.status==='published' && !r.closed)
const norm = s => (s||'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/％/g,'%').replace(/，/g,',')
function classify(r){
  const f = norm(r.fee)
  const hasPct = /\d+\s*%|\d+\s*割/.test(f)
  // yen amounts >= 500 (avoid catching "10%" digits); look for 円 or 数字+円 patterns
  const yen = [...f.matchAll(/([0-9][0-9,]*)\s*円/g)].map(m=>Number(m[1].replace(/,/g,'')))
  const hasYen = yen.some(v=>v>=500)
  if(hasPct && hasYen) return '併用'
  if(hasPct) return '歩合'
  if(hasYen) return '固定'
  return '応相談'
}
const tally = {}
const byType = {regular:{}, event:{}}
pub.forEach(r=>{
  const c = classify(r)
  tally[c]=(tally[c]||0)+1
  const t = r.place_type==='event'?'event':'regular'
  byType[t][c]=(byType[t][c]||0)+1
})
console.log('overall:', JSON.stringify(tally))
console.log('regular(常設):', JSON.stringify(byType.regular), 'n=', pub.filter(r=>r.place_type!=='event').length)
console.log('event(単発):', JSON.stringify(byType.event), 'n=', pub.filter(r=>r.place_type==='event').length)
console.log('\n=== 併用 members ===')
pub.filter(r=>classify(r)==='併用').forEach(r=>console.log(` [${r.place_type}] ${r.title} :: ${JSON.stringify(r.fee).slice(0,110)}`))
console.log('\n=== 応相談 members ===')
pub.filter(r=>classify(r)==='応相談').forEach(r=>console.log(` [${r.place_type}] ${r.title} :: ${JSON.stringify(r.fee)}`))
// Among 常設 固定 (should be 48): who states both weekday & weekend?
const fixedReg = pub.filter(r=>r.place_type!=='event' && classify(r)==='固定')
console.log('\n常設×固定 count:', fixedReg.length)
const wd=/平日/, we=/週末|土日|土・日|祝|休日|土曜|日曜/
const both = fixedReg.filter(r=>wd.test(r.fee||'') && we.test(r.fee||''))
console.log('  of which fee mentions both 平日 and 週末系:', both.length)
both.forEach(r=>console.log(`   - ${r.title} :: ${JSON.stringify(r.fee).slice(0,80)}`))
