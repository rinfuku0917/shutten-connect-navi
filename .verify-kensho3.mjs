import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0,i).trim(), l.slice(i+1).trim().replace(/^["']|["']$/g,'')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
for (const t of ['blog_posts','posts']) {
  const { data, error, count } = await sb.from(t).select('slug,status', { count: 'exact' }).limit(3)
  console.log(t, '->', error ? 'ERR: ' + error.message : `count=${count}`)
}
const { data } = await sb.from('posts').select('slug,status')
const byStatus = {}
for (const p of data) (byStatus[p.status] ??= []).push(p.slug)
console.log('\nstatus内訳:', Object.fromEntries(Object.entries(byStatus).map(([k,v])=>[k,v.length])))
