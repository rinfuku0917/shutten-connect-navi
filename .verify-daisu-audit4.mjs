import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('='))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
const rows=[]
for(let f=0;;f+=500){const{data,error}=await db.from('places').select('*').range(f,f+499)
  if(error)throw new Error(error.message); rows.push(...data); if(data.length<500)break}
const live = rows.filter(p=>p.status==='published' && !p.closed)
const g = new Map()
for(const p of live){const k=p.host_id; if(!g.has(k))g.set(k,[]); g.get(k).push(p)}
console.log('=== 募集中110件 host別 max_slots ===')
for(const [k,arr] of [...g].sort((a,b)=>b[1].length-a[1].length)){
  const d={}; for(const p of arr){const kk=p.max_slots==null?'(空)':String(p.max_slots); d[kk]=(d[kk]||0)+1}
  console.log(`host=${String(k).slice(0,8)} ${String(arr.length).padStart(3)}件 ${JSON.stringify(d).padEnd(22)} 例: ${String(arr[0].title).slice(0,28)}`)
}
const five = live.filter(p=>p.max_slots===5)
console.log('\nmax_slots=5 の88件の host 数:', new Set(five.map(p=>p.host_id)).size)
console.log('max_slots=3,4:')
for(const p of live.filter(p=>p.max_slots===3||p.max_slots===4)) console.log('  ',p.max_slots,'台 |',String(p.title).slice(0,40))
// 全302件でも同じ傾向か（母集団を変えて確かめる）
const dAll={}; for(const p of rows){const k=p.max_slots==null?'(空)':String(p.max_slots); dAll[k]=(dAll[k]||0)+1}
console.log('\n全302件の max_slots 分布:', JSON.stringify(dAll))
