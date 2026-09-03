// 2本が同じ指標に別の数字を書いている件の確認（自分で数え直す）
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
async function all(t) {
  const out = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await db.from(t).select('*').range(f, f + 999)
    if (error) throw new Error(`${t}: ${error.message}`)
    out.push(...data); if (data.length < 1000) break
  }
  return out
}
const places = await all('places')
const live = places.filter(p => p.status === 'published' && !p.closed)
console.log('places 全件:', places.length, '／ 公開中(status=published かつ closed が真でない):', live.length)
console.log('  closed の値の内訳:', JSON.stringify(places.reduce((a, p) => (a[String(p.closed)] = (a[String(p.closed)] ?? 0) + 1, a), {})))
console.log('  status の内訳:', JSON.stringify(places.reduce((a, p) => (a[String(p.status)] = (a[String(p.status)] ?? 0) + 1, a), {})))

const sellers = await all('public_sellers')
const genresOf = s => {
  let v = s.genre
  if (typeof v === 'string') { try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) } }
  return (v ?? []).map(x => String(x).trim()).filter(Boolean)
}
const g = {}
for (const s of sellers) for (const k of genresOf(s)) g[k] = (g[k] ?? 0) + 1
console.log('\npublic_sellers:', sellers.length)
console.log('ジャンル別:', JSON.stringify(g, null, 0))
console.log('\n記事の記載')
console.log('  supermarket-food-truck : 食事601 / スイーツ510 / ドリンク476 / 物販36  ・公開中の出店者=（記載なし）')
console.log('  mall-food-truck-event  : 食事602 / スイーツ511 / ドリンク477')
console.log('  get-food-truck-offers  : 食事601 / スイーツ510 / ドリンク476 / 物販36 ・1,386店舗')
console.log('  metrics.json(09-03)    : 食事602 / スイーツ511 / ドリンク477')
