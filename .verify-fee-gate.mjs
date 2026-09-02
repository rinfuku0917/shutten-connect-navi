import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// PostgREST は指定しないと1000行で切れるので range で回す
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('places')
    .select('id,title,status,closed,fee,latitude,longitude,details,max_slots,open_time,close_time,address,description')
    .range(from, from + 999)
  if (error) { console.error('ERR', error.message); process.exit(1) }
  rows.push(...data)
  if (data.length < 1000) break
}

const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('places 全行:', rows.length)
console.log('公開中(published かつ closed でない):', pub.length)

const hasFee = pub.filter(r => r.fee && String(r.fee).trim())
const hasGeo = pub.filter(r => r.latitude != null && r.longitude != null)
const feeAndGeo = pub.filter(r => r.fee && String(r.fee).trim() && r.latitude != null && r.longitude != null)

console.log('\n--- 出店料 ---')
console.log('fee に文字が入っている:', hasFee.length)
console.log('fee が空:', pub.length - hasFee.length)

console.log('\n--- 地図ピン（未ログインでも fee が見える経路）---')
console.log('緯度経度あり:', hasGeo.length, `(${Math.round(hasGeo.length / pub.length * 100)}%)`)
console.log('緯度経度あり かつ fee あり = 未ログインで金額が読める:', feeAndGeo.length,
  `(公開中の ${Math.round(feeAndGeo.length / pub.length * 100)}%)`)
console.log('  → うち fee あるのに緯度経度なしで地図に出ない:', hasFee.length - feeAndGeo.length)

// 出店条件テーブルに出る項目（PlaceDetailClient の rows と同じキー）
const detailKeys = ['loadIn','loadOut','deadline','visitors','location','power','gas','water',
  'eatSpace','trash','heightLimit','rain','parking','history','menuWant','menuNG','menuOther','brand']
let withCond = 0, withNotes = 0, nothingHidden = 0
for (const r of pub) {
  const d = r.details || {}
  const n = detailKeys.filter(k => d[k] && String(d[k]).trim()).length
    + (r.max_slots != null ? 1 : 0) + ((r.open_time || r.close_time) ? 1 : 0)
  const notes = !!(d.notes && String(d.notes).trim())
  if (n > 0) withCond++
  if (notes) withNotes++
  if (n === 0 && !notes) nothingHidden++
}
console.log('\n--- 出店条件（ログインで隠れるブロック）---')
console.log('出店条件の項目が1つ以上ある:', withCond)
console.log('備考(notes)がある:', withNotes)
console.log('条件も備考も無い＝ロック案内すら出ない:', nothingHidden)

console.log('\n--- 未ログインでも常に見える項目 ---')
console.log('description(概要)あり:', pub.filter(r => r.description && String(r.description).trim()).length)
console.log('address(アクセス)あり:', pub.filter(r => r.address && String(r.address).trim()).length)
console.log('max_slots(募集台数)あり ※ただしロック内:', pub.filter(r => r.max_slots != null).length)

const sample = pub.filter(r => r.latitude != null && r.longitude != null && r.fee)[0]
console.log('\n--- 検証用サンプル（地図ピンあり）---')
console.log('id:', sample.id, '/ fee:', sample.fee, '/ title:', sample.title)
