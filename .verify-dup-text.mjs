import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data } = await db.from('posts').select('*').in('slug',['auto-mtarczbg-37pazo','auto-mtgh64lh-jwwkxe'])
for (const p of data.sort((a,b)=>a.published_at.localeCompare(b.published_at))) {
  console.log('='.repeat(90))
  console.log('SLUG:', p.slug, '| pub:', p.published_at, '| len:', p.content.length)
  console.log('TITLE:', p.title)
  console.log('TARGET_KEYWORD:', JSON.stringify(p.target_keyword))
  console.log('REL_PREF:', JSON.stringify(p.related_prefecture), '| REL_CAT:', JSON.stringify(p.related_category))
  console.log('EXCERPT:', p.excerpt)
  console.log('META:', p.meta_description)
  console.log('--- HEADINGS ---')
  for (const line of p.content.split('\n')) if (/^#{2,3}\s/.test(line)) console.log(line)
  console.log('')
}
