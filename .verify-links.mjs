import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// ---- ページング（1000行打ち切り対策） ----
async function fetchAll(table, cols, tweak = q => q) {
  const out = []
  const SIZE = 500
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await tweak(sb.from(table).select(cols)).range(from, from + SIZE - 1)
    if (error) { console.error('ERR', table, error.message); break }
    out.push(...data)
    if (data.length < SIZE) break
  }
  return out
}

const posts = await fetchAll('posts', 'id,slug,title,status,category,published_at,content')
console.log('=== posts 総数:', posts.length)
const byStatus = {}
for (const p of posts) byStatus[p.status] = (byStatus[p.status] || 0) + 1
console.log('=== status 内訳:', JSON.stringify(byStatus))

const pub = posts.filter(p => p.status === 'published')
const slugs = new Set(pub.map(p => p.slug))
const allSlugs = new Set(posts.map(p => p.slug))

console.log('\n=== 公開中', pub.length, '本 ===')
for (const p of pub.sort((a, b) => (a.published_at || '').localeCompare(b.published_at || ''))) {
  console.log(` ${p.slug}\t[${p.category}]\t${p.title}`)
}
console.log('\n=== 非公開（draft等） ===')
for (const p of posts.filter(p => p.status !== 'published')) {
  console.log(` ${p.status}\t${p.slug}\t${p.title}`)
}

// ---- 本文からリンク抽出（markdown + 生HTML の両方） ----
function extractLinks(md) {
  const urls = []
  // [text](url)
  for (const m of md.matchAll(/\]\(([^)\s]+)/g)) urls.push(m[1])
  // href="url"
  for (const m of md.matchAll(/href=["']([^"']+)["']/g)) urls.push(m[1])
  // 裸URL
  for (const m of md.matchAll(/https?:\/\/[^\s)"'<>]+/g)) urls.push(m[0])
  return urls
}
function toBlogSlug(u) {
  let s = u.replace(/^https?:\/\/[^/]+/, '')
  const m = s.match(/^\/blog\/([a-zA-Z0-9._-]+)/)
  return m ? m[1] : null
}

const REDIRECTS = {
  'how-to-find-food-truck-spots': 'kitchen-car-location-guide',
  'auto-mtarczbg-37pazo': 'renting-parking-space',
  'auto-mtgh64lh-jwwkxe': 'renting-parking-space',
  'auto-mta8z1w9-vazfy1': 'regular-event-schedule',
}

const outRaw = new Map()   // slug -> Set(target slug, 生のまま)
const otherLinks = new Map() // slug -> 記事以外のリンク
for (const p of posts) {
  const links = extractLinks(p.content || '')
  const arts = new Set(), others = []
  for (const u of links) {
    const t = toBlogSlug(u)
    if (t && t !== p.slug) arts.add(t)
    else if (!t) others.push(u)
  }
  outRaw.set(p.slug, arts)
  otherLinks.set(p.slug, others)
}

console.log('\n=== 記事→記事リンク（生・公開中の記事の発リンクのみ） ===')
for (const p of pub) {
  const t = [...outRaw.get(p.slug)]
  if (t.length) console.log(` ${p.slug} -> ${t.join(', ')}`)
}
console.log('\n=== 非公開記事の発リンク ===')
for (const p of posts.filter(p => p.status !== 'published')) {
  const t = [...outRaw.get(p.slug)]
  if (t.length) console.log(` [${p.status}] ${p.slug} -> ${t.join(', ')}`)
}

// ---- 公開中グラフ（発リンク元も先も公開中に限る／リダイレクトは解決） ----
const inn = new Map(), outd = new Map()
for (const s of slugs) { inn.set(s, new Set()); outd.set(s, new Set()) }
const dead = []
for (const p of pub) {
  for (const t0 of outRaw.get(p.slug)) {
    const t = REDIRECTS[t0] || t0
    if (slugs.has(t) && t !== p.slug) { outd.get(p.slug).add(t); inn.get(t).add(p.slug) }
    else dead.push(`${p.slug} -> ${t0}${REDIRECTS[t0] ? ` (=>${t})` : ''} ${allSlugs.has(t0) ? '[非公開]' : '[DB外]'}`)
  }
}

console.log('\n=== 公開中どうしの被/発リンク数 ===')
const rows = pub.map(p => ({ slug: p.slug, cat: p.category, in: inn.get(p.slug).size, out: outd.get(p.slug).size,
  froms: [...inn.get(p.slug)].join(' '), tos: [...outd.get(p.slug)].join(' ') }))
rows.sort((a, b) => b.in - a.in || b.out - a.out)
for (const r of rows) console.log(` 被${r.in} 発${r.out}  ${r.slug} [${r.cat}]\n        ←${r.froms || '(なし)'}\n        →${r.tos || '(なし)'}`)

console.log('\n被リンク0の公開記事:', rows.filter(r => r.in === 0).length, '/', pub.length)
console.log('  ', rows.filter(r => r.in === 0).map(r => r.slug).join('\n   '))
console.log('\n発リンク0の公開記事:', rows.filter(r => r.out === 0).length, '/', pub.length)
console.log('  ', rows.filter(r => r.out === 0).map(r => r.slug).join('\n   '))
console.log('\n被0かつ発0（完全孤立）:', rows.filter(r => r.in === 0 && r.out === 0).length)
console.log('  ', rows.filter(r => r.in === 0 && r.out === 0).map(r => r.slug).join('\n   '))

console.log('\n=== 公開中以外へ向かうリンク（切れ/非公開行き） ===')
for (const d of dead) console.log(' ', d)

// ---- 相互/一方通行 ----
const pairs = new Set()
let mutual = 0, oneway = 0
for (const [a, ts] of outd) for (const b of ts) {
  const k = [a, b].sort().join('|')
  if (pairs.has(k)) continue
  pairs.add(k)
  if (outd.get(b).has(a)) { mutual++; console.log(`相互: ${a} <-> ${b}`) }
  else { oneway++; console.log(`一方: ${a} -> ${b}`) }
}
console.log(`相互${mutual}組 / 一方通行${oneway}本`)

// ---- 名指しされた主張の個別確認 ----
console.log('\n=== 個別確認 ===')
const q = (a, b) => `${a}->${b}: ${outd.get(a)?.has(b) ? 'あり' : 'なし'}`
console.log(q('kitchen-car-location-guide', 'food-truck-fee-guide'))
console.log(q('food-truck-fee-guide', 'kitchen-car-location-guide'))
console.log(q('food-truck-fee-guide', 'renting-parking-space'))
console.log('renting-parking-space の被リンク元(公開中):', [...(inn.get('renting-parking-space') || [])].join(', ') || '(なし)')
console.log('renting-parking-space の被リンク元(全status):')
for (const p of posts) if (outRaw.get(p.slug).has('renting-parking-space')) console.log(`   [${p.status}] ${p.slug}`)

// ---- 本文中に「関連記事」的な断り書きがないか ----
console.log('\n=== 本文の「関連」記述の周辺（公開中） ===')
for (const p of pub) {
  const c = p.content || ''
  for (const m of c.matchAll(/[^\n]*(関連記事|あわせて|合わせて|くわしく|詳しく|こちら|別の記事|別記事)[^\n]*/g)) {
    if (m[0].includes('/blog/')) console.log(` ${p.slug}: ${m[0].trim().slice(0, 160)}`)
  }
}
