import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}})
const { data, error } = await db.from('posts').select('slug,title,content,category,status,published_at').eq('status','published')
if (error) { console.error(error); process.exit(1) }
fs.mkdirSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts', {recursive:true})
const dir = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/posts'
for (const p of data) {
  fs.writeFileSync(`${dir}/${p.slug}.md`, `# ${p.title}\ncategory: ${p.category}\npublished: ${p.published_at}\n\n${p.content}`)
}
console.log('count', data.length)
console.log(data.map(p=>`${p.slug}\t${p.category}\t${p.content.length}\t${p.title}`).join('\n'))
