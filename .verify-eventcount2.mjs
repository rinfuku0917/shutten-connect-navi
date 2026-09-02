import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('.verify-eventcount.json', 'utf8'))

const tally = (fn) => {
  const m = new Map()
  for (const r of pub) {
    const k = fn(r)
    m.set(k, (m.get(k) || 0) + 1)
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

console.log('--- place_type ---')
console.log(tally((r) => String(r.place_type)))
console.log('--- genres ---')
console.log(tally((r) => JSON.stringify(r.genres)))
console.log('--- recruit ---')
console.log(tally((r) => String(r.recruit)))
console.log('--- 都道府県 ---')
console.log(tally((r) => String(r.prefecture)))

// 自前のキーワード分類（記事とは独立にやり直す）
const rules = [
  ['イベント', /イベント|祭|フェス|マルシェ|マーケット|花火|大会|縁日|フェア|catering|周年|物産/i],
  ['スーパー', /スーパー|食品館|マート|マーケットプレイス|生鮮|青果|八百屋|ドラッグ|ホームセンター|ドンキ/],
  ['学校', /学校|大学|学園|高校|中学|小学|専門|キャンパス|学院|保育|幼稚/],
  ['商業施設', /モール|商業施設|ショッピング|プラザ|アウトレット|百貨店|パルコ|ビル|センター/],
  ['オフィス', /オフィス|事業所|本社|工場|会社|社員|企業|物流|倉庫/],
  ['ゴルフ・レジャー', /ゴルフ|レジャー|温泉|キャンプ|遊園|スタジアム|球場|プール|スキー/],
]
const cat = (r) => {
  const t = `${r.title} ${r.description ?? ''} ${r.place_type ?? ''}`
  for (const [name, re] of rules) if (re.test(t)) return name
  return 'その他'
}
console.log('--- 自前分類（タイトル+説明+place_type） ---')
console.log(tally(cat))

console.log('--- イベント判定になった案件 ---')
for (const r of pub) if (cat(r) === 'イベント') console.log(' *', r.title, '|', r.place_type, '|', r.prefecture)

console.log('--- その他になった案件 ---')
for (const r of pub) if (cat(r) === 'その他') console.log(' -', r.title, '|', r.place_type)
