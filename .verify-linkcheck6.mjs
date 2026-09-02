import fs from 'node:fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const U=env.NEXT_PUBLIC_SUPABASE_URL,K=env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function pageAll(t,s){const o=[];for(let f=0;;f+=1000){const r=await fetch(`${U}/rest/v1/${t}?select=${s}&order=id.asc`,{headers:{apikey:K,Authorization:`Bearer ${K}`,Range:`${f}-${f+999}`,'Range-Unit':'items'}});if(!r.ok)throw new Error(await r.text());const rows=await r.json();o.push(...rows);if(rows.length<1000)break}return o}
const pub=(await pageAll('places','*')).filter(p=>p.status==='published'&&!p.closed)
// どの料金列に値が入っているか
const cols=['price_fixed','price_share_pct','fee','day_type_fees','company_fixed_amount','company_share_pct','place_fixed_unit']
for(const c of cols){
  const n=pub.filter(p=>p[c]!==null&&p[c]!==undefined&&p[c]!==''&&!(Array.isArray(p[c])&&!p[c].length)).length
  console.log(`${c}: 非空 ${n}/${pub.length}`)
}
console.log('\nサンプル3件:')
pub.slice(0,3).forEach(p=>console.log(' ', JSON.stringify({title:p.title,fee:p.fee,price_fixed:p.price_fixed,price_share_pct:p.price_share_pct,day_type_fees:p.day_type_fees})))
