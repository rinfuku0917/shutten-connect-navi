import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data, error } = await sb.from('places').select('*').limit(2)
if (error) { console.log('ERR', error); process.exit(1) }
console.log('COLUMNS:', Object.keys(data[0]).join(', '))
console.log('\nSAMPLE schedule:', JSON.stringify(data[0].schedule))
console.log('SAMPLE open_days:', JSON.stringify(data[0].open_days))
