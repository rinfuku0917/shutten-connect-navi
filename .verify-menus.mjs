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
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
    const rows = await res.json(); out.push(...rows)
    if (rows.length < step) break
    from += step
  }
  return out
}
const m = await fetchAll('menus', 'select=id,seller_id,name,price,photo_url&order=id')
console.log('menus 全行:', m.length)
const nn = v => v != null && String(v).trim() !== ''
console.log('価格あり:', m.filter(x => nn(x.price)).length)
console.log('価格 0 or null:', m.filter(x => !nn(x.price) || Number(x.price) === 0).length)
console.log('写真あり:', m.filter(x => nn(x.photo_url)).length, '=', (m.filter(x=>nn(x.photo_url)).length/m.length*100).toFixed(1)+'%')
const sellers = new Set(m.map(x => x.seller_id))
console.log('メニューを持つ seller 数(menus基準):', sellers.size)

const s = await fetchAll('public_sellers', 'select=id&order=id')
const ids = new Set(s.map(x => x.id))
console.log('public_sellers に含まれる seller のうちメニューあり:', [...sellers].filter(i => ids.has(i)).length)
const mine = m.filter(x => ids.has(x.seller_id))
console.log('public_sellers に属するメニュー品数:', mine.length, '価格あり', mine.filter(x=>nn(x.price)).length, '写真あり', mine.filter(x=>nn(x.photo_url)).length)
