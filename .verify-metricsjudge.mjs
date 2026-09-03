// 独自検証：スクリプトとは別の方法で数える。
// ・件数は PostgREST の exact count（head:true）でサーバ側に数えさせる
// ・行が要るものは id 昇順のキーセット・ページングで全件取る（.range だけに頼らない）
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// サーバ側で数えさせる（行を取らない）
async function countOf(table, build = q => q) {
  const { count, error } = await build(db.from(table).select('*', { count: 'exact', head: true }))
  if (error) throw new Error(`${table} count: ${error.message}`)
  return count
}

// id 昇順のキーセット・ページング（range に頼らない別方式）
async function fetchAll(table, cols, build = q => q, key = 'id') {
  const out = []
  let last = null
  for (let i = 0; i < 200; i++) {
    let q = db.from(table).select(cols).order(key, { ascending: true }).limit(500)
    if (last !== null) q = q.gt(key, last)
    const { data, error } = await build(q)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 500) break
    last = data[data.length - 1][key]
  }
  return out
}

const sellers = await fetchAll('public_sellers', 'id,shop_name,photos,genre,areas')
const menus = await fetchAll('menus', 'id,seller_id,price,photo_url')

const sellersCount = await countOf('public_sellers')
const menusCount = await countOf('menus')

console.log('== 行数のクロスチェック（キーセット取得 vs サーバ側 exact count） ==')
console.log('public_sellers:', sellers.length, '/ count:', sellersCount, sellers.length === sellersCount ? 'OK' : '★不一致')
console.log('menus        :', menus.length, '/ count:', menusCount, menus.length === menusCount ? 'OK' : '★不一致')
console.log('public_sellers の id 重複:', sellers.length - new Set(sellers.map(s => s.id)).size)
console.log('menus の id 重複        :', menus.length - new Set(menus.map(m => m.id)).size)

// 写真あり：配列が空でないもの
const withPhoto = sellers.filter(s => Array.isArray(s.photos) ? s.photos.length > 0
  : (typeof s.photos === 'string' ? s.photos.trim() !== '' && s.photos !== '[]' && s.photos !== '{}' : false))
// メニューあり
const sellerIds = new Set(sellers.map(s => s.id))
const menuSellers = new Set(menus.map(m => m.seller_id))
const menuSellersPublic = new Set([...menuSellers].filter(id => sellerIds.has(id)))
const withMenu = sellers.filter(s => menuSellers.has(s.id))
// 店名あり
const withName = sellers.filter(s => String(s.shop_name ?? '').trim() !== '')

// メニュー：価格・写真
const priceYes = menus.filter(m => m.price != null)
const priceZeroOrNull = menus.filter(m => m.price == null)
const photoYes = menus.filter(m => m.photo_url)
// 公開出店者のメニューだけに絞った場合
const menusPublic = menus.filter(m => sellerIds.has(m.seller_id))

// ジャンル
const genresOf = s => {
  let v = s.genre
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) }
  }
  return (v ?? []).map(x => String(x).trim()).filter(Boolean)
}
const g = {}
let multi = 0
const meal = new Set(), sweet = new Set()
for (const s of sellers) {
  const gs = genresOf(s)
  if (gs.length > 1) multi += 1
  for (const k of gs) g[k] = (g[k] ?? 0) + 1
  if (gs.includes('食事')) meal.add(s.id)
  if (gs.includes('スイーツ')) sweet.add(s.id)
}
const areas = {}
for (const s of sellers) for (const a of (s.areas ?? [])) areas[a] = (areas[a] ?? 0) + 1

const R = {
  '公開中の出店者': sellers.length,
  '写真あり': withPhoto.length,
  'メニューあり': withMenu.length,
  '店名あり': withName.length,
  'メニュー総数': menus.length,
  'メニュー:価格あり': priceYes.length,
  'メニュー:写真あり': photoYes.length,
  'ジャンル:食事': g['食事'] ?? 0,
  'ジャンル:スイーツ': g['スイーツ'] ?? 0,
  'ジャンル:ドリンク': g['ドリンク'] ?? 0,
  'ジャンル:物販': g['物販'] ?? 0,
  'ジャンル:2つ以上': multi,
  '食事かスイーツ(重複除く)': new Set([...meal, ...sweet]).size,
  'エリア:東京': areas['東京'] ?? 0,
  'エリア:埼玉': areas['埼玉'] ?? 0,
  'エリア:神奈川': areas['神奈川'] ?? 0,
  'エリア:千葉': areas['千葉'] ?? 0,
  'エリア:茨城': areas['茨城'] ?? 0,
  'エリア:大阪': areas['大阪'] ?? 0,
}

const snap = JSON.parse(fs.readFileSync('docs/blog/metrics.json', 'utf8'))
console.log(`\n== いまのデータ vs metrics.json（${snap.date}） ==`)
for (const [k, v] of Object.entries(R)) {
  const p = snap.values[k]
  const mark = p === undefined ? '(基準なし)' : (p === v ? 'OK' : `★ずれ 基準=${p}`)
  console.log(`  ${k.padEnd(24)} ${String(v).padStart(6)}  ${mark}`)
}

console.log('\n== 補足 ==')
console.log('価格が null のメニュー:', priceZeroOrNull.length)
console.log('price=0 のメニュー   :', menus.filter(m => m.price === 0).length)
console.log('公開出店者に紐づくメニュー数:', menusPublic.length, '/ 全メニュー', menus.length)
console.log('メニューを持つ出店者(公開のみ):', menuSellersPublic.size, '/ 全 seller_id', menuSellers.size)
console.log('公開出店者のメニューのうち価格あり:', menusPublic.filter(m => m.price != null).length)
console.log('公開出店者のメニューのうち写真あり:', menusPublic.filter(m => m.photo_url).length)
console.log('photos の型サンプル:', JSON.stringify(sellers.find(s => s.photos)?.photos)?.slice(0, 120))
console.log('genre の型サンプル :', JSON.stringify(sellers.find(s => s.genre)?.genre)?.slice(0, 120))
