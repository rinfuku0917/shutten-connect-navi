// 記事どうしの本文の重なりを機械的に測る（読み取りのみ）
import fs from 'fs'
const SC = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad'
const posts = JSON.parse(fs.readFileSync(`${SC}/posts.json`, 'utf8'))

// 8本は原稿ファイルを正とする
const MS = ['food-truck-fee-guide', 'kitchen-car-location-guide', 'renting-parking-space',
  'kitchen-car-required-documents', 'get-food-truck-offers', 'weekday-food-truck-spots',
  'supermarket-food-truck', 'mall-food-truck-event']

const MERGED = new Set(['how-to-find-food-truck-spots', 'auto-mtarczbg-37pazo', 'auto-mtgh64lh-jwwkxe',
  'auto-mta8z1w9-vazfy1', 'choose-profitable-food-truck-location', 'host-fee-setting-guide2',
  'event-food-truck-guide'])

const docs = {}   // slug -> {slug, title, raw, src}
for (const s of MS) {
  const raw = fs.readFileSync(`docs/blog/${s}.md`, 'utf8')
  const fm = raw.match(/^---\n([\s\S]*?)\n---\n/)
  const title = (fm?.[1].match(/^title:\s*(.+)$/m) ?? [, s])[1]
  docs[s] = { slug: s, title, raw: raw.replace(/^---\n[\s\S]*?\n---\n/, ''), src: '原稿' }
}
for (const p of posts) {
  if (docs[p.slug]) continue
  docs[p.slug] = { slug: p.slug, title: p.title, raw: String(p.content ?? ''), src: 'DB' }
}

// --- 正規化 ---
const strip = t => t
  .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')          // 画像
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')        // リンクはテキストだけ残す
  .replace(/<[^>]+>/g, ' ')
  .replace(/[#*>`|:\-—–…「」『』（）()【】\[\]"'\/]/g, ' ')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/[，、]/g, '、')
  .replace(/％/g, '%')
  .replace(/\s+/g, '')

const norm = d => strip(d.raw)

// 文単位に割る（。！？と改行・表の行で切る）
const sentences = d => d.raw
  .replace(/!\[[^\]]*\]\([^)]*\)/g, '\n')
  .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .split(/\n+/)
  .flatMap(line => line.split(/(?<=[。！？])/))
  .map(s => strip(s))
  .filter(s => s.length >= 12)

// 文字 n-gram
const shingles = (s, n = 6) => {
  const set = new Set()
  for (let i = 0; i + n <= s.length; i++) set.add(s.slice(i, i + n))
  return set
}
const jac = (a, b) => {
  let inter = 0
  for (const x of a) if (b.has(x)) inter++
  return { jaccard: inter / (a.size + b.size - inter), contA: inter / a.size, contB: inter / b.size, inter }
}

// 文どうしの近さ（3-gramのDice）
const dice = (a, b) => {
  const A = shingles(a, 3), B = shingles(b, 3)
  let i = 0; for (const x of A) if (B.has(x)) i++
  return (2 * i) / (A.size + B.size)
}

// 「重複文でどれだけ埋まっているか」= 相手にほぼ同じ文がある文の文字数 / 全文字数
function dupCover(dA, dB, th = 0.6) {
  const SA = sentences(dA), SB = sentences(dB)
  const total = SA.reduce((s, x) => s + x.length, 0)
  let cov = 0; const pairs = []
  for (const a of SA) {
    let best = 0, bm = ''
    for (const b of SB) { const d = dice(a, b); if (d > best) { best = d; bm = b } }
    if (best >= th) { cov += a.length; pairs.push({ a, b: bm, d: +best.toFixed(2) }) }
  }
  return { pct: total ? cov / total : 0, pairs, total }
}

const all = Object.values(docs)
const shin = Object.fromEntries(all.map(d => [d.slug, shingles(norm(d), 6)]))
const lens = Object.fromEntries(all.map(d => [d.slug, norm(d).length]))

// ---- 1. 指定された組 ----
const PAIRS = [
  ['kitchen-car-location-guide', 'weekday-food-truck-spots'],
  ['supermarket-food-truck', 'mall-food-truck-event'],
  ['supermarket-food-truck', 'renting-parking-space'],
  ['mall-food-truck-event', 'renting-parking-space'],
]
console.log('=== 指定4組の重なり ===')
for (const [x, y] of PAIRS) {
  const j = jac(shin[x], shin[y])
  const cx = dupCover(docs[x], docs[y]), cy = dupCover(docs[y], docs[x])
  console.log(`\n${x} × ${y}`)
  console.log(`  6-gram Jaccard = ${(j.jaccard * 100).toFixed(1)}%   包含率 ${x}→${(j.contA * 100).toFixed(1)}%  ${y}→${(j.contB * 100).toFixed(1)}%`)
  console.log(`  重複文カバー率  ${x}の${(cx.pct * 100).toFixed(1)}% / ${y}の${(cy.pct * 100).toFixed(1)}%（Dice>=0.6の文）`)
  const top = [...cx.pairs].sort((p, q) => q.d - p.d).slice(0, 6)
  for (const p of top) console.log(`    [${p.d}] ${p.a.slice(0, 46)}\n         ↔ ${p.b.slice(0, 46)}`)
}

// ---- 2. 全ペア（8本 + 既存、統合済みは除く） ----
console.log('\n\n=== 全ペア 6-gram Jaccard（統合済み5本を除く） ===')
const live = all.filter(d => !MERGED.has(d.slug))
const rows = []
for (let i = 0; i < live.length; i++) for (let k = i + 1; k < live.length; k++) {
  const a = live[i], b = live[k]
  const j = jac(shin[a.slug], shin[b.slug])
  rows.push({ a: a.slug, b: b.slug, j: j.jaccard, ca: j.contA, cb: j.contB })
}
rows.sort((p, q) => q.j - p.j)
for (const r of rows.slice(0, 25)) {
  console.log(`  ${(r.j * 100).toFixed(1).padStart(5)}%  ${r.a.padEnd(38)} × ${r.b.padEnd(38)} 包含 ${(r.ca * 100).toFixed(0)}/${(r.cb * 100).toFixed(0)}%`)
}

// ---- 3. 統合済みも含めた全ペア（参考：統合済みが公開に戻っている影響） ----
console.log('\n=== 統合済み5本を含めた場合の上位 ===')
const rows2 = []
for (let i = 0; i < all.length; i++) for (let k = i + 1; k < all.length; k++) {
  const a = all[i], b = all[k]
  const j = jac(shin[a.slug], shin[b.slug])
  rows2.push({ a: a.slug, b: b.slug, j: j.jaccard })
}
rows2.sort((p, q) => q.j - p.j)
for (const r of rows2.slice(0, 12)) {
  const m = (MERGED.has(r.a) ? '*' : ' ') + (MERGED.has(r.b) ? '*' : ' ')
  console.log(`  ${(r.j * 100).toFixed(1).padStart(5)}% ${m} ${r.a.padEnd(38)} × ${r.b}`)
}

console.log('\n（文字数・正規化後）')
for (const d of all) console.log(`  ${d.slug.padEnd(40)} ${String(lens[d.slug]).padStart(5)}字 (${d.src})`)
