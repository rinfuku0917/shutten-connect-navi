import fs from 'node:fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const U=env.NEXT_PUBLIC_SUPABASE_URL,K=env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function pageAll(t,s){const o=[];for(let f=0;;f+=1000){const r=await fetch(`${U}/rest/v1/${t}?select=${s}&order=id.asc`,{headers:{apikey:K,Authorization:`Bearer ${K}`,Range:`${f}-${f+999}`,'Range-Unit':'items'}});if(!r.ok)throw new Error(await r.text());const rows=await r.json();o.push(...rows);if(rows.length<1000)break}return o}
const pub=(await pageAll('places','*')).filter(p=>p.status==='published'&&!p.closed)
const types={}
for(const p of pub) types[p.place_type||'(空)']=(types[p.place_type||'(空)']||0)+1
console.log('place_type 内訳:'); Object.entries(types).sort((a,b)=>b[1]-a[1]).forEach(([k,v])=>console.log(`  ${k}: ${v}`))
const sup=pub.filter(p=>(p.place_type||'').includes('スーパー'))
console.log('\nスーパー系 件数:', sup.length)
const fixed=sup.filter(p=>p.price_fixed!=null&&p.price_fixed>0&&!(p.price_share_pct>0))
const share=sup.filter(p=>p.price_share_pct>0&&!(p.price_fixed>0))
const both=sup.filter(p=>p.price_fixed>0&&p.price_share_pct>0)
const none=sup.filter(p=>!(p.price_fixed>0)&&!(p.price_share_pct>0))
console.log(`  固定のみ:${fixed.length} 歩合のみ:${share.length} 併用:${both.length} どちらも無し:${none.length}`)
