// スーパー × 商業施設 の重なりを、章ごと・文ごとに洗い出す
import fs from 'fs'
const read = s => fs.readFileSync(`docs/blog/${s}.md`, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '')
const A = read('supermarket-food-truck'), B = read('mall-food-truck-event')

const strip = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/<[^>]+>/g, ' ').replace(/[#*>`|:\-—–…「」『』（）()【】\[\]"'\/]/g, ' ')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/[，、]/g, '、').replace(/％/g, '%').replace(/\s+/g, '')

const shing = (s, n) => { const S = new Set(); for (let i = 0; i + n <= s.length; i++) S.add(s.slice(i, i + n)); return S }
const dice = (a, b) => { const X = shing(a, 3), Y = shing(b, 3); let i = 0; for (const x of X) if (Y.has(x)) i++; return (2 * i) / (X.size + Y.size) }

// 章に割る
function chapters(md) {
  const out = []; let cur = { h: '(前書き)', body: '' }
  for (const line of md.split('\n')) {
    const m = line.match(/^(#{2,3})\s+(.*)$/)
    if (m) { out.push(cur); cur = { h: `${'  '.repeat(m[1].length - 2)}${m[2]}`, body: '' } }
    else cur.body += line + '\n'
  }
  out.push(cur); return out.filter(c => strip(c.body).length > 0)
}
const CA = chapters(A), CB = chapters(B)
console.log('=== 章の対応（Dice 本文どうし） ===')
console.log('\n[supermarket-food-truck の章]  → 商業施設側でいちばん近い章')
for (const a of CA) {
  let best = 0, bh = ''
  for (const b of CB) { const d = dice(strip(a.body), strip(b.body)); if (d > best) { best = d; bh = b.h } }
  const mark = best >= 0.5 ? '★重複' : best >= 0.3 ? '△似' : '  '
  console.log(`  ${mark} ${(best).toFixed(2)}  ${a.h.padEnd(34)} ${strip(a.body).length}字  → ${bh}`)
}
console.log('\n[mall-food-truck-event の章]  → スーパー側でいちばん近い章')
for (const b of CB) {
  let best = 0, bh = ''
  for (const a of CA) { const d = dice(strip(b.body), strip(a.body)); if (d > best) { best = d; bh = a.h } }
  const mark = best >= 0.5 ? '★重複' : best >= 0.3 ? '△似' : '  '
  console.log(`  ${mark} ${(best).toFixed(2)}  ${b.h.padEnd(34)} ${strip(b.body).length}字  → ${bh}`)
}

// 文レベルで一致度0.6以上を全部出す
const sents = md => md.replace(/!\[[^\]]*\]\([^)]*\)/g, '\n').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .split(/\n+/).flatMap(l => l.split(/(?<=[。！？])/)).map(strip).filter(s => s.length >= 12)
const SA = sents(A), SB = sents(B)
console.log('\n\n=== ほぼ同じ文（Dice>=0.6）の全件 ===')
let cov = 0, tot = SA.reduce((s, x) => s + x.length, 0)
const seen = []
for (const a of SA) {
  let best = 0, bm = ''
  for (const b of SB) { const d = dice(a, b); if (d > best) { best = d; bm = b } }
  if (best >= 0.6) { cov += a.length; seen.push([best, a, bm]) }
}
for (const [d, a, b] of seen.sort((x, y) => y[0] - x[0])) {
  console.log(` ${d.toFixed(2)} S: ${a}`)
  console.log(`      M: ${b}`)
}
console.log(`\nスーパー記事の ${(cov / tot * 100).toFixed(1)}%（${cov}/${tot}字）が、商業施設記事にほぼ同じ文として存在`)

// 数字の一致（同じ統計を両方が引いているか）
console.log('\n=== 両方に出てくる数値表現 ===')
const nums = t => new Set((strip(t).match(/\d[\d,\.]*(?:件|円|%|店|台|割|か月|年|日)/g) ?? []))
const na = nums(A), nb = nums(B)
const both = [...na].filter(x => nb.has(x))
console.log('  共通:', both.join(' / '))
console.log('  スーパーのみ:', [...na].filter(x => !nb.has(x)).join(' / '))
console.log('  商業施設のみ:', [...nb].filter(x => !na.has(x)).join(' / '))
