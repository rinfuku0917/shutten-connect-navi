import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const cols = 'id, title, prefecture, status, closed, fee, price_fixed, price_share_pct, company_fixed_amount, company_share_pct, day_type_fees, place_type, schedule'
let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select(cols).range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  all = all.concat(data); if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中:', pub.length)

const fixedOf = p => (p.price_fixed || 0) + (p.company_fixed_amount || 0)
const pctOf = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
const d = p => (p.day_type_fees && typeof p.day_type_fees === 'object') ? p.day_type_fees : null
const sideAmt = (p, k) => { const x = d(p); if (!x || !x[k]) return null
  const a = typeof x[k].placeFee === 'number' ? x[k].placeFee : null
  const b = typeof x[k].companyFee === 'number' ? x[k].companyFee : null
  return (a === null && b === null) ? null : (a || 0) + (b || 0) }

console.log('\n===== 全110件の生データ（fee本文つき）=====')
pub.forEach((p, i) => {
  console.log(`${String(i + 1).padStart(3)} | type=${p.place_type} | fixed=${fixedOf(p)} pct=${pctOf(p)} dtf=${sideAmt(p,'weekday')}/${sideAmt(p,'weekend')} | ${p.prefecture} | ${p.title}`)
  console.log(`      fee: ${JSON.stringify(p.fee)}`)
})
