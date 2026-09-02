import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')]
    })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(cols) {
  const out = []
  let from = 0
  const step = 500
  for (;;) {
    const { data, error } = await sb.from('places').select(cols).range(from, from + step - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < step) break
    from += step
  }
  return out
}

const rows = await all('id, title, status, closed, fee, day_type_fees, price_fixed, price_share_pct, place_fixed_unit, company_fixed_amount, company_fixed_unit, company_share_pct, share_tax_basis, share_tax_rate, schedule, prefecture, place_type, created_at, posted_at')
console.log('total places rows:', rows.length)

const hits = rows.filter(r => /高井戸|ドン・キホーテ|ドンキ|ドン キホーテ/.test(r.title || ''))
console.log('--- name matches:', hits.length)
for (const h of hits) {
  console.log(JSON.stringify({
    id: h.id, title: h.title, status: h.status, closed: h.closed,
    fee: h.fee,
    day_type_fees: h.day_type_fees,
    price_fixed: h.price_fixed, price_share_pct: h.price_share_pct,
    place_fixed_unit: h.place_fixed_unit,
    company_fixed_amount: h.company_fixed_amount, company_fixed_unit: h.company_fixed_unit,
    company_share_pct: h.company_share_pct,
    share_tax_basis: h.share_tax_basis, share_tax_rate: h.share_tax_rate,
    prefecture: h.prefecture, place_type: h.place_type,
    posted_at: h.posted_at,
  }, null, 2))
}

fs.writeFileSync(new URL('./.verify-donki-dump.json', import.meta.url), JSON.stringify(rows, null, 2))
console.log('dumped all rows to .verify-donki-dump.json')
