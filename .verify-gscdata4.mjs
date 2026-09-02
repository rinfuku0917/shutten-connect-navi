import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all=[], from=0
for(;;){ const {data,error}=await sb.from('posts').select('slug,title,status,published_at,updated_at').range(from,from+999)
  if(error){console.log('err',error.message);break}
  all=all.concat(data); if(data.length<1000)break; from+=1000 }
console.log('posts 総数(匿名で見える):', all.length)
console.log('\nslug | status | published_at')
for(const p of all.sort((a,b)=>(a.status>b.status?1:-1))) console.log(`${p.slug} | ${p.status} | ${p.published_at||'-'}`)
