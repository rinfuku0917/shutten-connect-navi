// 独立検証: public_sellers の genre 集計を、スクリプトとは別の方法で数える。
// 方法A: PostgREST の count=exact を head リクエストで使う（サーバ側で数える）
// 方法B: 全件ページングして JS で数える（スクリプトと同じ土俵での照合用）
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const BASE = env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '') + '/rest/v1'
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

// ---- 方法A: サーバ側 exact count ----
async function serverCount(qs) {
  const r = await fetch(`${BASE}/public_sellers?${qs}`, {
    method: 'HEAD',
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' },
  })
  const cr = r.headers.get('content-range') // "0-0/1387"
  if (!r.ok) throw new Error(`${r.status} ${qs} ${cr}`)
  return Number(String(cr).split('/')[1])
}

// ---- 方法B: 全件ページング ----
async function allRows(table, cols = '*') {
  const out = []
  for (let from = 0; ; from += 500) { // 1000ではなく500刻み。境界の取りこぼしを別条件で確認
    const r = await fetch(`${BASE}/${table}?select=${cols}`, {
      headers: { ...H, Range: `${from}-${from + 499}` },
    })
    if (!r.ok) throw new Error(`${table} ${r.status} ${await r.text()}`)
    const d = await r.json()
    out.push(...d)
    if (d.length < 500) break
  }
  return out
}

const sellersTotalA = await serverCount('select=id')
console.log('【方法A サーバ側 exact count】')
console.log('  public_sellers 総数:', sellersTotalA)

// genre の型を確かめる
const sample = await fetch(`${BASE}/public_sellers?select=id,genre&limit=3`, { headers: H }).then(r => r.json())
console.log('  genre のサンプル:', JSON.stringify(sample))

const GENRES = ['食事', 'スイーツ', 'ドリンク', '物販']
const serverCounts = {}
for (const g of GENRES) {
  // 配列カラムなら cs.{...} が効く
  try {
    serverCounts[g] = await serverCount(`select=id&genre=cs.%7B${encodeURIComponent(g)}%7D`)
  } catch (e) {
    serverCounts[g] = `cs失敗: ${e.message}`
  }
}
console.log('  genre cs.{} 件数:', JSON.stringify(serverCounts))

// ---- 方法B ----
const rows = await allRows('public_sellers', 'id,genre,shop_name')
console.log('\n【方法B 全件ページング(500刻み)】')
console.log('  取得行数:', rows.length, '/ ユニークid:', new Set(rows.map(r => r.id)).size)

const genresOf = s => {
  let v = s.genre
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) }
  }
  return (v ?? []).map(x => String(x).trim()).filter(Boolean)
}
const cnt = {}
let multi = 0
const meal = new Set(), sweet = new Set()
const holders = { 食事: [], スイーツ: [], ドリンク: [], 物販: [] }
for (const s of rows) {
  const g = genresOf(s)
  if (g.length > 1) multi += 1
  for (const k of g) {
    cnt[k] = (cnt[k] ?? 0) + 1
    if (holders[k]) holders[k].push(s.id)
  }
  if (g.includes('食事')) meal.add(s.id)
  if (g.includes('スイーツ')) sweet.add(s.id)
}
console.log('  ジャンル件数:', JSON.stringify(cnt))
console.log('  2つ以上:', multi, '/ 食事かスイーツ(重複除く):', new Set([...meal, ...sweet]).size)

// ---- 三ジャンル全部を持つ出店者 ----
const triple = rows.filter(s => {
  const g = genresOf(s)
  return g.includes('食事') && g.includes('スイーツ') && g.includes('ドリンク')
})
console.log('\n【食事・スイーツ・ドリンクを3つとも選んでいる出店者】', triple.length, '件')
console.log(JSON.stringify(triple.map(t => ({ id: t.id, shop: t.shop_name, genre: t.genre })), null, 1))

// ---- 指摘された特定のID ----
const TARGET = '2b7f698b-7480-4a59-9e83-20a536b10948'
const hit = rows.find(r => r.id === TARGET)
console.log('\n【指摘されたID】', TARGET)
console.log('  public_sellers に存在するか:', !!hit, hit ? JSON.stringify(hit) : '')

// ---- menus の created_at ----
const menus = await allRows('menus', 'id,seller_id,created_at,name')
console.log('\n【menus】総数:', menus.length)
const tm = menus.filter(m => m.seller_id === TARGET)
console.log('  対象出店者のメニュー:', tm.length, JSON.stringify(tm.map(m => ({ n: m.name, c: m.created_at }))))
const recent = menus.filter(m => m.created_at && m.created_at >= '2026-09-02T00:00:00')
  .sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)))
console.log('  2026-09-02以降に作られたメニュー:', recent.length)
const bySeller = {}
for (const m of recent) bySeller[m.seller_id] = (bySeller[m.seller_id] ?? 0) + 1
console.log('  その内訳(seller_id別):', JSON.stringify(bySeller, null, 1))
console.log('  最古/最新:', recent[0]?.created_at, '/', recent[recent.length - 1]?.created_at)

// ---- 記事が使っている他の出店者系の数字も一応 ----
const withPhotos = rows.length // placeholder
const full = await allRows('public_sellers', 'id,photos,shop_name')
const menuSellers = new Set(menus.map(m => m.seller_id))
console.log('\n【記事が使う他の数字】')
console.log('  写真あり:', full.filter(s => (s.photos ?? []).length > 0).length)
console.log('  メニューあり:', full.filter(s => menuSellers.has(s.id)).length)
console.log('  店名あり:', full.filter(s => String(s.shop_name ?? '').trim()).length)
