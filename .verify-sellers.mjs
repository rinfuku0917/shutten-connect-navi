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
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + step - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact' },
    })
    if (!res.ok) { console.log(`!! ${table}: ${res.status} ${(await res.text()).slice(0, 160)}`); return null }
    const rows = await res.json(); out.push(...rows)
    if (rows.length < step) break
    from += step
  }
  return out
}

const s = await fetchAll('public_sellers', 'select=*&order=id')
console.log('public_sellers 全行(ページング済):', s.length)

const has = (v) => Array.isArray(v) ? v.length > 0 : (v != null && String(v).trim() !== '')
console.log('写真あり:', s.filter(x => has(x.photos)).length, '=', (s.filter(x => has(x.photos)).length / s.length * 100).toFixed(1) + '%')
console.log('屋号あり:', s.filter(x => has(x.shop_name)).length, '=', (s.filter(x => has(x.shop_name)).length / s.length * 100).toFixed(1) + '%')

// エリア
const area = {}
for (const x of s) for (const a of (Array.isArray(x.areas) ? x.areas : [])) area[a] = (area[a] || 0) + 1
console.log('エリア上位:', Object.entries(area).sort((a, b) => b[1] - a[1]).slice(0, 12))
console.log('大阪:', area['大阪'] ?? area['大阪府'])

// ジャンル
const g = {}, multi = []
for (const x of s) {
  const arr = Array.isArray(x.genre) ? x.genre : (has(x.genre) ? [x.genre] : [])
  for (const a of arr) g[a] = (g[a] || 0) + 1
  if (arr.length >= 2) multi.push(x.id)
}
console.log('ジャンル:', g)
console.log('2つ以上選択:', multi.length)
const foodOrSweets = s.filter(x => {
  const arr = Array.isArray(x.genre) ? x.genre : (has(x.genre) ? [x.genre] : [])
  return arr.includes('食事') || arr.includes('スイーツ')
}).length
console.log('食事 or スイーツ:', foodOrSweets)

// メニュー
for (const t of ['menus', 'menu_items', 'seller_menus', 'sales_items', 'products']) {
  const r = await fetchAll(t, 'select=*&limit=1')
  if (r) console.log(`table ${t} columns:`, Object.keys(r[0] || {}).join(', ') || '(空)')
}
