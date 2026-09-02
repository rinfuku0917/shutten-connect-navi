import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places')
    .select('id,title,status,closed,place_type,fee,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,day_type_fees,schedule')
    .range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  all.push(...data); if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中:', pub.length)
// どの列に値が入っているか
const has = k => pub.filter(k).length
console.log('price_fixed>0:', has(p => (p.price_fixed || 0) > 0))
console.log('company_fixed_amount>0:', has(p => (p.company_fixed_amount || 0) > 0))
console.log('price_share_pct>0:', has(p => (p.price_share_pct || 0) > 0))
console.log('company_share_pct>0:', has(p => (p.company_share_pct || 0) > 0))
console.log('day_type_fees あり:', has(p => p.day_type_fees))
console.log('schedule あり:', has(p => Array.isArray(p.schedule) && p.schedule.length))
console.log('fee(自由文)あり:', has(p => p.fee && p.fee.trim()))
console.log('\n--- day_type_fees サンプル ---')
pub.filter(p => p.day_type_fees).slice(0, 6).forEach(p => console.log(p.place_type, JSON.stringify(p.day_type_fees), '| fee:', p.fee))
console.log('\n--- schedule サンプル(先頭2要素) ---')
pub.filter(p => Array.isArray(p.schedule) && p.schedule.length).slice(0, 6).forEach(p => console.log(p.place_type, JSON.stringify(p.schedule.slice(0, 2)), '| fee:', p.fee))
console.log('\n--- 数値列が全部0/nullの案件の fee 自由文（上位20）---')
pub.filter(p => !(p.price_fixed || 0) && !(p.company_fixed_amount || 0) && !(p.price_share_pct || 0) && !(p.company_share_pct || 0) && !p.day_type_fees)
  .slice(0, 20).forEach(p => console.log(' -', p.place_type, '|', JSON.stringify(p.fee), '| sched:', Array.isArray(p.schedule) ? p.schedule.length : 0))
