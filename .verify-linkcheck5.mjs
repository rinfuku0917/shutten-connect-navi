import fs from 'node:fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const U=env.NEXT_PUBLIC_SUPABASE_URL,K=env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function pageAll(t,s){const o=[];for(let f=0;;f+=1000){const r=await fetch(`${U}/rest/v1/${t}?select=${s}&order=id.asc`,{headers:{apikey:K,Authorization:`Bearer ${K}`,Range:`${f}-${f+999}`,'Range-Unit':'items'}});if(!r.ok)throw new Error(await r.text());const rows=await r.json();o.push(...rows);if(rows.length<1000)break}return o}
const all=await pageAll('places','*')
const pub=all.filter(p=>p.status==='published'&&!p.closed)
const blob=p=>{const g=Array.isArray(p.genres)?p.genres.join(' '):(p.genres||'');return `${p.title||''} ${p.description||''} ${p.details||''} ${p.address||''} ${g} ${p.recruit||''} ${p.schedule||''}`}
for(const [label,set] of [['公開中110件',pub],['全302件',all]]){
  const re=/スーパー|ドラッグ|マート|食品館|ストア/
  const hit=set.filter(p=>/スーパー/.test(blob(p)))
  console.log(`\n${label}: 全文に「スーパー」 = ${hit.length}件`)
  const f=hit.filter(p=>p.price_fixed>0&&!(p.price_share_pct>0)).length
  const s=hit.filter(p=>p.price_share_pct>0&&!(p.price_fixed>0)).length
  const b=hit.filter(p=>p.price_fixed>0&&p.price_share_pct>0).length
  const n=hit.filter(p=>!(p.price_fixed>0)&&!(p.price_share_pct>0)).length
  console.log(`  固定のみ:${f} 歩合のみ:${s} 併用:${b} どちらも無し:${n}`)
}
// 参考: 記事の他の数字の裏取り
console.log('\n--- 記事の他の数字 ---')
const reg=pub.filter(p=>p.place_type==='regular')
console.log('常設(regular):',reg.length,' 固定のみ:',reg.filter(p=>p.price_fixed>0&&!(p.price_share_pct>0)).length,' 歩合のみ:',reg.filter(p=>p.price_share_pct>0&&!(p.price_fixed>0)).length)
console.log('公開中 固定のみ:',pub.filter(p=>p.price_fixed>0&&!(p.price_share_pct>0)).length,' 歩合のみ:',pub.filter(p=>p.price_share_pct>0&&!(p.price_fixed>0)).length,' 歩合を含む:',pub.filter(p=>p.price_share_pct>0).length)
