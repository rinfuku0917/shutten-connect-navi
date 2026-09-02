import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync('.verify-open-titles.json', 'utf8'))

// 独立分類（タイトル文字列だけを根拠にする。記事を見ずに規則を先に決めた）
const rules = [
  ['学校', /大学|短期大学|専門学校|学院|学園|看護|保育|美容専門|薬科|体育/],
  ['イベント', /祭り|祭$|フェア|EXPO|マルシェ|学会|FamilyDay|フェスタ|涼祭/],
  ['オフィス', /株式会社|企業ランチ|事業所/],
  ['スーパー', /サンユーストアー|さがみや|スーパーあさの|ディスカウントスーパー|Olympic|ドン・キホーテ/],
  ['商業施設', /イオン|Ario|アリオ|モール|ショッピング|そよら|ステラタウン|ワールドポーターズ|ペリエ|プラザ/],
]

const buckets = {}
const other = []
for (const r of rows) {
  const hit = rules.find(([, re]) => re.test(r.title))
  if (hit) (buckets[hit[0]] ??= []).push(r.title)
  else other.push(r.title)
}

for (const [k] of rules) console.log(k.padEnd(6), (buckets[k] ?? []).length)
console.log('その他 ', other.length, JSON.stringify(other))
console.log('合計   ', rows.length)
console.log('スーパー+商業施設 =', (buckets['スーパー'] ?? []).length + (buckets['商業施設'] ?? []).length)

// 記事の表の合計
const article = { 'スーパー・食品店': 35, '学校': 30, '商業施設・モール': 29, 'イベント': 7, 'オフィス': 5 }
const sum = Object.values(article).reduce((a, b) => a + b, 0)
console.log('記事の表の合計 =', sum, '／ 母数 110 ／ 差 =', 110 - sum)

// 都道府県表の検算
const pref = {}
for (const r of rows) pref[r.pref] = (pref[r.pref] ?? 0) + 1
const top5 = Object.entries(pref).sort((a, b) => b[1] - a[1]).slice(0, 5)
const rest = rows.length - top5.reduce((a, [, n]) => a + n, 0)
console.log('都道府県 上位5:', JSON.stringify(top5), '／ その他 =', rest)

// オフィス候補の詳細（記事は5件、当方の規則は4件）
console.log('オフィス判定:', JSON.stringify(buckets['オフィス']))
