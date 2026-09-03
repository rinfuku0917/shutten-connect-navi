// 母数（1,386店舗）の性質を、記事とは別の方法で確かめる
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sb = createClient(U, K, { auth: { persistSession: false } })

async function all(table, sel = '*') {
  const out = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await sb.from(table).select(sel).range(f, f + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

// 1) サーバー側の exact count（ページングとは別の数え方）
const hdr = { apikey: K, Authorization: `Bearer ${K}`, Prefer: 'count=exact', Range: '0-0' }
const cr = async qs => {
  const r = await fetch(`${U}/rest/v1/public_sellers?select=id&${qs}`, { headers: hdr })
  return r.headers.get('content-range')
}
console.log('=== public_sellers サーバー集計 ===')
console.log('全体            ', await cr(''))
console.log('approved        ', await cr('approval_status=eq.approved'))
console.log('role=seller     ', await cr('role=eq.seller'))
console.log('photos なし(null)', await cr('photos=is.null'))
console.log('genre なし(null) ', await cr('genre=is.null'))
console.log('areas なし(null) ', await cr('areas=is.null'))
console.log('shop_name null   ', await cr('shop_name=is.null'))

// 2) 全件ページングして自分で数える
const s = await all('public_sellers')
console.log('\n=== ページングで実取得 ===', s.length, '行 / ユニークid', new Set(s.map(x => x.id)).size)

const EXCLUDED = ['株式会社nav', '株式会社アーク']
const shown = s.filter(x => !EXCLUDED.includes(String(x.shop_name ?? '').trim()))
console.log('/sellers 表示対象（除外2社を引く）:', shown.length)

const genresOf = r => {
  let v = r.genre
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) }
  }
  return (v ?? []).map(x => String(x).trim()).filter(Boolean)
}
const hasPhoto = r => (r.photos ?? []).length > 0
const hasShop = r => String(r.shop_name ?? '').trim().length > 0
const hasGenre = r => genresOf(r).length > 0
const hasAreas = r => (r.areas ?? []).length > 0

const menus = await all('menus', 'id,seller_id,price,photo_url')
const withMenu = new Set(menus.map(m => m.seller_id))

console.log('\n=== 記事の3つの数字（自前集計） ===')
console.log('写真あり', s.filter(hasPhoto).length, `(${(s.filter(hasPhoto).length / s.length * 100).toFixed(1)}%)  記事: 551 / 40%`)
console.log('メニューあり', s.filter(r => withMenu.has(r.id)).length, `記事: 643 / 46%`)
console.log('店名あり', s.filter(hasShop).length, `記事: 1,080 / 78%`)
console.log('ジャンルあり', s.filter(hasGenre).length)
console.log('エリアあり', s.filter(hasAreas).length)

// 3) 「取り込み」の痕跡を探す。
// import-sellers は name/shop_name/areas/email/phone/address だけ入れ、
// genre・photos は入れない。つまり取り込みだけの人は genre も photos も空。
const buckets = {}
for (const r of s) {
  const k = `genre:${hasGenre(r) ? 'あり' : 'なし'} / photos:${hasPhoto(r) ? 'あり' : 'なし'} / menu:${withMenu.has(r.id) ? 'あり' : 'なし'} / areas:${hasAreas(r) ? 'あり' : 'なし'} / shop:${hasShop(r) ? 'あり' : 'なし'}`
  buckets[k] = (buckets[k] ?? 0) + 1
}
console.log('\n=== 組み合わせ別の内訳（多い順） ===')
Object.entries(buckets).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${String(v).padStart(5)}  ${k}`))

// ダッシュボードを一度も触っていない可能性が高い人 = genre なし かつ photos なし かつ menu なし
const untouched = s.filter(r => !hasGenre(r) && !hasPhoto(r) && !withMenu.has(r.id))
console.log('\ngenre/photos/menu が全部空:', untouched.length, `(${(untouched.length / s.length * 100).toFixed(1)}%)`)
console.log('  うち shop_name あり:', untouched.filter(hasShop).length)
console.log('  うち areas あり:', untouched.filter(hasAreas).length)

// 逆に、何かしら自分で埋めた人
const touched = s.filter(r => hasGenre(r) || hasPhoto(r) || withMenu.has(r.id))
console.log('\n何か1つでも埋めている:', touched.length)
console.log('  そのうち写真あり:', touched.filter(hasPhoto).length, `(${(touched.filter(hasPhoto).length / touched.length * 100).toFixed(1)}%)`)
console.log('  そのうちメニューあり:', touched.filter(r => withMenu.has(r.id)).length, `(${(touched.filter(r => withMenu.has(r.id)).length / touched.length * 100).toFixed(1)}%)`)

// 4) 匿名キーで読めないテーブルの確認
for (const t of ['imported_sellers', 'profiles', 'seller_documents', 'applications']) {
  const { error, count } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`\n${t}: ${error ? 'NG ' + error.message : 'count=' + count}`)
}
