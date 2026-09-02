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
console.log('places 全件:', rows.length)
console.log('カラム:', Object.keys(rows[0]||{}).join(', '))
const pub = rows.filter(r=>r.status==='published' && !r.closed)
console.log('公開中(status=published かつ closed偽):', pub.length)
const byType={}
for(const r of pub) byType[r.place_type||'(null)']=(byType[r.place_type||'(null)']||0)+1
console.log('place_type別:', JSON.stringify(byType))
