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

async function all(table, cols, apply = q => q) {
  const out = []
  for (let from = 0; ; from += 1000) {
    let q = sb.from(table).select(cols).range(from, from + 999)
    q = apply(q)
    const { data, error } = await q
    if (error) throw new Error(table + ': ' + error.message)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const places = await all(
  'places',
  'id,title,prefecture,place_type,status,closed,fee,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,day_type_fees,schedule,genres,created_at'
)

console.log('places total rows:', places.length)
const pub = places.filter(p => p.status === 'published' && !p.closed)
console.log('published & not closed:', pub.length)

fs.writeFileSync(
  new URL('./.verify-kensho-dump.json', import.meta.url),
  JSON.stringify(pub, null, 2)
)
console.log('dumped to .verify-kensho-dump.json')
