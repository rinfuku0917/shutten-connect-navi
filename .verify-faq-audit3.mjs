import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data } = await sb.from('posts').select('slug,title,content').order('slug')
for (const p of data) {
  const h2 = (p.content.match(/^##\s+.*$/gm)||[]).map(s=>s.replace(/^##\s*/,''))
  console.log(`\n${p.slug} (${(p.content||'').length}文字) "${p.title}"`)
  console.log('  h2:', JSON.stringify(h2))
}
