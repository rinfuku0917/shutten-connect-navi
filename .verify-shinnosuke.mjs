import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function pageAll(table, query) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL_}/rest/v1/${table}?${query}&offset=${from}&limit=1000`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
    })
    if (!res.ok) return { error: `${res.status} ${await res.text()}` }
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < 1000) break
  }
  return out
}

const all = await pageAll('places', 'select=*&status=eq.published')
if (all.error) { console.log('places error', all.error); process.exit(1) }
console.log('published rows total:', all.length)
console.log('columns:', Object.keys(all[0]).join(', '))
const open = all.filter(p => !p.closed)
console.log('published & not closed:', open.length)
console.log('place_type counts:', JSON.stringify(
  open.reduce((a, p) => { a[p.place_type ?? 'null'] = (a[p.place_type ?? 'null'] || 0) + 1; return a }, {}), null, 1))
fs.writeFileSync(new URL('.verify-shinnosuke-open.json', import.meta.url), JSON.stringify(open, null, 1))

// 応募・売上まわりが匿名キーで読めるかを実際に叩いて確かめる
for (const t of ['applications', 'seller_documents', 'sales_reports', 'sales_items', 'invoices', 'public_sellers', 'posts']) {
  const res = await fetch(`${URL_}/rest/v1/${t}?select=*&limit=1`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  })
  console.log(`table ${t}: ${res.status} ${res.ok ? JSON.stringify(await res.json()).slice(0, 120) : (await res.text()).slice(0, 120)}`)
}
