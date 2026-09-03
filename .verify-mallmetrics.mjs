// 独自検証。blog-metrics.mjs とは別に、必要な列だけを取り、
// 場所の分類は「先に一致した区分に入れる」を自前で書き直して確認する。
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

async function page(table, cols) {
  const out = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 499)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 500) break
  }
  return out
}

const places = await page('places', 'id,title,place_type,genres,prefecture,fee,status,closed')
const live = places.filter(p => p.status === 'published' && p.closed !== true)
console.log('募集中の案件 =', live.length, '（places総数', places.length, '）')

// 記事と同じ分類（先勝ち）
const VENUE = [
  ['スーパー', /スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/],
  ['学校', /大学|専門学校|高校|学校|学園|学院|キャンパス|学内/],
  ['商業施設', /イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/],
  ['ホームセンター', /ホームセンター|カインズ|コーナン|ビバホーム|ケーヨー|ジョイフル|家電/],
  ['オフィス', /オフィス|ビル|本社|事業所|工場|会社|株式会社|センタービル/],
  ['病院', /病院|クリニック|医療|介護|老人|福祉/],
  ['マンション', /マンション|団地|住宅|レジデンス/],
  ['公園', /公園|道の駅|市役所|区役所|役場|図書館|文化会館/],
  ['イベント', /祭|フェス|マルシェ|イベント|大会|フェア|市$|の市|フリマ|クリマ|FamilyDay|Day$/],
  ['駐車場', /駐車場|空き地|遊休/],
  ['ゴルフ', /ゴルフ|キャンプ|遊園地|温泉|プール|スポーツ/],
]
const vOf = p => {
  const t = `${p.title} ${p.place_type ?? ''} ${(p.genres ?? []).join(' ')}`
  for (const [n, re] of VENUE) if (re.test(t)) return n
  return 'その他'
}

const by = {}
for (const p of live) (by[vOf(p)] ??= []).push(p)
console.log('\n■ 場所の種類')
for (const k of Object.keys(by).sort((a, b) => by[b].length - by[a].length)) {
  const reg = by[k].filter(p => p.place_type === 'regular').length
  console.log(`  ${k}: ${by[k].length}件（うち常設 ${reg}件 / event ${by[k].filter(p => p.place_type === 'event').length}件）`)
}

console.log('\n■ 商業施設の都道府県')
const mallPref = {}
for (const p of by['商業施設'] ?? []) mallPref[p.prefecture ?? '-'] = (mallPref[p.prefecture ?? '-'] ?? 0) + 1
console.log(' ', mallPref)

console.log('\n■ 商業施設の fee 全文（併用の型を目で確かめる）')
for (const p of by['商業施設'] ?? []) {
  const f = String(p.fee ?? '').replace(/\s+/g, ' ').slice(0, 90)
  console.log(`  [${p.prefecture}] ${String(p.title).slice(0, 26)} :: ${f}`)
}

// 出店者ジャンル
const sellers = await page('public_sellers', 'id,genre')
const gc = {}
for (const s of sellers) {
  let v = s.genre
  if (typeof v === 'string') { try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) } }
  for (const g of (v ?? []).map(x => String(x).trim()).filter(Boolean)) gc[g] = (gc[g] ?? 0) + 1
}
console.log('\n■ 出店者ジャンル（公開中', sellers.length, '店）')
console.log(' ', gc)
