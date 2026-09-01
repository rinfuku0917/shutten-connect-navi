import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data, error } = await sb.from('posts').select('*').eq('slug','food-truck-fee-guide')
if (error) { console.log('ERR', error); process.exit(1) }
for (const p of data) {
  console.log('id', p.id)
  console.log('slug', p.slug, '| status', p.status)
  console.log('published_at :', p.published_at)
  console.log('created_at   :', p.created_at)
  console.log('updated_at   :', p.updated_at)
  console.log('title        :', p.title)
  console.log('keys:', Object.keys(p).join(','))
  console.log('content len  :', (p.content||'').length)
  const m = (p.content||'').match(/2026年\d+月\d+日/g)
  console.log('content内の日付表記:', JSON.stringify(m))
  console.log('meta_desc:', p.meta_description)
}
