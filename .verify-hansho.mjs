// 反証用の数え直し。読み取りのみ。
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function rest(path, { count } = {}) {
  const headers = { apikey: KEY, Authorization: `Bearer ${KEY}` }
  if (count) headers.Prefer = `count=${count}`
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers })
  const cr = res.headers.get('content-range')
  let body = null
  try { body = await res.json() } catch { body = null }
  return { status: res.status, contentRange: cr, body }
}

// 方法1：Content-Range の exact count（ページングとは別経路）
const a = await rest('public_sellers?select=id&limit=1', { count: 'exact' })
console.log('[方法1] public_sellers exact count ->', a.status, a.contentRange)

// 方法2：1000行ずつページングして全行を取る
async function pageAll(table, select, extra = '') {
  const CHUNK = 1000
  const rows = []
  for (let from = 0; ; from += CHUNK) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=${select}${extra}&order=id.asc&offset=${from}&limit=${CHUNK}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    })
    if (!res.ok) { console.log('  取得エラー', table, res.status, await res.text()); break }
    const d = await res.json()
    rows.push(...d)
    if (d.length < CHUNK) break
  }
  return rows
}

const sellers = await pageAll('public_sellers', 'id,name,shop_name,genre,areas,photos,role,approval_status')
console.log('[方法2] ページングした行数 ->', sellers.length)
console.log('  id の重複を除いた数 ->', new Set(sellers.map((s) => s.id)).size)
console.log('  role の内訳 ->', JSON.stringify(sellers.reduce((m, s) => (m[s.role] = (m[s.role] || 0) + 1, m), {})))
console.log('  approval_status の内訳 ->', JSON.stringify(sellers.reduce((m, s) => (m[s.approval_status] = (m[s.approval_status] || 0) + 1, m), {})))

const nonEmpty = (v) => Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim() !== '')
const photos = sellers.filter((s) => nonEmpty(s.photos)).length
const shop = sellers.filter((s) => nonEmpty(s.shop_name)).length
console.log('  写真あり ->', photos, `(${Math.round(photos / sellers.length * 100)}%)`)
console.log('  店名あり ->', shop, `(${Math.round(shop / sellers.length * 100)}%)`)

// エリア
const areaCount = {}
for (const s of sellers) {
  const arr = Array.isArray(s.areas) ? s.areas : (s.areas ? [s.areas] : [])
  for (const a2 of new Set(arr.map(String))) areaCount[a2] = (areaCount[a2] || 0) + 1
}
const top = Object.entries(areaCount).sort((x, y) => y[1] - x[1]).slice(0, 12)
console.log('  エリア上位 ->', JSON.stringify(top))

// ジャンル
const gCount = {}
let multi = 0
let mealOrSweets = 0
for (const s of sellers) {
  const arr = [...new Set((Array.isArray(s.genre) ? s.genre : (s.genre ? [s.genre] : [])).map(String))]
  for (const g of arr) gCount[g] = (gCount[g] || 0) + 1
  if (arr.length >= 2) multi++
  if (arr.includes('食事') || arr.includes('スイーツ')) mealOrSweets++
}
console.log('  ジャンル ->', JSON.stringify(gCount))
console.log('  2つ以上 ->', multi, ' 食事orスイーツ ->', mealOrSweets)

// 除外店名（/sellers ページの除外）が公開ビューに存在するか
const excluded = sellers.filter((s) => ['株式会社nav', '株式会社アーク'].includes((s.shop_name ?? '').trim()))
console.log('  /sellers で除外している店名の該当数 ->', excluded.length)

// profiles 本体（承認前を含む全登録者）が匿名で読めるか
for (const q of [
  'profiles?select=id&limit=1',
  'profiles?select=id&role=eq.seller&limit=1',
]) {
  const r = await rest(q, { count: 'exact' })
  console.log(`[参考] ${q} ->`, r.status, r.contentRange, JSON.stringify(r.body).slice(0, 200))
}

// 公開中の案件数（記事の110件・都道府県別）
const places = await pageAll('places', 'id,prefecture,status,closed,category,fee_type')
console.log('[案件] 取得行数 ->', places.length)
const pub = places.filter((p) => p.status === 'published' && !p.closed)
console.log('  公開中(published かつ closed でない) ->', pub.length)
const pref = {}
for (const p of pub) pref[p.prefecture] = (pref[p.prefecture] || 0) + 1
console.log('  都道府県別 ->', JSON.stringify(Object.entries(pref).sort((x, y) => y[1] - x[1]).slice(0, 12)))
