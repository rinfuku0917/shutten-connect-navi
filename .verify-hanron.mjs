// 独立検証用。読み取りのみ。
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

async function all(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const places = await all('places')
const live = places.filter(p => p.status === 'published' && !p.closed)
console.log('全places:', places.length, '/ 公開中:', live.length)

fs.writeFileSync(
  '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/live.json',
  JSON.stringify(live.map(p => ({ id: p.id, title: p.title, place_type: p.place_type, prefecture: p.prefecture, fee: p.fee })), null, 2),
)
console.log('書き出しました')
