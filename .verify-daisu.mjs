// 「何台から始めるか」節の検証。max_slots を独自に数え直す。
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// 200行ずつ。指摘者と違う刻みでページングして、取りこぼしが無いか見る
async function all(table) {
  const out = []
  for (let from = 0; ; from += 200) {
    const { data, error } = await db.from(table).select('*').range(from, from + 199)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 200) break
  }
  return out
}

const places = await all('places')
console.log('places 全件:', places.length)
const live = places.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(published かつ closed でない):', live.length)

// max_slots の分布（公開中）
const dist = {}
for (const p of live) {
  const k = p.max_slots == null ? '未設定' : String(p.max_slots)
  dist[k] = (dist[k] ?? 0) + 1
}
console.log('\n=== 公開中110件の max_slots 分布 ===')
console.log(Object.entries(dist).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}件`).join('\n'))

// 全件（下書き・終了も含む）でも見る。5一色は公開中だけの現象か
const distAll = {}
for (const p of places) {
  const k = p.max_slots == null ? '未設定' : String(p.max_slots)
  distAll[k] = (distAll[k] ?? 0) + 1
}
console.log('\n=== 全案件の max_slots 分布 ===')
console.log(Object.entries(distAll).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}: ${v}件`).join('\n'))

// 商業施設29件だけ
const VENUE_MALL = /イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/
const VENUE_BEFORE = [
  /スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/,
  /大学|専門学校|高校|学校|学園|学院|キャンパス|学内/,
]
const isMall = p => {
  const t = `${p.title} ${p.place_type ?? ''} ${(p.genres ?? []).join(' ')}`
  if (VENUE_BEFORE.some(re => re.test(t))) return false
  return VENUE_MALL.test(t)
}
const mall = live.filter(isMall)
console.log('\n=== 商業施設', mall.length, '件の max_slots 分布 ===')
const dm = {}
for (const p of mall) {
  const k = p.max_slots == null ? '未設定' : String(p.max_slots)
  dm[k] = (dm[k] ?? 0) + 1
}
console.log(JSON.stringify(dm))

// 台数に触れている本文があるか（max_slots 以外の材料）
const TEXTF = ['description', 'recruit', 'details', 'fee', 'note', 'notes', 'body', 'content']
const cols = Object.keys(places[0] ?? {})
console.log('\nplaces の列:', cols.join(', '))
const textOf = p => TEXTF.filter(f => cols.includes(f)).map(f => String(p[f] ?? '')).join(' ')
const DAI = /(\d+)\s*台/
const withDai = live.filter(p => DAI.test(textOf(p)))
console.log('\n本文に「N台」の記載がある公開中案件:', withDai.length, '件')
for (const p of withDai.slice(0, 25)) {
  const m = textOf(p).match(/.{0,25}\d+\s*台.{0,25}/)
  console.log(` - max_slots=${p.max_slots} | ${String(p.title).slice(0, 24)} | …${m?.[0] ?? ''}…`)
}

// 「売上」に関わる列があるか（複数台と売上の関係を検証できる材料があるか）
console.log('\n売上に関係しそうな列:', cols.filter(c => /sale|revenue|amount|price|report|result/i.test(c)).join(', ') || 'なし')

// 台数と売上を突き合わせられるテーブルがあるか
for (const t of ['sales', 'sales_reports', 'reports', 'applications', 'place_slots']) {
  const { error, count } = await db.from(t).select('*', { count: 'exact', head: true })
  console.log(`テーブル ${t}: ${error ? '読めない/無い（' + error.message.slice(0, 40) + '）' : count + '行'}`)
}
