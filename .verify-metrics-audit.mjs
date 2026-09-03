// 独立検証: 記事本文(.md)の数字 vs いまのDB。blog-metrics.mjs とは別実装で数える。
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// count(*) を head でとる（全行取得とは別経路で数える）
async function headCount(table, build = q => q) {
  const { count, error } = await build(db.from(table).select('*', { count: 'exact', head: true }))
  if (error) throw new Error(`${table}: ${error.message}`)
  return count
}

// ページングして全行（ソート固定でページの取りこぼしを防ぐ）
async function all(table, cols = '*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).order('id', { ascending: true })
      .range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const sellers = await all('public_sellers')
const menus = await all('menus')
const places = await all('places')

console.log('== 行数の二重確認（head count と ページング取得）==')
console.log('public_sellers:', await headCount('public_sellers'), '/', sellers.length)
console.log('menus        :', await headCount('menus'), '/', menus.length)
console.log('places       :', await headCount('places'), '/', places.length)
console.log('id 重複:', 'sellers', sellers.length - new Set(sellers.map(s => s.id)).size,
  'menus', menus.length - new Set(menus.map(m => m.id)).size)

// --- 出店者・メニュー系10指標を自前で数える ---
const photo = sellers.filter(s => Array.isArray(s.photos) && s.photos.length > 0).length
const sellerIdsWithMenu = new Set(menus.map(m => m.seller_id))
const publicIds = new Set(sellers.map(s => s.id))
const menuHas = sellers.filter(s => sellerIdsWithMenu.has(s.id)).length

// ジャンルは genre カラム。文字列/配列/JSON文字列 いずれもありうる
const g = s => {
  let v = s.genre
  if (Array.isArray(v)) return v.map(String).map(x => x.trim()).filter(Boolean)
  if (typeof v === 'string') {
    const t = v.trim()
    if (t.startsWith('[')) { try { return JSON.parse(t).map(String).map(x => x.trim()).filter(Boolean) } catch {} }
    return t.split(/[,、，]/).map(x => x.trim()).filter(Boolean)
  }
  return []
}
const meal = sellers.filter(s => g(s).includes('食事')).length
const sweet = sellers.filter(s => g(s).includes('スイーツ')).length
const drink = sellers.filter(s => g(s).includes('ドリンク')).length
const multi = sellers.filter(s => g(s).length > 1).length
const mealOrSweet = sellers.filter(s => g(s).includes('食事') || g(s).includes('スイーツ')).length

const priceNotNull = menus.filter(m => m.price !== null && m.price !== undefined).length
const menuPhoto = menus.filter(m => m.photo_url).length

// 記事に書いてある数字（docs/blog/get-food-truck-offers.md から手で拾ったもの）
const ARTICLE = {
  '公開中の出店者': 1386,
  '写真あり': 551,
  'メニューあり': 643,
  'メニュー総数': 3677,
  'メニュー:価格あり': 3675,
  'メニュー:写真あり': 2818,
  'ジャンル:食事': 601,
  'ジャンル:スイーツ': 510,
  'ジャンル:ドリンク': 476,
  'ジャンル:2つ以上': 523,
  '食事かスイーツ(重複除く)': 771,
}
const NOW = {
  '公開中の出店者': sellers.length,
  '写真あり': photo,
  'メニューあり': menuHas,
  'メニュー総数': menus.length,
  'メニュー:価格あり': priceNotNull,
  'メニュー:写真あり': menuPhoto,
  'ジャンル:食事': meal,
  'ジャンル:スイーツ': sweet,
  'ジャンル:ドリンク': drink,
  'ジャンル:2つ以上': multi,
  '食事かスイーツ(重複除く)': mealOrSweet,
}

console.log('\n== 記事に書いた数字 vs いまのDB（自前集計）==')
let n = 0
for (const k of Object.keys(ARTICLE)) {
  const same = ARTICLE[k] === NOW[k]
  if (!same) n++
  console.log(`${same ? '  一致' : '★ずれ'}  ${k}: 記事 ${ARTICLE[k]} / いま ${NOW[k]}`)
}
console.log(`\nずれた指標: ${n} 個`)

// 記事が書いている割合も検算
const pct = (a, b) => Math.round((a / b) * 100)
console.log('\n== 記事の割合表記の検算 ==')
console.log(`写真 40%: 記事時点 ${pct(551, 1386)}% / いま ${pct(photo, sellers.length)}%`)
console.log(`メニュー 46%: 記事時点 ${pct(643, 1386)}% / いま ${pct(menuHas, sellers.length)}%`)
console.log(`メニュー写真 77%: 記事時点 ${pct(2818, 3677)}% / いま ${pct(menuPhoto, menus.length)}%`)

// menus の seller_id が非公開の出店者を指していないか（メニュー総数の定義確認）
const orphan = menus.filter(m => !publicIds.has(m.seller_id)).length
console.log(`\nmenus のうち public_sellers に無い seller_id を持つ行: ${orphan}`)

// 案件側（記事が引用している主要な数字）も一応
const live = places.filter(p => p.status === 'published' && !p.closed)
const pref = {}
for (const p of live) pref[p.prefecture ?? '-'] = (pref[p.prefecture ?? '-'] ?? 0) + 1
console.log(`\n募集中の案件: 記事110 / いま ${live.length}`)
console.log(`常設: 記事97 / いま ${live.filter(p => p.place_type === 'regular').length}`)
console.log(`単発: 記事13 / いま ${live.filter(p => p.place_type === 'event').length}`)
console.log('都道府県:', JSON.stringify(pref))
