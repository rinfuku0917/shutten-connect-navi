import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(Boolean).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})
const { data } = await sb.from('places').select('id,title,max_slots,closed,status,recruit,description')
  .eq('status', 'published').not('max_slots', 'is', null).limit(3)
for (const p of data) {
  console.log(p.id, '| max_slots=', p.max_slots, '| closed=', p.closed, '|', p.title)
  console.log('   recruit:', JSON.stringify((p.recruit || '').slice(0, 120)))
}
