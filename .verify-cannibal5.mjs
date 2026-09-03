// 「12文字一致でX%」の定義を、被覆率（文字位置ベース）で測り直す
import fs from 'fs'
const SC = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad'
const posts = JSON.parse(fs.readFileSync(`${SC}/posts.json`, 'utf8'))
const MS = ['food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space',
  'kitchen-car-required-documents', 'get-food-truck-offers', 'weekday-food-truck-spots',
  'supermarket-food-truck', 'mall-food-truck-event']
const MERGED = new Set(['how-to-find-food-truck-spots', 'auto-mtarczbg-37pazo', 'auto-mtgh64lh-jwwkxe',
  'auto-mta8z1w9-vazfy1', 'choose-profitable-food-truck-location', 'host-fee-setting-guide2',
  'event-food-truck-guide'])
const body = raw => raw.replace(/^---\n[\s\S]*?\n---\n/, '')
const docs = {}
for (const s of MS) docs[s] = body(fs.readFileSync(`docs/blog/${s}.md`, 'utf8'))
for (const p of posts) if (!docs[p.slug]) docs[p.slug] = String(p.content ?? '')
docs['weekday@統合前'] = body(fs.readFileSync(`${SC}/weekday-before.md`, 'utf8'))
docs['location@統合前'] = body(fs.readFileSync(`${SC}/location-before.md`, 'utf8'))

// 軽い正規化：空白だけ潰す（記号・表の縦棒は残す）
const light = t => t.replace(/\s+/g, '')
// 強い正規化：記号も落とす
const hard = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[#*>`|:\-—–…「」『』（）()【】\[\]"'\/]/g, '').replace(/\s+/g, '')

// A のうち、B と12文字以上一致する部分が占める割合（文字位置ベース）
function coverage(a, b, n = 12) {
  const B = new Set(); for (let i = 0; i + n <= b.length; i++) B.add(b.slice(i, i + n))
  const hit = new Array(a.length).fill(false)
  for (let i = 0; i + n <= a.length; i++) if (B.has(a.slice(i, i + n))) for (let k = i; k < i + n; k++) hit[k] = true
  return hit.filter(Boolean).length / a.length
}
function pair(x, y, f, n = 12) {
  const A = f(docs[x]), B = f(docs[y])
  const ca = coverage(A, B, n), cb = coverage(B, A, n)
  return { ca, cb, avg: (ca + cb) / 2, max: Math.max(ca, cb),
    both: (coverage(A, B, n) * A.length + coverage(B, A, n) * B.length) / (A.length + B.length) }
}
const show = (label, x, y, f) => {
  const p = pair(x, y, f)
  console.log(`  ${label.padEnd(34)} A側 ${(p.ca * 100).toFixed(1).padStart(5)}%  B側 ${(p.cb * 100).toFixed(1).padStart(5)}%  平均 ${(p.avg * 100).toFixed(1).padStart(5)}%  合算 ${(p.both * 100).toFixed(1).padStart(5)}%`)
}
for (const [nm, f] of [['記号を残す', light], ['記号を落とす', hard]]) {
  console.log(`\n=== 12文字以上一致の被覆率（${nm}） ===`)
  show('統合前 探し方 × 統合前 平日', 'location@統合前', 'weekday@統合前', f)
  show('いま  探し方 × いま  平日', 'kitchen-car-location-guide', 'weekday-food-truck-spots', f)
  show('スーパー × 商業施設', 'supermarket-food-truck', 'mall-food-truck-event', f)
  show('スーパー × 駐車場', 'supermarket-food-truck', 'renting-parking-space', f)
  show('商業施設 × 駐車場', 'mall-food-truck-event', 'renting-parking-space', f)
  show('必要書類 × 出店依頼(参考)', 'kitchen-car-required-documents', 'get-food-truck-offers', f)
  show('出店料 × 探し方(参考)', 'food-truck-fee-guide', 'kitchen-car-location-guide', f)
}

// 統合済みを除いた全ペアを、記号を落とす版の「合算」で
const live = Object.keys(docs).filter(k => !k.includes('@') && !MERGED.has(k))
const rows = []
for (let i = 0; i < live.length; i++) for (let k = i + 1; k < live.length; k++) {
  const p = pair(live[i], live[k], hard); rows.push({ a: live[i], b: live[k], ...p })
}
rows.sort((p, q) => q.both - p.both)
console.log('\n=== 全ペア（統合済み5本を除く・16本＝120組）上位15 ===')
for (const r of rows.slice(0, 15))
  console.log(`  ${(r.both * 100).toFixed(1).padStart(5)}%  ${r.a.padEnd(34)} × ${r.b.padEnd(34)} (${(r.ca * 100).toFixed(0)}/${(r.cb * 100).toFixed(0)}%)`)
const vals = rows.map(r => r.both).sort((a, b) => a - b)
console.log(`\n  組数 ${rows.length}／中央値 ${(vals[Math.floor(vals.length / 2)] * 100).toFixed(1)}%／上位10%の境目 ${(vals[Math.floor(vals.length * 0.9)] * 100).toFixed(1)}%`)
