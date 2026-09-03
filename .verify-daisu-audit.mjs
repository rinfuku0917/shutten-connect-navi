import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('='))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
const rows=[]
for(let f=0;;f+=500){const{data,error}=await db.from('places').select('*').range(f,f+499)
  if(error)throw new Error(error.message); rows.push(...data); if(data.length<500)break}
console.log('places 全行:', rows.length)
const live = rows.filter(p=>p.status==='published' && !p.closed)
console.log('募集中(published かつ closed でない):', live.length)
// closed の値の型を確認（真偽以外が混ざっていないか）
console.log('closed の値の種類:', JSON.stringify([...new Set(rows.map(p=>String(p.closed)))]))
const withSlots = live.filter(p=>p.max_slots!=null)
console.log('max_slots が入っている:', withSlots.length, '／ 空:', live.length-withSlots.length)
const dist={}; for(const p of live){const k=p.max_slots==null?'(空)':String(p.max_slots); dist[k]=(dist[k]||0)+1}
console.log('max_slots 分布:', JSON.stringify(dist))
// max_slots が 0 のものは「◯台」でどう出るか → 0台 と表示されてしまう
console.log('max_slots が 0 の件数:', live.filter(p=>p.max_slots===0).length)
