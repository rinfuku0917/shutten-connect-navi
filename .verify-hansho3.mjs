import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim()] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const out = []
for (let f = 0; ; f += 1000) {
  const { data } = await sb.from('places').select('*').range(f, f + 999)
  out.push(...data); if (data.length < 1000) break
}
const pub = out.filter(r => r.status === 'published' && !r.closed)
const has = x => x && typeof x === 'object' && ['weekday','weekend'].some(k => x[k] && (typeof x[k].placeFee === 'number' || typeof x[k].companyFee === 'number'))

console.log('=== 17件の day_type_fees の内訳と、公開表示の fee テキストの照合 ===')
for (const r of pub.filter(r => has(r.day_type_fees))) {
  const d = r.day_type_fees
  const wd = (d.weekday?.placeFee||0) + (d.weekday?.companyFee||0)
  const we = (d.weekend?.placeFee||0) + (d.weekend?.companyFee||0)
  const first = String(r.fee||'').split('\n')[0]
  console.log(`${r.title}\n   DB: 平日 place=${d.weekday?.placeFee} + company=${d.weekday?.companyFee} = ${wd} / 週末 place=${d.weekend?.placeFee} + company=${d.weekend?.companyFee} = ${we}`)
  console.log(`   公開文言: ${first}`)
}

console.log('\n=== 歩合44件: place側とcompany側の内訳 ===')
const pct = pub.filter(r => (r.price_share_pct||0)+(r.company_share_pct||0) > 0)
console.log('price_share_pct > 0 の件数（＝場所側に%が入っている案件）:', pct.filter(r => (r.price_share_pct||0) > 0).length)
console.log('company_share_pct > 0 の件数（＝運営側に%が入っている案件）:', pct.filter(r => (r.company_share_pct||0) > 0).length)

console.log('\n=== 公開中110件全体で構造化の金額を持つ件数 ===')
console.log('price_fixed > 0:', pub.filter(r => (r.price_fixed||0) > 0).length)
console.log('company_fixed_amount > 0:', pub.filter(r => (r.company_fixed_amount||0) > 0).length)
console.log('day_type_fees あり:', pub.filter(r => has(r.day_type_fees)).length)
console.log('→ 上記いずれも無く fee 自由記述だけの案件:',
  pub.filter(r => !has(r.day_type_fees) && (r.price_fixed||0)===0 && (r.company_fixed_amount||0)===0 && (r.price_share_pct||0)===0 && (r.company_share_pct||0)===0).length)

console.log('\n=== fee テキストから拾った「平日/週末」金額（構造化なしの固定案件） ===')
const yen = s => [...String(s||'').matchAll(/([0-9][0-9,]*)\s*円/g)].map(m => parseInt(m[1].replace(/,/g,''),10))
const textFixed = pub.filter(r => !has(r.day_type_fees) && (r.price_share_pct||0)+(r.company_share_pct||0)===0 && yen(r.fee).length>0)
console.log('件数:', textFixed.length)
for (const r of textFixed) console.log(`  ${yen(r.fee).join(' / ')}  ← ${String(r.fee).replace(/\n/g,' ')}   [${r.title}]`)
