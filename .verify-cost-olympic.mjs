import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const {data}=await sb.from('places').select('title,fee,place_type').ilike('title','%Olympic 太田%').limit(1)
console.log('=== Olympic の fee 全文 ===\n'+data[0].fee)
const {data:d2}=await sb.from('places').select('title,fee').ilike('title','%美食EXPO%').limit(1)
console.log('\n=== 美食EXPO の fee 全文 ===\n'+d2[0].fee)
