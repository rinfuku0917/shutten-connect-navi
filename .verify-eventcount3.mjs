import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('.verify-eventcount.json', 'utf8'))
pub.sort((a, b) => String(a.title).localeCompare(String(b.title), 'ja'))
pub.forEach((r, i) => {
  console.log(`${String(i + 1).padStart(3)} [${r.place_type}] ${r.title}  <${r.prefecture}>`)
})
