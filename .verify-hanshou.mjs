// 検証用（読み取りのみ）。イベント件数の基準を確かめる。
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function fetchAll(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const all = await fetchAll('places', 'id,title,prefecture,address,place_type,status,closed,genres,description')
console.log('places 総取得件数(匿名キーで見える分):', all.length)

// status の分布
const byStatus = {}
for (const p of all) byStatus[`${p.status} / closed=${JSON.stringify(p.closed)}`] = (byStatus[`${p.status} / closed=${JSON.stringify(p.closed)}`] || 0) + 1
console.log('\n--- status × closed ---')
console.table(byStatus)

const open = all.filter(p => p.status === 'published' && !p.closed)
console.log('\n★ 募集中(published かつ closed が真でない):', open.length)

// place_type
const byType = {}
for (const p of open) { const k = p.place_type ?? '(null)'; byType[k] = (byType[k] || 0) + 1 }
console.log('\n--- ① place_type 別（募集中） ---')
console.table(byType)

// genres（カテゴリ）別。複数持ちうるので重複カウント
const byGenre = {}
let noGenre = 0
for (const p of open) {
  const g = Array.isArray(p.genres) ? p.genres : []
  if (g.length === 0) noGenre++
  for (const x of g) byGenre[x] = (byGenre[x] || 0) + 1
}
console.log('\n--- ② genres 別（募集中・複数タグ重複あり） ---')
console.table(byGenre)
console.log('genres 未設定:', noGenre)
console.log('genres の合計(延べ):', Object.values(byGenre).reduce((a, b) => a + b, 0))

// イベント系 genre を持つ件数（ユニーク）
const evGenres = ['イベント会場', 'マルシェ・マーケット']
const uniqEv = open.filter(p => (p.genres || []).some(g => evGenres.includes(g)))
console.log('\nイベント会場 or マルシェを含む案件(ユニーク):', uniqEv.length)
console.log('うち place_type=event:', uniqEv.filter(p => p.place_type === 'event').length)

// place_type=event の中身を見る（どんな場所か）
console.log('\n--- ③ place_type=event の一覧（募集中） ---')
for (const p of open.filter(p => p.place_type === 'event')) {
  console.log(`  [${p.prefecture}] ${p.title}  genres=${JSON.stringify(p.genres)}`)
}

// 記事の「場所の種類」表を機械的に再現できるか、キーワードで概算分類
const rules = [
  ['スーパー・食品店', /スーパー|マルエツ|ヤオコー|ベルク|いなげや|food|フード|食品|ドラッグ|カスミ|ロピア|ライフ|業務スーパー/i],
  ['学校・専門学校・大学', /大学|学校|学園|専門|キャンパス|高校|短大/],
  ['商業施設・モール', /モール|ショッピング|商業施設|プラザ|イオン|ららぽ|パルコ|アウトレット|センター/],
  ['イベント・お祭り', /イベント|祭|フェス|マルシェ|マーケット|花火|縁日/],
  ['オフィス・事業所', /オフィス|事業所|ビル|本社|工場|センタービル/],
  ['ゴルフ場・レジャー', /ゴルフ|レジャー|温泉|キャンプ|遊園|プール/],
]
const guessed = {}
for (const p of open) {
  const hay = `${p.title} ${p.address ?? ''} ${(p.genres || []).join(' ')}`
  const hit = rules.find(([, re]) => re.test(hay))
  const k = hit ? hit[0] : 'その他'
  guessed[k] = (guessed[k] || 0) + 1
}
console.log('\n--- ④ タイトル/住所/genres のキーワードによる概算分類（参考） ---')
console.table(guessed)

// 都道府県別（記事の表と突き合わせ）
const byPref = {}
for (const p of open) { const k = p.prefecture ?? '(null)'; byPref[k] = (byPref[k] || 0) + 1 }
console.log('\n--- ⑤ 都道府県別（募集中） ---')
console.table(Object.fromEntries(Object.entries(byPref).sort((a, b) => b[1] - a[1])))
