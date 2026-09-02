import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

async function all(table, cols = '*', tweak = q => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(sb.from(table).select(cols)).range(from, from + 999)
    if (error) { console.log(`!! ${table}: ${error.message}`); return null }
    if (!data || data.length === 0) break
    out.push(...data); if (data.length < 1000) break
  }
  return out
}

const sellers = await all('public_sellers', 'id,shop_name,photos')
const ids = new Set(sellers.map(r => r.id))

// menus の1行を見て列名を確認
const { data: sample } = await sb.from('menus').select('*').limit(1)
console.log('menus の列:', Object.keys(sample[0]).join(', '))

const menus = await all('menus', 'id,seller_id,price,name')
console.log('\n=== menus ===', menus.length, '件')
const bySeller = new Set(menus.map(m => m.seller_id))
const inScope = menus.filter(m => ids.has(m.seller_id))
const orphan = [...new Set(menus.filter(m => !ids.has(m.seller_id)).map(m => m.seller_id))]
console.log('メニューを持つ seller_id の総数:', bySeller.size)
console.log('うち public_sellers にいる:', new Set(inScope.map(m => m.seller_id)).size, '（記事: 643）')
console.log('▼ public_sellers にいない seller_id:', orphan.length, '人 / メニュー', menus.length - inScope.length, '件')
console.log('   → これは「承認済みでない出店者」または削除済みユーザーの痕跡')
console.log('   orphan の例:', orphan.slice(0, 5))

// 価格の入り具合（記事: 3,675/3,677）
const withPrice = menus.filter(m => m.price != null && m.price !== '').length
console.log('価格あり(全メニュー):', withPrice, '/', menus.length, '（記事: 3,675/3,677）')

// --- 匿名で読めるテーブルを総当たりして、profiles の総数に迫れる経路がないか探す ---
const cand = ['profiles', 'public_profiles', 'sellers', 'public_sellers', 'places', 'posts', 'menus',
  'applications', 'seller_documents', 'meeting_requests', 'invoices', 'sales_reports', 'sales_items',
  'place_images', 'notifications', 'messages', 'favorites', 'reviews']
console.log('\n=== 匿名キーで読めるテーブル ===')
for (const t of cand) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`${t.padEnd(18)} ${error ? '×  ' + (error.message || '').slice(0, 60) : 'count=' + count}`)
}

// profiles を色々な形で試す（本当に読めないのか）
console.log('\n=== profiles への直接アクセス試行 ===')
for (const [label, q] of [
  ['select id', sb.from('profiles').select('id').limit(3)],
  ['count exact', sb.from('profiles').select('id', { count: 'exact', head: true })],
  ['role=seller', sb.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'seller')],
  ['pending', sb.from('profiles').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending')],
]) {
  const { data, count, error, status } = await q
  console.log(`${label.padEnd(14)} status=${status} count=${count} rows=${data ? data.length : '-'} error=${error ? error.message : 'なし'}`)
}

// public_sellers に絞り込み条件を足しても件数が変わらないこと（ビュー定義の裏取り）
for (const [label, q] of [
  ['role=seller', sb.from('public_sellers').select('id', { count: 'exact', head: true }).eq('role', 'seller')],
  ['approved', sb.from('public_sellers').select('id', { count: 'exact', head: true }).eq('approval_status', 'approved')],
  ['pending', sb.from('public_sellers').select('id', { count: 'exact', head: true }).eq('approval_status', 'pending')],
  ['role=host', sb.from('public_sellers').select('id', { count: 'exact', head: true }).eq('role', 'host')],
]) {
  const { count, error } = await q
  console.log(`public_sellers ${label.padEnd(12)} count=${count} ${error ? error.message : ''}`)
}
