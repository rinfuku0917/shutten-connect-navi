import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(select) {
  const out = []
  const step = 500
  for (let from = 0; ; from += step) {
    const { data, error } = await sb
      .from('places')
      .select(select)
      .order('id', { ascending: true })
      .range(from, from + step - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < step) break
  }
  return out
}

const rows = await all('id,title,status,closed,prefecture,genres,description')
console.log('places total rows:', rows.length)

const open = rows.filter(r => r.status === 'published' && !r.closed)
console.log('published & not closed:', open.length)

// genres emptiness
const genreEmpty = open.filter(r => !r.genres || (Array.isArray(r.genres) && r.genres.length === 0))
console.log('genres empty among open:', genreEmpty.length)
const genreFilled = open.filter(r => Array.isArray(r.genres) && r.genres.length > 0)
console.log('genres filled among open:', genreFilled.length)
console.log('genres values:', JSON.stringify(genreFilled.map(r => ({ t: r.title, g: r.genres })), null, 1))

// prefecture tally
const pref = {}
for (const r of open) pref[r.prefecture ?? 'null'] = (pref[r.prefecture ?? 'null'] ?? 0) + 1
console.log('prefecture tally:', JSON.stringify(Object.entries(pref).sort((a, b) => b[1] - a[1]), null, 1))

fs.writeFileSync(
  '.verify-open-titles.json',
  JSON.stringify(open.map(r => ({ id: r.id, title: r.title, pref: r.prefecture, genres: r.genres })), null, 1)
)
console.log('--- titles ---')
open.forEach((r, i) => console.log(String(i + 1).padStart(3), '|', r.prefecture, '|', r.title))
