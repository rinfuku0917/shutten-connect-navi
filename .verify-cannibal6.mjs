// 重なっている「かたまり」を実際に取り出す
import fs from 'fs'
const SC = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad'
const body = raw => raw.replace(/^---\n[\s\S]*?\n---\n/, '')
const load = s => body(fs.readFileSync(`docs/blog/${s}.md`, 'utf8'))
const hard = t => t.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  .replace(/[#*>`|:\-—–…「」『』（）()【】\[\]"'\/]/g, '').replace(/\s+/g, '')

function segments(a, b, n = 12, min = 14) {
  const B = new Set(); for (let i = 0; i + n <= b.length; i++) B.add(b.slice(i, i + n))
  const hit = new Array(a.length).fill(false)
  for (let i = 0; i + n <= a.length; i++) if (B.has(a.slice(i, i + n))) for (let k = i; k < i + n; k++) hit[k] = true
  const out = []; let s = -1
  for (let i = 0; i <= a.length; i++) {
    if (hit[i] && s < 0) s = i
    else if (!hit[i] && s >= 0) { if (i - s >= min) out.push([i - s, a.slice(s, i)]); s = -1 }
  }
  return out.sort((x, y) => y[0] - x[0])
}
const P = [
  ['kitchen-car-location-guide', 'weekday-food-truck-spots'],
  ['supermarket-food-truck', 'mall-food-truck-event'],
]
for (const [x, y] of P) {
  const A = hard(load(x)), B = hard(load(y))
  const segs = segments(A, B)
  const covered = segs.reduce((s, [n]) => s + n, 0)
  console.log(`\n=== ${x} に含まれる、${y} と一致する箇所（14字以上） ===`)
  console.log(`  ${segs.length}か所 / ${covered}字（本文${A.length}字の${(covered / A.length * 100).toFixed(1)}%が14字以上の連続一致）`)
  for (const [n, t] of segs) console.log(`  [${String(n).padStart(3)}] ${t}`)
}
