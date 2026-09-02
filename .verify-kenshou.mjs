import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim().replace(/^"|"$/g,'')]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all=[], from=0
for(;;){
  const {data,error} = await sb.from('places').select('*').range(from, from+499)
  if(error){console.error(error); process.exit(1)}
  all=all.concat(data)
  if(data.length<500) break
  from+=500
}
console.log('total rows', all.length)
console.log('columns:', Object.keys(all[0]||{}).join(', '))
const pub = all.filter(p=>p.status==='published' && !p.closed)
console.log('published & not closed:', pub.length)
console.log('status counts', all.reduce((a,p)=>(a[p.status]=(a[p.status]||0)+1,a),{}))
fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json', JSON.stringify(pub,null,1))
console.log(JSON.stringify(pub[0],null,1).slice(0,3000))
