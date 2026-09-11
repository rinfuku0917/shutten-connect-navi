import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}})
const { data, error } = await db.from('posts')
  .select('slug,title,content,category,status,published_at,updated_at,meta_description,excerpt,target_keyword,related_prefecture,related_category')
if (error) { console.error('ERR', error); process.exit(1) }
const out = []
out.push(`TOTAL ROWS (all statuses): ${data.length}`)
out.push('--- STATUS TABLE ---')
for (const p of data.sort((a,b)=>String(a.published_at).localeCompare(String(b.published_at)))) {
  out.push(`${String(p.status).padEnd(10)} ${String(p.published_at||'').slice(0,10)} ${String((p.content||'').length).padStart(6)} ${String(p.category||'').padEnd(20)} kw=${String(p.target_keyword||'-').padEnd(28)} ${p.slug}`)
}
out.push('')
for (const p of data.filter(p=>p.status==='published')) {
  out.push('='.repeat(90))
  out.push(`SLUG: ${p.slug}`)
  out.push(`TITLE: ${p.title}`)
  out.push(`TARGET_KEYWORD: ${p.target_keyword ?? ''}`)
  out.push(`CATEGORY: ${p.category}  REL_PREF: ${p.related_prefecture ?? ''}  REL_CAT: ${p.related_category ?? ''}`)
  out.push(`PUBLISHED_AT: ${p.published_at}  UPDATED_AT: ${p.updated_at}`)
  out.push(`META_DESCRIPTION: ${p.meta_description ?? ''}`)
  out.push(`EXCERPT: ${p.excerpt ?? ''}`)
  out.push(`LEN: ${(p.content||'').length}`)
  out.push('--- HEADINGS ---')
  const lines = (p.content||'').split('\n')
  for (const l of lines) {
    if (/^\s{0,3}#{1,4}\s/.test(l)) out.push(l.trim())
    else if (/<h[1-4][\s>]/i.test(l)) out.push(l.trim().slice(0,220))
  }
  out.push('--- FIRST 450 CHARS ---')
  out.push((p.content||'').replace(/\s+/g,' ').slice(0,450))
  out.push('--- INTERNAL LINKS (/blog, /vendor, /places) ---')
  const links = [...(p.content||'').matchAll(/\]\((\/[^)]+)\)|href="(\/[^"]+)"/g)].map(m=>m[1]||m[2])
  out.push([...new Set(links)].join(' | '))
  out.push('')
}
fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts-dump.txt', out.join('\n'))
console.log('wrote. published =', data.filter(p=>p.status==='published').length, '/ all =', data.length)
