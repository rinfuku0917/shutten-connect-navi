import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
for (let t=1;t<=3;t++){
  const { data, count } = await sb.from('posts').select('slug,status',{count:'exact'}).order('slug').range(0,999)
  console.log(`try${t}: count=${count} rows=${data.length}`)
  if(t===1) console.log(data.map(d=>d.slug).join('\n'))
}
