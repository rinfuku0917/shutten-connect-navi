import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const U=env.NEXT_PUBLIC_SUPABASE_URL, K=env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function pageAll(t,s){const o=[];for(let f=0;;f+=1000){const r=await fetch(`${U}/rest/v1/${t}?select=${s}&order=id.asc`,{headers:{apikey:K,Authorization:`Bearer ${K}`,Range:`${f}-${f+999}`,'Range-Unit':'items'}});if(!r.ok)throw new Error(t+' '+r.status+' '+await r.text());const rows=await r.json();o.push(...rows);if(rows.length<1000)break}return o}
const places = await pageAll('places','*')
console.log('places 全行:', places.length)
console.log('列:', Object.keys(places[0]||{}).join(', '))
const pub = places.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(status=published かつ closed偽):', pub.length)
