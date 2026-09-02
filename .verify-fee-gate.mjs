import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function all(table, select, tune = q => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await tune(sb.from(table).select(select)).range(from, from + 999)
    if (error) { console.log('ERR', table, error.message); break }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

// 1) 記事本文の確認
const posts = await all('posts', 'slug,status,title,content')
for (const p of posts) {
  console.log('POST', p.slug, p.status, p.content.length)
}
const fee = posts.find(p => p.slug === 'food-truck-fee-guide')
console.log('--- 該当文の有無 ---')
const checks = [
  '登録も、案件を見るのも無料',
  '[出店場所をさがす](/places)から、都道府県で絞り込んで比べてみてください',
  '募集中の案件はすべて出店料を明記',
  'ログイン',
  '会員登録',
]
for (const c of checks) console.log(JSON.stringify(c), fee.content.includes(c))
const md = fs.readFileSync(new URL('./docs/blog/food-truck-fee-guide.md', import.meta.url), 'utf8')
console.log('原稿(本文部分)とDBが一致:', md.includes(fee.content.slice(0, 200)), 'len md/db', md.length, fee.content.length)

// 他記事にも同種のCTAがあるか
console.log('--- 他記事のCTA ---')
for (const p of posts) {
  const hits = ['/places', '/register', 'ログイン', '無料'].filter(k => p.content.includes(k))
  console.log(p.slug, p.status, JSON.stringify(hits))
}

// 2) 案件データ
const places = await all('places',
  'id,title,status,closed,prefecture,fee,latitude,longitude,price_fixed,price_share_pct,company_fixed_amount,company_share_pct,place_fixed_unit')
console.log('--- places ---')
console.log('全件(匿名で読める)', places.length)
const pub = places.filter(p => p.status === 'published')
const open = pub.filter(p => !p.closed)
console.log('published', pub.length, 'うち募集中', open.length)

function feeText(p) {
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  if (fixed === 0 && pct === 0) return p.fee || '要相談'
  const unit = p.place_fixed_unit === 'per_event' ? '期間' : '日'
  const parts = []
  if (fixed > 0) parts.push(fixed.toLocaleString() + '円/' + unit)
  if (pct > 0) parts.push('売上の' + pct + '%')
  return parts.join(' ＋ ')
}

const withGeo = open.filter(p => p.latitude != null && p.longitude != null)
const geoWithFeeText = withGeo.filter(p => (p.fee || '').trim() !== '')
console.log('募集中で緯度経度あり(地図に出る)', withGeo.length)
console.log('  うち fee 文字列が入っている(地図の吹き出しに金額が出る)', geoWithFeeText.length)
console.log('  うち fee 空(吹き出しは「要相談」)', withGeo.length - geoWithFeeText.length)

const openWithFeeText = open.filter(p => (p.fee || '').trim() !== '')
console.log('募集中で fee 文字列あり', openWithFeeText.length)
const openFeeUnknown = open.filter(p => feeText(p) === '要相談')
console.log('募集中で feeText が「要相談」になる件数', openFeeUnknown.length)

console.log('--- 地図の吹き出しに出る金額の例(先頭8件) ---')
for (const p of geoWithFeeText.slice(0, 8)) console.log(' ', p.prefecture, '|', p.title.slice(0, 24), '|', JSON.stringify(p.fee).slice(0, 80))
