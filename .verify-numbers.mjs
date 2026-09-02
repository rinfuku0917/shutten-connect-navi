import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function fetchAll(table, query) {
  const out = []
  let from = 0
  const step = 1000
  for (;;) {
    const res = await fetch(`${URL_}/rest/v1/${table}?${query}`, {
      headers: {
        apikey: KEY, Authorization: `Bearer ${KEY}`,
        Range: `${from}-${from + step - 1}`, 'Range-Unit': 'items', Prefer: 'count=exact',
      },
    })
    if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
    const rows = await res.json()
    out.push(...rows)
    if (rows.length < step) break
    from += step
  }
  return out
}

const all = await fetchAll('places', 'select=*&order=id')
console.log('places 全行:', all.length)
const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(status=published かつ closed が真でない):', pub.length)

// place_type
const byType = {}
for (const p of pub) byType[p.place_type ?? 'null'] = (byType[p.place_type ?? 'null'] || 0) + 1
console.log('place_type:', byType)

// 都道府県
const byPref = {}
for (const p of pub) byPref[p.prefecture ?? 'null'] = (byPref[p.prefecture ?? 'null'] || 0) + 1
console.log('都道府県:', Object.entries(byPref).sort((a, b) => b[1] - a[1]))

fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json', JSON.stringify(pub, null, 1))
console.log('saved')
