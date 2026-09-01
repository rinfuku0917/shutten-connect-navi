import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json', 'utf8'))

const targets = ['尼涼祭', 'まちかどスペース', 'イオンモール与野', 'イオンモール富谷', 'テントブース', 'Olympic 太田']
for (const t of targets) {
  for (const p of pub.filter(p => (p.title || '').includes(t))) {
    console.log('==========================================')
    console.log('title:', p.title)
    console.log('fee:', JSON.stringify(p.fee))
    console.log('place_type:', p.place_type, '| open_days:', JSON.stringify(p.open_days))
    console.log('schedule:', JSON.stringify(p.schedule))
    console.log('recruit:', JSON.stringify(p.recruit))
    console.log('open_time:', p.open_time, '- close_time:', p.close_time)
    console.log('day_type_fees:', JSON.stringify(p.day_type_fees))
    console.log('price_fixed:', p.price_fixed, '| price_share_pct:', p.price_share_pct)
    console.log('description:', (p.description || '').slice(0, 700))
    console.log('details:', JSON.stringify(p.details || '').slice(0, 700))
    break
  }
}

// 併用（固定＋歩合）に該当しそうなものを機械的に洗い出す
console.log('\n\n===== 「%」と「円」の両方を含む fee（＝併用候補） =====')
for (const p of pub) {
  const f = p.fee || ''
  const hasPct = /[%％]/.test(f)
  const hasYen = /[0-9０-９][0-9０-９,，]*\s*円|万円/.test(f)
  if (hasPct && hasYen) console.log(`- ${p.title} :: ${f.replace(/\n/g, ' / ')}`)
}

console.log('\n\n===== 「%」を含まない＝純粋固定の候補で、平日に使える金額 =====')
for (const p of pub) {
  const f = p.fee || ''
  if (/[%％]/.test(f)) continue
  if (!/[0-9０-９]/.test(f)) continue
  console.log(`- ${p.title} :: ${f.replace(/\n/g, ' / ')}`)
}
