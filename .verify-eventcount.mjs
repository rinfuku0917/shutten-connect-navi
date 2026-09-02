import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, select) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999)
    if (error) throw error
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const rows = await all('places', '*')
console.log('places 全行:', rows.length)
console.log('列:', Object.keys(rows[0]).join(', '))

const pub = rows.filter((r) => r.status === 'published' && !r.closed)
console.log('published かつ closed でない:', pub.length)

fs.writeFileSync('.verify-eventcount.json', JSON.stringify(pub, null, 2))
