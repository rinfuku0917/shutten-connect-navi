import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function pageAll(table, select, extra = '') {
  const CHUNK = 1000, rows = []
  for (let from = 0; ; from += CHUNK) {
    const res = await fetch(`${URL_}/rest/v1/${table}?select=${select}${extra}&order=id.asc&offset=${from}&limit=${CHUNK}`, { headers: H })
    if (!res.ok) { console.log('  err', table, res.status, (await res.text()).slice(0, 300)); break }
    const d = await res.json(); rows.push(...d)
    if (d.length < CHUNK) break
  }
  return rows
}

const sellers = await pageAll('public_sellers', 'id,genre')
const toArr = (v) => {
  if (Array.isArray(v)) return v.map(String)
  if (v == null) return []
  const s = String(v).trim()
  if (s === '') return []
  if (s.startsWith('[')) { try { return JSON.parse(s).map(String) } catch { return [s] } }
  return [s]
}
const g = {}; let multi = 0, ms = 0, none = 0
for (const s of sellers) {
  const arr = [...new Set(toArr(s.genre))]
  if (arr.length === 0) none++
  for (const x of arr) g[x] = (g[x] || 0) + 1
  if (arr.length >= 2) multi++
  if (arr.includes('食事') || arr.includes('スイーツ')) ms++
}
console.log('母数', sellers.length)
console.log('ジャンル別', JSON.stringify(g))
console.log('2つ以上', multi, '/ 食事orスイーツ', ms, '/ ジャンル未設定', none)

// places の列を見る
const one = await fetch(`${URL_}/rest/v1/places?select=*&limit=1`, { headers: H })
const j = await one.json()
console.log('places 列 ->', Object.keys(j[0] ?? {}).join(', '))

const places = await pageAll('places', '*')
console.log('places 行数', places.length)
const pub = places.filter((p) => p.status === 'published' && !p.closed)
console.log('公開中', pub.length)
const pref = {}
for (const p of pub) pref[p.prefecture] = (pref[p.prefecture] || 0) + 1
console.log('都道府県別', JSON.stringify(Object.entries(pref).sort((a, b) => b[1] - a[1]).slice(0, 12)))

// メニュー（記事の3,677品）
for (const t of ['seller_menus', 'menus', 'menu_items']) {
  const r = await fetch(`${URL_}/rest/v1/${t}?select=id&limit=1`, { headers: { ...H, Prefer: 'count=exact' } })
  console.log('table', t, r.status, r.headers.get('content-range'))
}
