import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// ---- ページング必須（1000行で切られる）----
async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const u = `${URL_}/rest/v1/${table}?select=${encodeURIComponent(cols)}`
    const r = await fetch(u, { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${from}-${from + 999}` } })
    if (!r.ok) { console.log('ERR', table, r.status, await r.text()); break }
    const j = await r.json()
    out.push(...j)
    if (j.length < 1000) break
  }
  return out
}

const cols = 'id,title,status,closed,fee,day_type_fees,schedule,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,prefecture,place_type,address,host_id,description,recruit,details'
const rows = await all('places', cols)
console.log('places 総数:', rows.length)
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('公開中:', pub.length)

// ---- 記事が書いている「5,500 / 7,500」を fee本文から探す（全案件から）----
const hit = rows.filter(r => /5,?500/.test(r.fee || '') && /7,?500/.test(r.fee || ''))
console.log('\n=== fee本文に 5500 と 7500 が両方出る案件:', hit.length, '件 ===')
for (const r of hit) {
  console.log('---')
  console.log('id           :', r.id)
  console.log('title        :', r.title)
  console.log('status/closed:', r.status, r.closed)
  console.log('pref/type    :', r.prefecture, '/', r.place_type)
  console.log('host_id      :', r.host_id)
  console.log('fee          :', JSON.stringify(r.fee))
  console.log('day_type_fees:', JSON.stringify(r.day_type_fees))
  console.log('price_fixed  :', r.price_fixed, 'unit', r.place_fixed_unit, '/ company_fixed_amount', r.company_fixed_amount, 'unit', r.company_fixed_unit)
  console.log('share pct    :', r.price_share_pct, '/', r.company_share_pct)
  console.log('schedule     :', JSON.stringify(r.schedule))
  console.log('description  :', JSON.stringify((r.description || '').slice(0, 400)))
  console.log('recruit      :', JSON.stringify((r.recruit || '').slice(0, 300)))
}
