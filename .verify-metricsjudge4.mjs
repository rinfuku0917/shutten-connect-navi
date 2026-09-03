import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
const {data,error}=await db.from('public_sellers').select('*').eq('id','2b7f698b-7480-4a59-9e83-20a536b10948')
console.log(error?error.message:JSON.stringify(data[0],null,1))
