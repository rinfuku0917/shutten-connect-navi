// blog-metrics.mjs と同じ関数を移植し、48 と 39 の集合関係を直接みる。読み取りのみ。
import fs from 'fs'
const live = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/live.json', 'utf8'))

const norm = s => String(s ?? '')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/,/g, '').replace(/％/g, '%').replace(/\s+/g, ' ')

const feeKindOf = p => {
  const t = norm(p.fee)
  const hasYen = /\d{3,6}\s*円/.test(t) || /\d+\s*万円/.test(t)
  const hasPct = /\d{1,2}\s*%/.test(t)
  const capOnly = /上限|最低保証/.test(t)
  if (hasYen && hasPct && !capOnly) return '併用'
  if (hasPct) return '歩合'
  if (hasYen) {
    const kakutei = /(?:平日|週末|土日|土日祝|休日|1日|一日)[^。]{0,12}?\d{3,6}\s*円/.test(t)
      || /\d{3,6}\s*円\s*\/\s*日/.test(t) || /^\s*\d{3,6}\s*円/.test(t)
    if (!kakutei && /相談|問い合わせ|問合せ|不明|未定|買取|予定/.test(t)) return '応相談'
    return '固定'
  }
  return '応相談'
}

const SIDE = /電源|電気|光熱|水道|駐車|広告|サイネージ|保証|買取/
const dayFees = p => {
  const t = norm(p.fee)
  const seg = (t.match(/キッチンカー(?:出店料)?[：: ]?([^物]*)/) ?? [null, t])[1]
  const same = seg.match(/平日\s*[/・、]\s*(?:週末|土日祝|土日)\s*(\d{3,6})\s*円/)
    ?? seg.match(/平日\s*[・･]\s*週末\s*[：:]\s*(\d{3,6})\s*円/)
  if (same) return { wd: +same[1], we: +same[1], kiji: true }
  const a = seg.match(/平日\s*(\d{3,6})\s*円/)
  const b = seg.match(/(?:土日祝|土日|週末|休日)\s*(\d{3,6})\s*円/)
  if (a && b) return { wd: +a[1], we: +b[1], kiji: true }
  const one = [...seg.matchAll(/(.{0,6}?)(\d{3,6})\s*円/g)]
    .filter(m => !SIDE.test(m[1])).map(m => +m[2]).filter(v => v >= 1000)
  if (one.length > 0) return { wd: one[0], we: one[0], kiji: false }
  return null
}
const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)] }

const fixedRegular = live.filter(p => feeKindOf(p) === '固定' && p.place_type === 'regular' && dayFees(p))
const both = live.filter(p => { const d = dayFees(p); return d && d.kiji })

console.log('常設かつ固定（48想定）:', fixedRegular.length)
console.log('平日と週末の両方に金額（39想定）:', both.length)

const fixedIds = new Set(fixedRegular.map(p => p.id))
const inside = both.filter(p => fixedIds.has(p.id))
const outside = both.filter(p => !fixedIds.has(p.id))
console.log(`\n39件のうち 48件に入るもの: ${inside.length} / 入らないもの: ${outside.length}`)
for (const p of outside) {
  const d = dayFees(p)
  console.log(`  外: ${p.title} [${p.place_type}] 判定=${feeKindOf(p)} 平日${d.wd}/週末${d.we} 差${d.we - d.wd}`)
  console.log(`      fee=${JSON.stringify(p.fee)}`)
}

// 39件の内訳を系列で分解
const grp = p => /Olympic|オリンピック|高井戸/.test(p.title) ? 'Olympic系'
  : /サンユー/.test(p.title) ? 'サンユーストアー'
  : feeKindOf(p) === '併用' ? '併用' : 'その他（商業施設の固定）'
const tally = {}
for (const p of both) tally[grp(p)] = (tally[grp(p)] ?? 0) + 1
console.log('\n39件の内訳:', tally)

// 差額分布
const diffs = both.map(p => { const d = dayFees(p); return d.we - d.wd })
const dist = {}
for (const d of diffs) dist[d] = (dist[d] ?? 0) + 1
console.log('差額の分布:', dist)
const pos = diffs.filter(d => d > 0)
console.log('平日が安い:', pos.length, '同額:', diffs.filter(d => d === 0).length, '平日が高い:', diffs.filter(d => d < 0).length)
console.log('差がある件の中央値:', median(pos))
console.log('併用2件を除いた場合 → 平日が安い:', pos.filter(d => d !== 5500).length, '中央値:', median(pos.filter(d => d !== 5500)))

// 48件側の分布（記事の「平日3,000円16件/5,000円19件」等の検算）
const wd = {}, we = {}
for (const p of fixedRegular) { const d = dayFees(p); wd[d.wd] = (wd[d.wd] ?? 0) + 1; we[d.we] = (we[d.we] ?? 0) + 1 }
console.log('\n48件の平日額分布:', wd)
console.log('48件の週末額分布:', we)
console.log('平日 中央値/最小/最大:', median(fixedRegular.map(p => dayFees(p).wd)),
  Math.min(...fixedRegular.map(p => dayFees(p).wd)), Math.max(...fixedRegular.map(p => dayFees(p).wd)))
console.log('週末 中央値/最小/最大:', median(fixedRegular.map(p => dayFees(p).we)),
  Math.min(...fixedRegular.map(p => dayFees(p).we)), Math.max(...fixedRegular.map(p => dayFees(p).we)))
console.log('48件のうち曜日別に金額が書かれているもの:', fixedRegular.filter(p => dayFees(p).kiji).length)
