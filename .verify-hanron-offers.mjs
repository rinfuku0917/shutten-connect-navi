// 反証用: get-food-truck-offers「募集者の画面には出店者名と希望日が出ます」への指摘を検証する
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// PostgREST は1000行で打ち切られる。必ずページング
async function all(table, cols = '*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) return { error: error.message, rows: out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return { rows: out }
}

console.log('=== 1) 匿名キーで何が読めるか ===')
for (const t of ['profiles', 'public_sellers', 'applications', 'menus', 'sns_links', 'places', 'messages', 'seller_documents']) {
  const { count, error } = await sb.from(t).select('id', { count: 'exact', head: true })
  console.log(`  ${t.padEnd(20)} ${error ? 'NG: ' + error.message : 'OK count=' + count}`)
}

console.log('\n=== 2) public_sellers 実取得（ページング） ===')
const { rows: sellers } = await all('public_sellers', 'id,name,shop_name,role,approval_status,photos,areas,genre')
console.log('  行数:', sellers.length, '/ ユニークid:', new Set(sellers.map(s => s.id)).size)
const dist = k => sellers.reduce((m, s) => (m[String(s[k])] = (m[String(s[k])] || 0) + 1, m), {})
console.log('  role の内訳:', JSON.stringify(dist('role')))
console.log('  approval_status の内訳:', JSON.stringify(dist('approval_status')))

console.log('\n=== 3) 承認済み以外の出店者が存在する痕跡（menus / sns_links の孤児 seller_id） ===')
const ids = new Set(sellers.map(s => s.id))
for (const [t, col] of [['menus', 'seller_id'], ['sns_links', 'seller_id']]) {
  const { rows, error } = await all(t, `${col}`)
  if (error) { console.log(`  ${t}: NG ${error}`); continue }
  const uniq = new Set(rows.map(r => r[col]).filter(Boolean))
  const orphan = [...uniq].filter(id => !ids.has(id))
  console.log(`  ${t}: 行 ${rows.length} / ユニーク出店者 ${uniq.size} / うち public_sellers に居ない ${orphan.length}人`)
}

console.log('\n=== 4) 記事の数字の再現（別の数え方で） ===')
const { rows: menus } = await all('menus', 'id,seller_id,price,photo_url')
const hasMenu = new Set(menus.map(m => m.seller_id))
console.log('  公開中の出店者:', sellers.length, '（記事 1,386）')
console.log('  写真あり:', sellers.filter(s => Array.isArray(s.photos) && s.photos.length > 0).length, '（記事 551）')
console.log('  メニューあり:', sellers.filter(s => hasMenu.has(s.id)).length, '（記事 643）')
console.log('  店名あり:', sellers.filter(s => String(s.shop_name ?? '').trim()).length, '（記事 1,080）')
