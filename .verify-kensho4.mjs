import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync(new URL('./.verify-kensho-dump.json', import.meta.url), 'utf8'))

console.log('=== 全110件の fee 本文 ===')
pub.forEach((p, i) => {
  const fee = (p.fee ?? '(null)').replace(/\r?\n/g, ' ⏎ ')
  console.log(`${String(i + 1).padStart(3)} | ${p.prefecture} | ${p.place_type} | ${p.title}`)
  console.log(`    ${fee}`)
})

console.log('\n=== 都道府県別 ===')
const byPref = {}
for (const p of pub) byPref[p.prefecture] = (byPref[p.prefecture] || 0) + 1
console.log(Object.entries(byPref).sort((a, b) => b[1] - a[1]))

console.log('\n=== サンユーストアーの都道府県 ===')
for (const p of pub.filter(p => p.title.includes('サンユー'))) console.log(` ${p.prefecture} | ${p.title} | ${p.fee}`)

console.log('\n=== fee が空の件数 ===', pub.filter(p => !p.fee || !p.fee.trim()).length)
