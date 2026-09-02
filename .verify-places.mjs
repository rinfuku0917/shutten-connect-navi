import fs from 'node:fs'
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/live.json'
const r = JSON.parse(fs.readFileSync(SP, 'utf8'))

// 記事の分類を復元できるか（イオン系はすべて商業施設、Olympic/サンユー等はスーパー、学園祭は学校、社内イベントはオフィス）
const 学校 = [7,9,10,11,12,15,17,25,27,28,37,39,40,41,43,45,50,71,74,77,81,84,86,90,91,96,101,106,109,110]
const イベント = [13,14,23,24,29,52,76]
const オフィス = [22,26,47,89,105]
const ゴルフ = [20,97]
const その他 = [64,73]
const スーパー = [1,2,4,5,16,19,30,31,32,34,35,36,38,42,44,46,48,49,51,55,65,66,67,68,78,92,93,94,98,99,102,103,104,107,108]
const 商業施設 = [3,6,8,18,21,33,53,54,56,57,58,59,60,61,62,63,69,70,72,75,79,80,82,83,85,87,88,95,100]

const groups = { スーパー, 学校, 商業施設, イベント, オフィス, ゴルフ, その他 }
let n = 0
for (const [k, v] of Object.entries(groups)) { n += v.length; console.log(k, v.length, (v.length / 110 * 100).toFixed(1) + '%') }
console.log('合計', n)
const all = Object.values(groups).flat().sort((a, b) => a - b)
console.log('重複:', all.length !== new Set(all).size, '欠番:', [...Array(110).keys()].map(i => i + 1).filter(i => !all.includes(i)))
console.log('上位3つ:', (スーパー.length + 学校.length + 商業施設.length), '=', ((スーパー.length + 学校.length + 商業施設.length) / 110 * 100).toFixed(1) + '%')

// イオン系のうち「食品スーパー主体（イオンスタイル/イオン◯◯店/イオンリテール）」を
// スーパー側に寄せた場合どうなるか
const 食品スーパー寄り = [3,54,57,60,61,70,79,80,83,85,87]
console.log('\n＜イオンスタイル等11件をスーパーに寄せた場合＞')
console.log('スーパー', スーパー.length + 11, '/ 商業施設', 商業施設.length - 11, '/ 学校', 学校.length)
console.log('上位3つ:', (スーパー.length + 11 + 商業施設.length - 11 + 学校.length), '→ 変わらず')
console.log('対象:', 食品スーパー寄り.map(i => r[i-1].title))

console.log('\n＜学園祭・文化祭2件をイベントに寄せた場合＞')
console.log('イベント', イベント.length + 2, '/ 学校', 学校.length - 2, '→ 上位3つ:', スーパー.length + 商業施設.length + (学校.length - 2), '件')
console.log('＜レゾナックFamilyDayをイベントに寄せた場合＞ イベント', イベント.length + 1, '/ オフィス', オフィス.length - 1)

console.log('\n最小カテゴリは:', Object.entries(groups).sort((a, b) => a[1].length - b[1].length).slice(0, 4).map(([k, v]) => `${k}=${v.length}`))
