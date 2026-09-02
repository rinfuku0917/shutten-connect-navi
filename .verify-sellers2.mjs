import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function fetchAll(table, query) {
  const out = []; let from = 0; const step = 1000
  for (;;) {
    const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from+step-1}`, 'Range-Unit': 'items', Prefer: 'count=exact' } })
    if (!res.ok) { console.log(`!! ${table}: ${res.status} ${(await res.text()).slice(0,150)}`); return null }
    const rows = await res.json(); out.push(...rows)
    if (rows.length < step) break
    from += step
  }
  return out
}
const s = await fetchAll('public_sellers', 'select=*&order=id')
const parse = v => { if (Array.isArray(v)) return v; if (typeof v !== 'string') return []
  const t = v.trim(); if (!t) return []
  if (t.startsWith('[')) { try { return JSON.parse(t) } catch { return [] } }
  return [t] }
const g = {}; let multi = 0, fs_ = 0
for (const x of s) { const a = parse(x.genre); for (const k of a) g[k] = (g[k]||0)+1
  if (a.length >= 2) multi++
  if (a.includes('食事') || a.includes('スイーツ')) fs_++ }
console.log('ジャンル件数:', g)
console.log('2つ以上:', multi, '/ 食事orスイーツ:', fs_, '/ 総数:', s.length)
for (const t of ['menus','menu_items','seller_menus','sales_items','products','seller_menu']) {
  const r = await fetchAll(t, 'select=*&limit=1'); if (r) console.log(`OK table ${t}:`, Object.keys(r[0]||{}).join(', ')) }
