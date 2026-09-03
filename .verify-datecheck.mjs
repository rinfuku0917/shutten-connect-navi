// 集計日の指摘の検証。blog-metrics.mjs とは別の数え方で確かめる。
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

// サーバ側 count でも数えて、ページングの取りこぼしがないか二重に確かめる
async function srvCount(table, apply = q => q) {
  const { count, error } = await apply(db.from(table).select('*', { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count
}

console.log('--- places ---')
const places = await page('places', '*')
console.log('places 全行(ページング):', places.length, ' サーバcount:', await srvCount('places'))
const live = places.filter(p => p.status === 'published' && !p.closed)
console.log('公開中:', live.length)
console.log('  常設:', live.filter(p => p.place_type === 'regular').length,
  ' 単発:', live.filter(p => p.place_type === 'event').length)

// 案件が 9/2→9/3 で動いたか。タイムスタンプ列を探す
console.log('places の列:', Object.keys(places[0] ?? {}).join(', '))
for (const col of ['created_at', 'updated_at']) {
  if (!(col in (places[0] ?? {}))) continue
  const recent = places.filter(p => p[col] && p[col] >= '2026-09-02')
    .map(p => `${p[col]} ${p.status}/${p.closed} ${String(p.title).slice(0, 24)}`)
  console.log(`  ${col} が 2026-09-02 以降: ${recent.length} 件`)
  for (const r of recent.slice(0, 20)) console.log('    ', r)
}

console.log('\n--- public_sellers / menus ---')
const sellers = await page('public_sellers', '*')
console.log('public_sellers:', sellers.length, ' サーバcount:', await srvCount('public_sellers'))
const menus = await page('menus', '*')
console.log('menus:', menus.length, ' サーバcount:', await srvCount('menus'))

// ジャンルを、スクリプトとは別の書き方で数える（正規化を素朴に）
const g = { 食事: 0, スイーツ: 0, ドリンク: 0 }
let multi = 0
for (const s of sellers) {
  let v = s.genre
  if (typeof v === 'string') { try { v = JSON.parse(v) } catch { v = v.split(/[,、，]/) } }
  const arr = [...new Set((Array.isArray(v) ? v : v ? [v] : []).map(x => String(x).trim()).filter(Boolean))]
  if (arr.length > 1) multi++
  for (const k of Object.keys(g)) if (arr.includes(k)) g[k]++
}
console.log('ジャンル 食事/スイーツ/ドリンク:', g.食事, g.スイーツ, g.ドリンク, ' 2つ以上:', multi)
console.log('写真あり:', sellers.filter(s => (s.photos ?? []).length > 0).length)
console.log('メニューあり:', new Set(menus.map(m => m.seller_id)).size)
console.log('メニュー価格あり:', menus.filter(m => m.price != null).length,
  ' 写真あり:', menus.filter(m => m.photo_url).length)

console.log('sellers の列:', Object.keys(sellers[0] ?? {}).join(', '))
for (const col of ['created_at', 'updated_at']) {
  if (!(col in (sellers[0] ?? {}))) continue
  const d = {}
  for (const s of sellers) { const k = String(s[col] ?? '').slice(0, 10); d[k] = (d[k] ?? 0) + 1 }
  const late = Object.entries(d).filter(([k]) => k >= '2026-08-30').sort()
  console.log(`  sellers ${col} 日別(8/30以降):`, JSON.stringify(late))
}
for (const col of ['created_at', 'updated_at']) {
  if (!(col in (menus[0] ?? {}))) continue
  const d = {}
  for (const m of menus) { const k = String(m[col] ?? '').slice(0, 10); d[k] = (d[k] ?? 0) + 1 }
  const late = Object.entries(d).filter(([k]) => k >= '2026-08-30').sort()
  console.log(`  menus ${col} 日別(8/30以降):`, JSON.stringify(late))
}
console.log('\n現在時刻:', new Date().toISOString())
