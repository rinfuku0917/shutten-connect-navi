import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
async function all(t){const o=[];for(let f=0;;f+=1000){const{data,error}=await db.from(t).select('*').range(f,f+999);if(error)throw new Error(error.message);o.push(...data);if(data.length<1000)break}return o}
const live=(await all('places')).filter(p=>p.status==='published'&&!p.closed)
const has=v=>v!=null&&String(v).trim()!==''&&!(Array.isArray(v)&&v.length===0)
console.log('open_days が入っている', live.filter(p=>has(p.open_days)).length,'/',live.length)
const sample={}
for(const p of live){const k=JSON.stringify(p.open_days);sample[k]=(sample[k]??0)+1}
console.log(Object.entries(sample).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([k,v])=>`${v}件 ${k}`).join('\n'))
console.log('\n日付入り schedule あり', live.filter(p=>Array.isArray(p.schedule)&&p.schedule.filter(d=>d?.date).length>0).length)
console.log('open_days も schedule も無い', live.filter(p=>!has(p.open_days)&&!(Array.isArray(p.schedule)&&p.schedule.filter(d=>d?.date).length>0)).length)
console.log('\nmax_slots 未設定', live.filter(p=>p.max_slots==null).length)
console.log('genres が入っている', live.filter(p=>Array.isArray(p.genres)&&p.genres.length>0).length)
console.log('image_url あり', live.filter(p=>has(p.image_url)).length)
