import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = k => env.match(new RegExp('^' + k + '=(.*)$', 'm'))[1].trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'), {
  auth: { persistSession: false },
})

async function pageAll(table, select, tweak = q => q) {
  const CHUNK = 1000
  const all = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await tweak(sb.from(table).select(select)).range(from, from + CHUNK - 1)
    if (error) throw new Error(table + ': ' + error.message)
    if (!data || data.length === 0) break
    all.push(...data)
    if (data.length < CHUNK) break
  }
  return all
}

// 匿名キーでは profiles は読めない。公開ビュー public_sellers を使う
// （= /sellers の一覧に実際に出る、選ばれる母集団）
const approved = await pageAll('public_sellers', 'id, shop_name, genre, areas, photos')
const allSellers = approved

const hasPhoto = r => Array.isArray(r.photos) && r.photos.length > 0
const pct = (n, d) => d ? (n / d * 100).toFixed(1) + '%' : '-'

console.log('=== 母集団 ===')
console.log('role=seller 全体            :', allSellers.length)
console.log('/sellers に出る(approved)   :', approved.length)

console.log('\n=== 写真の登録率 ===')
console.log('全体で写真あり :', allSellers.filter(hasPhoto).length, pct(allSellers.filter(hasPhoto).length, allSellers.length))
console.log('approvedで写真あり:', approved.filter(hasPhoto).length, pct(approved.filter(hasPhoto).length, approved.length))
console.log('店名あり(全体) :', allSellers.filter(r => r.shop_name && r.shop_name.trim()).length,
  pct(allSellers.filter(r => r.shop_name && r.shop_name.trim()).length, allSellers.length))

// 3) メニュー登録者数
const menus = await pageAll('menus', 'id, seller_id, price, photo_url')
const sellersWithMenu = new Set(menus.map(m => m.seller_id))
console.log('\n=== メニュー ===')
console.log('メニュー総品数 :', menus.length)
console.log('メニューを持つ出店者:', sellersWithMenu.size, pct(sellersWithMenu.size, allSellers.length), '(role=seller比)')
console.log('価格あり :', menus.filter(m => m.price !== null && m.price !== undefined).length)
console.log('画像あり :', menus.filter(m => m.photo_url).length, pct(menus.filter(m => m.photo_url).length, menus.length))

// 4) /sellers の1ページ目に出る顔ぶれ（shop_name昇順・nullsLast）で写真の有無を見る
const firstPage = approved.slice().sort((a, b) => {
  const an = a.shop_name, bn = b.shop_name
  if (!an && !bn) return 0
  if (!an) return 1
  if (!bn) return -1
  return an.localeCompare(bn, 'ja')
}).slice(0, 24)
console.log('\n=== /sellers 先頭24件のうち写真ありの数 ===')
console.log(firstPage.filter(hasPhoto).length, '/ 24')
