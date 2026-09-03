// 前回の検証と同じ「12文字一致」の物差しを再現し、同じ物差しで全ペアを測る
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

const strip = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, ' ').replace(/[#*>`|:\-—–…「」『』（）()【】\[\]"'\/]/g, ' ')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/[，、]/g, '、').replace(/％/g, '%').replace(/\s+/g, '')
const N = Object.fromEntries(Object.entries(docs).map(([k, v]) => [k, strip(v)]))
const sh = (s, n) => { const S = new Set(); for (let i = 0; i + n <= s.length; i++) S.add(s.slice(i, i + n)); return S }
const S12 = Object.fromEntries(Object.entries(N).map(([k, v]) => [k, sh(v, 12)]))

function m12(a, b) {
  const A = S12[a], B = S12[b]
  let i = 0; for (const x of A) if (B.has(x)) i++
  return {
    jac: i / (A.size + B.size - i),
    dice: 2 * i / (A.size + B.size),
    contA: i / A.size, contB: i / B.size,
    max: Math.max(i / A.size, i / B.size),
    avg: (i / A.size + i / B.size) / 2,
  }
}
const pr = (label, a, b) => {
  const m = m12(a, b)
  console.log(`  ${label.padEnd(52)} Jaccard ${(m.jac * 100).toFixed(1).padStart(5)}%  Dice ${(m.dice * 100).toFixed(1).padStart(5)}%  包含 ${(m.contA * 100).toFixed(1)}/${(m.contB * 100).toFixed(1)}%  平均 ${(m.avg * 100).toFixed(1)}%  最大 ${(m.max * 100).toFixed(1)}%`)
}
console.log('=== 12文字一致：前回の 10.5% → 7.1% がどの数え方かを探す ===')
pr('統合前 探し方 × 統合前 平日', 'location@統合前', 'weekday@統合前')
pr('いま   探し方 × いま   平日', 'kitchen-car-location-guide', 'weekday-food-truck-spots')
console.log()
pr('スーパー × 商業施設', 'supermarket-food-truck', 'mall-food-truck-event')
pr('スーパー × 駐車場', 'supermarket-food-truck', 'renting-parking-space')
pr('商業施設 × 駐車場', 'mall-food-truck-event', 'renting-parking-space')
console.log()
console.log('  参考（無関係な組の水準）')
pr('必要書類 × 出店依頼', 'kitchen-car-required-documents', 'get-food-truck-offers')
pr('必要書類 × 駐車場', 'kitchen-car-required-documents', 'renting-parking-space')
pr('出店料 × 出店依頼', 'food-truck-fee-guide', 'get-food-truck-offers')

// 全ペア（統合済み除く・8本＋既存）
const live = Object.keys(docs).filter(k => !k.includes('@') && !MERGED.has(k))
const rows = []
for (let i = 0; i < live.length; i++) for (let k = i + 1; k < live.length; k++) {
  const m = m12(live[i], live[k]); rows.push({ a: live[i], b: live[k], ...m })
}
rows.sort((p, q) => q.dice - p.dice)
console.log('\n=== 12文字一致 Dice 上位20（統合済み5本を除く全ペア） ===')
for (const r of rows.slice(0, 20)) {
  console.log(`  ${(r.dice * 100).toFixed(1).padStart(5)}%  ${r.a.padEnd(34)} × ${r.b.padEnd(34)} 包含 ${(r.contA * 100).toFixed(0)}/${(r.contB * 100).toFixed(0)}%`)
}
const med = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
console.log(`\n  全${rows.length}ペアの Dice 中央値 = ${(med(rows.map(r => r.dice)) * 100).toFixed(1)}%（これが「無関係な水準」）`)
