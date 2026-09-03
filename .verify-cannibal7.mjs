// 内部リンクの図と、既存記事との食い合い
import fs from 'fs'
const SC = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad'
const posts = JSON.parse(fs.readFileSync(`${SC}/posts.json`, 'utf8'))
const MS = ['food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space',
  'kitchen-car-required-documents', 'get-food-truck-offers', 'weekday-food-truck-spots',
  'supermarket-food-truck', 'mall-food-truck-event']
const NEW = new Set(MS)
const MERGED = new Set(['how-to-find-food-truck-spots', 'auto-mtarczbg-37pazo', 'auto-mtgh64lh-jwwkxe',
  'auto-mta8z1w9-vazfy1', 'choose-profitable-food-truck-location', 'host-fee-setting-guide2',
  'event-food-truck-guide'])
const body = raw => raw.replace(/^---\n[\s\S]*?\n---\n/, '')
const doc = {}
for (const s of MS) doc[s] = { slug: s, text: body(fs.readFileSync(`docs/blog/${s}.md`, 'utf8')), src: '原稿' }
for (const p of posts) if (!doc[p.slug]) doc[p.slug] = { slug: p.slug, text: String(p.content ?? ''), src: 'DB' }

const slugs = Object.keys(doc).filter(s => !MERGED.has(s))
const out = {}, inn = {}, ext = {}
for (const s of slugs) { out[s] = new Set(); inn[s] = new Set(); ext[s] = new Set() }
for (const s of slugs) {
  for (const m of doc[s].text.matchAll(/\]\((\/[^)\s]*)\)/g)) {
    const href = m[1]
    const b = href.match(/^\/blog\/([a-z0-9\-]+)/)
    if (b) {
      const t = b[1]
      if (t === s) continue
      out[s].add(t); if (inn[t]) inn[t].add(s)
      if (!slugs.includes(t)) out[s].add(t)
    } else ext[s].add(href.split('?')[0])
  }
}
console.log('=== 記事どうしの内部リンク（statusは全件published） ===')
console.log('（★＝今回の8本、[統合済み]＝一覧・サイトマップから除外）\n')
const label = s => (NEW.has(s) ? '★' : ' ') + s
for (const s of slugs.sort()) {
  const o = [...out[s]].filter(t => !t.startsWith('/'))
  console.log(`${label(s)}`)
  console.log(`   → 出リンク(${o.length}): ${o.map(t => (MERGED.has(t) ? `${t}[統合済み]` : t)).join(', ') || 'なし'}`)
  console.log(`   ← 被リンク(${inn[s].size}): ${[...inn[s]].join(', ') || '★★ゼロ★★'}`)
  console.log(`   → 記事以外: ${[...ext[s]].join(', ') || 'なし'}`)
}
console.log('\n=== まとめ ===')
const zeroIn = slugs.filter(s => inn[s].size === 0)
const zeroOut = slugs.filter(s => [...out[s]].filter(t => !t.startsWith('/')).length === 0)
const oneWay = []
for (const s of slugs) for (const t of out[s]) if (slugs.includes(t) && !out[t]?.has(s)) oneWay.push(`${s} → ${t}`)
const mutual = []
for (const s of slugs) for (const t of out[s]) if (slugs.includes(t) && out[t]?.has(s) && s < t) mutual.push(`${s} ⇄ ${t}`)
console.log(`被リンクゼロ(${zeroIn.length}): ${zeroIn.map(label).join(', ')}`)
console.log(`記事への出リンクゼロ＝行き止まり(${zeroOut.length}): ${zeroOut.map(label).join(', ')}`)
console.log(`\n相互リンク(${mutual.length}):`); mutual.forEach(x => console.log('  ' + x))
console.log(`\n一方通行(${oneWay.length}):`); oneWay.forEach(x => console.log('  ' + x))

// mermaid
console.log('\n=== mermaid ===')
console.log('flowchart LR')
for (const s of slugs) for (const t of out[s]) if (slugs.includes(t)) console.log(`  ${s.replace(/-/g, '_')} --> ${t.replace(/-/g, '_')}`)
