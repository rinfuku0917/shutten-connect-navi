import fs from 'fs'
import path from 'path'

const file = 'docs/blog/food-truck-fee-guide.md'
const raw = fs.readFileSync(file, 'utf8')
const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
const meta = {}
for (const line of m[1].split(/\r?\n/)) {
  const i = line.indexOf(':')
  if (i < 0) continue
  meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}
const content = m[2].trim()

console.log('=== 自分で数え直した文字数 ===')
console.log('meta_description 文字数 (String.length / UTF-16 code units):', meta.meta_description.length)
console.log('meta_description 文字数 ([...str].length / code points)   :', [...meta.meta_description].length)
console.log('meta_description 本文:', JSON.stringify(meta.meta_description))
console.log('')
console.log('content 文字数 (length)      :', content.length)
console.log('content 文字数 (code points) :', [...content].length)
console.log('')
console.log('=== frontmatter のキー一覧 ===')
console.log(Object.keys(meta))
console.log('data_snapshot の値:', JSON.stringify(meta.data_snapshot))
console.log('')

// 生成されたSQLに data_snapshot が含まれるか（列名として）
const sql = fs.readFileSync('docs/blog/food-truck-fee-guide.sql', 'utf8')
console.log('=== 生成SQL 検査 ===')
console.log('SQL 内に "data_snapshot" が出現する回数:', (sql.match(/data_snapshot/g) || []).length)
const ins = sql.match(/insert into posts \(([^)]*)\)/)
console.log('insert の列リスト:', ins ? ins[1] : '(見つからず)')
console.log('SQL 内に "2026-09-02" が出現する回数:', (sql.match(/2026-09-02/g) || []).length)
console.log('SQL 内に "2026年9月2日" が出現する回数:', (sql.match(/2026年9月2日/g) || []).length)
console.log('')

// 本文中に集計日が何回書かれているか
console.log('=== 本文中の集計日の直書き ===')
const lines = content.split('\n')
lines.forEach((l, i) => {
  if (l.includes('2026年9月2日') || l.includes('2026-09-02')) {
    console.log(`  L${i + 1}: ${l.slice(0, 120)}`)
  }
})
