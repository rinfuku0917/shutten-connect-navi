import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const { data } = await sb.from('places')
  .select('id,title,fee,latitude,longitude,prefecture,details,max_slots')
  .eq('status', 'published').is('closed', false)
  .not('latitude', 'is', null).limit(3)
for (const p of data) {
  console.log(p.id, '|', p.prefecture, '|', p.title.slice(0, 20), '|', JSON.stringify(p.fee))
}
