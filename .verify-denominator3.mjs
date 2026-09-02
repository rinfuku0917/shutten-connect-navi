import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(readFileSync('.env.local', 'utf8').split('\n')
  .map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^"|"$/g, '')]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })

async function all(table, cols = '*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) throw error
    if (!data?.length) break
    out.push(...data); if (data.length < 1000) break
  }
  return out
}

const s = await all('public_sellers')
const menus = await all('menus', 'id,seller_id,price,photo_url')

// --- /sellers 公開ページが読者に見せている数 ---
const EXCLUDED = ['株式会社nav', '株式会社アーク']
const shown = s.filter(r => !EXCLUDED.includes((r.shop_name ?? '').trim()))
console.log('=== 読者が /sellers で見る数 ===')
console.log(`public_sellers: ${s.length} → 除外2社を引いて表示: ${shown.length}（記事の「1,386」との差 ${s.length - shown.length}）`)
console.log('除外対象が実在するか:', EXCLUDED.map(n => `${n}=${s.filter(r => (r.shop_name ?? '').trim() === n).length}件`).join(' / '))

// --- 分母を「1,386(承認済み)」から「1,405(profiles全行=コミット618f982の記載)」に置き換えたら割合はどうなるか ---
const hasPhoto = s.filter(r => Array.isArray(r.photos) ? r.photos.length > 0 : !!r.photos).length
const hasShop = s.filter(r => (r.shop_name ?? '').trim() !== '').length
const withMenu = new Set(menus.map(m => m.seller_id)).size
console.log('\n=== 分母を変えたときの割合の動き ===')
console.log('分母1,386(承認済み) → 分母1,405(profilesの全行。承認待ち・否認・募集者・管理者すべて込みの上限)')
for (const [label, num, articleTxt] of [['写真', hasPhoto, '40%'], ['メニュー', withMenu, '46%'], ['店名', hasShop, '78%']]) {
  const a = num / 1386 * 100, b = num / 1405 * 100
  console.log(`${label.padEnd(5)} ${num}件 : ${a.toFixed(1)}% → ${b.toFixed(1)}%（差 ${(a - b).toFixed(1)}pt / 記事の表記 ${articleTxt}）`)
}

// --- 記事の他の数字も同じ分母で成立しているか（分母がずれたら崩れる主張かの確認） ---
console.log('\n=== 都道府県別（記事の表）===')
for (const [pref, art] of [['東京都', 765], ['埼玉県', 549], ['神奈川県', 544], ['千葉県', 468], ['茨城県', 278], ['大阪府', 288]]) {
  const n = s.filter(r => (r.areas ?? []).some(a => a === pref || a === pref.replace(/[都府県]$/, ''))).length
  console.log(`${pref.padEnd(5)} 実測 ${n}  記事 ${art}  ${n === art ? 'OK' : '差あり'}`)
}
console.log('\n=== ジャンル（記事の表）===')
for (const [g, art] of [['食事', 600], ['スイーツ', 509], ['ドリンク', 475], ['物販', 36]]) {
  const n = s.filter(r => Array.isArray(r.genre) ? r.genre.includes(g) : r.genre === g).length
  console.log(`${g.padEnd(5)} 実測 ${n}  記事 ${art}  ${n === art ? 'OK' : '差あり'}`)
}

// --- メニューの価格・写真（記事: 価格3,675 / 写真2,818(77%)）---
console.log('\n=== メニュー ===')
const priceNull = menus.filter(m => m.price == null).length
const priceZero = menus.filter(m => m.price === 0 || m.price === '0').length
const withPhoto = menus.filter(m => (m.photo_url ?? '') !== '').length
console.log(`総数 ${menus.length} / price が null: ${priceNull} / price が0: ${priceZero} / 価格>0: ${menus.filter(m => Number(m.price) > 0).length}（記事: 3,675）`)
console.log(`写真あり: ${withPhoto} (${(withPhoto / menus.length * 100).toFixed(0)}%)（記事: 2,818 / 77%）`)
