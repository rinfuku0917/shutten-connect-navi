import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
for (const t of ['imported_sellers','profiles','public_sellers','menus','places','reviews','sales','applications','seller_documents','meeting_requests','posts']) {
  const { count, error } = await db.from(t).select('*', { count: 'exact', head: true })
  console.log(t.padEnd(20), error ? 'エラー: ' + (error.message || error.code || '(空)') : '件数=' + count)
}
