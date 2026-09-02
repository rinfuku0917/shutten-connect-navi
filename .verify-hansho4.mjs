import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync(new URL('./.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data, error } = await sb.from('posts').select('*')
if (error) { console.log('posts ERR:', error.message) }
for (const p of (data||[])) {
  if (!['renting-parking-space','food-truck-fee-guide'].includes(p.slug)) continue
  console.log('---', p.slug, '| status=', p.status)
  const hit = ['手数料','内数','差し引','仲介','取り分','受け取る額'].filter(w => (p.content||p.body_md||'').includes(w))
  console.log('  本文中の手数料関連ワード:', hit.length ? hit.join(',') : 'なし')
  console.log('  meta:', p.meta_description)
}
