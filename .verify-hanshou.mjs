// 反証用。metrics.mjs とは別の方法（PostgREST の count=exact ヘッダ）で数える。
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function count(qs) {
  const r = await fetch(`${URL_}/rest/v1/places?select=id&limit=1&${qs}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: 'count=exact' },
  })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return Number(r.headers.get('content-range').split('/')[1])
}

const rows = []
const push = async (label, qs) => rows.push([label, await count(qs)])

await push('places 全件', '')
await push('status=published (closed 問わず)', 'status=eq.published')
await push('published かつ closed=false', 'status=eq.published&closed=is.false')
await push('published かつ closed=true', 'status=eq.published&closed=is.true')
await push('published かつ closed is null', 'status=eq.published&closed=is.null')
await push('published 東京都 (closed 問わず)', 'status=eq.published&prefecture=eq.東京都')
await push('published 東京都 closed=false', 'status=eq.published&closed=is.false&prefecture=eq.東京都')
await push('published 東京都 closed=true', 'status=eq.published&prefecture=eq.東京都&closed=is.true')
await push('published 東京都 closed is null', 'status=eq.published&prefecture=eq.東京都&closed=is.null')

for (const [k, v] of rows) console.log(String(v).padStart(6), k)

// closed の値の分布（true/false/null 以外が無いか）
const r = await fetch(`${URL_}/rest/v1/places?select=closed,status&limit=2000`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})
const all = await r.json()
const dist = {}
for (const p of all) {
  const k = `${p.status} / closed=${JSON.stringify(p.closed)}`
  dist[k] = (dist[k] ?? 0) + 1
}
console.log('\n--- status × closed の分布（1回のfetchで取れた', all.length, '行）---')
for (const [k, v] of Object.entries(dist).sort()) console.log(String(v).padStart(6), k)

// /places の実際の1ページ目に何が並ぶか（page.tsx と同じ並び順を再現）
const r2 = await fetch(`${URL_}/rest/v1/places?select=id,title,prefecture,closed,pinned,posted_at&status=eq.published&order=pinned.desc,posted_at.desc&limit=1000`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
})
const pub = await r2.json()
console.log('\npublished 取得行数:', pub.length)
const sorted = pub.slice().sort((a, b) => (a.closed ? 1 : 0) - (b.closed ? 1 : 0))
console.log('/places 1ページ目(12件)の closed:', sorted.slice(0, 12).map(p => (p.closed ? '終' : '中')).join(''))
const firstClosedIdx = sorted.findIndex(p => p.closed)
console.log('最初に募集終了が出る位置:', firstClosedIdx + 1, '件目 = ', Math.floor(firstClosedIdx / 12) + 1, 'ページ目 / 全', Math.ceil(sorted.length / 12), 'ページ')

const tokyo = sorted.filter(p => p.prefecture === '東京都')
console.log('\npref=東京都 の件数(closed込み):', tokyo.length, '／募集中:', tokyo.filter(p => !p.closed).length)
console.log('pref=東京都 1ページ目の closed:', tokyo.slice(0, 12).map(p => (p.closed ? '終' : '中')).join(''))
const tIdx = tokyo.findIndex(p => p.closed)
console.log('東京都で最初に募集終了が出る位置:', tIdx + 1, '件目 =', Math.floor(tIdx / 12) + 1, 'ページ目 / 全', Math.ceil(tokyo.length / 12), 'ページ')
