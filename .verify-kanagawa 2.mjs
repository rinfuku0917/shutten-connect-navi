import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1) total row count via head+exact (no row fetch)
const { count: total, error: e0 } = await sb.from('public_sellers').select('id', { count: 'exact', head: true })
console.log('public_sellers total (server count):', total, e0?.message ?? '')

// 2) sample the shape of areas
const { data: sample } = await sb.from('public_sellers').select('id, areas').limit(3)
console.log('sample areas:', JSON.stringify(sample, null, 1))

// 3) METHOD A: server-side count per prefecture using array-contains (cs).
//    This never pulls rows into node -> completely different path from "fetch all and tally".
const prefs = ['東京', '埼玉', '神奈川', '千葉', '茨城', '大阪',
               '東京都', '埼玉県', '神奈川県', '千葉県', '茨城県', '大阪府']
const serverCounts = {}
for (const p of prefs) {
  const { count, error } = await sb
    .from('public_sellers')
    .select('id', { count: 'exact', head: true })
    .contains('areas', [p])
  serverCounts[p] = error ? `ERR ${error.message}` : count
}
console.log('METHOD A server-side contains() counts:', serverCounts)

// 4) METHOD B: pull every row with .range() paging and tally client-side, plus
//    collect EVERY distinct area token so 表記ゆれ can be inspected exhaustively.
let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb
    .from('public_sellers')
    .select('id, areas')
    .order('id', { ascending: true })
    .range(from, from + 499)
  if (error) { console.log('page error', error.message); break }
  all = all.concat(data)
  if (data.length < 500) break
}
console.log('METHOD B rows fetched:', all.length, 'unique ids:', new Set(all.map(r => r.id)).size)

const tally = new Map()
let nullAreas = 0
for (const r of all) {
  if (!Array.isArray(r.areas)) { nullAreas++; continue }
  // dedupe within one seller so a duplicated entry cannot double-count
  for (const a of new Set(r.areas)) tally.set(a, (tally.get(a) ?? 0) + 1)
}
console.log('rows with non-array areas:', nullAreas)

const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1])
console.log('ALL distinct area tokens (count):', sorted.length)
console.log(sorted.map(([k, v]) => `${k}=${v}`).join('  '))

// 5) any token containing 神奈川 / 東京 / 千葉 etc. (catch whitespace / full-width variants)
for (const key of ['神奈川', '東京', '埼玉', '千葉', '茨城', '大阪']) {
  const hits = sorted.filter(([k]) => k.includes(key))
  console.log(`tokens containing ${key}:`, JSON.stringify(hits))
}

// 6) raw (non-deduped) tally for 神奈川 to see if dedupe changes anything
let rawKanagawa = 0, dedupKanagawa = 0, sellersWithKanagawa = new Set()
for (const r of all) {
  if (!Array.isArray(r.areas)) continue
  for (const a of r.areas) if (a === '神奈川') rawKanagawa++
  if (r.areas.includes('神奈川')) { dedupKanagawa++; sellersWithKanagawa.add(r.id) }
}
console.log('神奈川 raw occurrences:', rawKanagawa, '/ sellers:', dedupKanagawa, '/ unique seller ids:', sellersWithKanagawa.size)

// 7) published & open places per prefecture (for the 募集中の案件 column)
let places = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb
    .from('places')
    .select('id, prefecture, status, closed')
    .order('id', { ascending: true })
    .range(from, from + 499)
  if (error) { console.log('places error', error.message); break }
  places = places.concat(data)
  if (data.length < 500) break
}
const open = places.filter(p => p.status === 'published' && !p.closed)
const pTally = new Map()
for (const p of open) pTally.set(p.prefecture, (pTally.get(p.prefecture) ?? 0) + 1)
console.log('open places total:', open.length)
console.log('open places by prefecture:', [...pTally.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join('  '))
