import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('='))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
const rows=[]
for(let f=0;;f+=500){const{data,error}=await db.from('places').select('*').range(f,f+499)
  if(error)throw new Error(error.message); rows.push(...data); if(data.length<500)break}
const live = rows.filter(p=>p.status==='published' && !p.closed)
const five = live.filter(p=>p.max_slots===5)
console.log('=== max_slots=5 の88件（先頭30件）===')
five.slice(0,30).forEach((p,i)=>console.log(String(i+1).padStart(2), String(p.title).slice(0,44)))
// 屋号のかたまり（系列の目安）
const brand = t => String(t).replace(/[【（(].*?[】）)]/g,'').trim().split(/[ 　]/)[0]
const m={}; for(const p of five){const b=brand(p.title); m[b]=(m[b]||0)+1}
console.log('\n=== 5台の88件、屋号ごと（2件以上）===')
console.log(Object.entries(m).filter(([,n])=>n>1).sort((a,b)=>b[1]-a[1]).map(([b,n])=>`${b}:${n}`).join(' / '))
console.log('屋号の種類:', Object.keys(m).length)
// 作成日時 → 一括投入かどうか
const days={}; for(const p of five){const d=String(p.created_at).slice(0,10); days[d]=(days[d]||0)+1}
console.log('\n=== 5台の88件、作成日ごと ===')
console.log(JSON.stringify(days))
const days2={}; for(const p of live.filter(p=>p.max_slots==null)){const d=String(p.created_at).slice(0,10); days2[d]=(days2[d]||0)+1}
console.log('=== 空20件、作成日ごと ===')
console.log(JSON.stringify(days2))
