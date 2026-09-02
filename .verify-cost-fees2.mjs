import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const rows=[]
for(let f=0;;f+=1000){
  const {data,error}=await sb.from('places').select('*').range(f,f+999)
  if(error){console.log('ERR',error.message);break}
  rows.push(...data); if(data.length<1000)break
}
const pub = rows.filter(r=>r.status==='published' && !r.closed)
console.log('--- 料金系カラムの中身サンプル(regular 6件) ---')
for(const r of pub.filter(r=>r.place_type==='regular').slice(0,6)){
  console.log(JSON.stringify({t:r.title?.slice(0,26), fee:r.fee, company_fixed_amount:r.company_fixed_amount, company_fixed_unit:r.company_fixed_unit, company_share_pct:r.company_share_pct, day_type_fees:r.day_type_fees, price_fixed:r.price_fixed, price_share_pct:r.price_share_pct}))
}
console.log('\n--- event 13件の料金系 ---')
for(const r of pub.filter(r=>r.place_type==='event')){
  console.log(JSON.stringify({t:r.title?.slice(0,26), fee:r.fee, cfa:r.company_fixed_amount, cfu:r.company_fixed_unit, csp:r.company_share_pct, dtf:r.day_type_fees}))
}
