import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

async function all(table, cols = '*', tweak = q => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tweak(sb.from(table).select(cols)).range(from, from + 999)
    if (error) { console.log(`!! ${table}: ${error.message} (code=${error.code})`); return null }
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

// --- 1) 匿名キーで profiles が読めるか（＝登録総数が確認できるか） ---
for (const t of ['profiles', 'public_sellers']) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`[head] ${t}: count=${count} error=${error ? error.message + ' / ' + error.code : 'なし'}`)
}

// --- 2) public_sellers を全件取得して自分で数える ---
const s = await all('public_sellers')
if (!s) process.exit(1)
console.log('\n=== public_sellers 実取得件数 ===', s.length)
console.log('列:', Object.keys(s[0]).join(', '))

// ビュー定義どおりか（role/approval_status が他の値を含まないか）
const roles = {}, appr = {}
for (const r of s) { roles[r.role] = (roles[r.role] || 0) + 1; appr[r.approval_status] = (appr[r.approval_status] || 0) + 1 }
console.log('role の内訳:', roles)
console.log('approval_status の内訳:', appr)

// --- 3) 記事の割合を再計算 ---
const hasPhoto = s.filter(r => Array.isArray(r.photos) ? r.photos.length > 0 : !!r.photos).length
const hasShop = s.filter(r => (r.shop_name ?? '').trim() !== '').length
console.log('\n=== 記事の分子 ===')
console.log(`写真あり: ${hasPhoto} (${(hasPhoto / s.length * 100).toFixed(1)}%)  記事: 551 (40%)`)
console.log(`店名あり: ${hasShop} (${(hasShop / s.length * 100).toFixed(1)}%)  記事: 1,080 (78%)`)

// メニュー
const menus = await all('menus', 'id,seller_id,price,image_url,photo_url,name').catch(() => null)
if (menus) {
  const ids = new Set(s.map(r => r.id))
  const inScope = menus.filter(m => ids.has(m.seller_id))
  const sellersWithMenu = new Set(inScope.map(m => m.seller_id)).size
  console.log(`メニューあり出店者: ${sellersWithMenu} (${(sellersWithMenu / s.length * 100).toFixed(1)}%)  記事: 643 (46%)`)
  console.log(`メニュー総件数(全体/public_sellers内): ${menus.length} / ${inScope.length}  記事: 3,677`)
  // メニューを持つが public_sellers に居ない出店者＝承認済み以外の出店者の痕跡
  const orphanSellers = new Set(menus.filter(m => !ids.has(m.seller_id)).map(m => m.seller_id))
  console.log(`▼ public_sellers に居ない seller_id を持つメニュー: ${menus.length - inScope.length}件 / 出店者 ${orphanSellers.size}人`)
}

// --- 4) 承認済み以外の出店者の存在を、別ルートから推定できるか ---
// applications / seller_documents / messages などに出てくる seller_id が public_sellers に無いか
for (const t of ['applications', 'seller_documents', 'messages', 'menus', 'sales_reports']) {
  const { count, error } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`[head] ${t}: count=${count} error=${error ? error.code + ' ' + error.message : 'なし'}`)
}
