import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] }))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places')
    .select('id,title,status,closed,place_type,fee,day_type_fees')
    .range(from, from + 499)
  if (error) { console.error(error); process.exit(1) }
  all.push(...data); if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)
pub.forEach((p, i) => {
  console.log(`[${String(i + 1).padStart(3)}] ${p.place_type === 'event' ? 'イベント' : '常設　　'} | dtf:${p.day_type_fees ? 'Y' : '-'} | ${JSON.stringify(p.fee)}`)
})
