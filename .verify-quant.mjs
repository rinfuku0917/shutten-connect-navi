import fs from 'fs'
const rows = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json', 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)
const norm = s => (s || '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/％/g, '%').replace(/，/g, ',')
const tally = (arr, f) => Object.entries(arr.reduce((m, x) => (m[f(x)] = (m[f(x)] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1])
const med = a => { const s = [...a].sort((x, y) => x - y); return s.length % 2 ? s[(s.length-1)/2] : (s[s.length/2-1]+s[s.length/2])/2 }

// キッチンカーの行だけを見る（Olympic系は物販/催事の行が混ざるので1行目だけ採用）
function kcLine(fee) {
  const lines = norm(fee).split('\n')
  const kc = lines.find(l => /キッチンカー出店料/.test(l))
  return kc || lines[0]
}
const amt = s => { const o = []; const re = /([0-9][0-9,]*)\s*円/g; let m; while ((m = re.exec(s))) o.push(Number(m[1].replace(/,/g, ''))); return o }

// 平日/週末の額を取り出す
const wd = [], we = []
for (const r of pub) {
  const f = kcLine(r.fee)
  if (!/円/.test(f)) continue
  const mWd = f.match(/平日\s*[:：]?\s*([0-9][0-9,]*)\s*円/)
  const mWe = f.match(/(?:週末|土日祝|土日|休日)\s*[:：]?\s*([0-9][0-9,]*)\s*円/)
  const mBoth = f.match(/平日\s*\/\s*(?:週末|土日祝)\s*[:：・]?\s*([0-9][0-9,]*)\s*円/) || f.match(/平日\s*・\s*週末\s*[:：]?\s*([0-9][0-9,]*)\s*円/)
  const flat = f.match(/(?:1日|一日|１日)\s*([0-9][0-9,]*)\s*円/)
  const N = x => Number(x.replace(/,/g, ''))
  if (mBoth) { wd.push({ v: N(mBoth[1]), t: r.title }); we.push({ v: N(mBoth[1]), t: r.title }); continue }
  if (mWd) wd.push({ v: N(mWd[1]), t: r.title })
  if (mWe) we.push({ v: N(mWe[1]), t: r.title })
  if (!mWd && !mWe && flat) { wd.push({ v: N(flat[1]), t: r.title }); we.push({ v: N(flat[1]), t: r.title }) }
}
for (const [name, arr, claim] of [['平日', wd, '59件 中央値5,000 最低2,000 最高8,000'], ['週末・祝日', we, '38件 中央値5,000 最低4,500 最高9,000']]) {
  const v = arr.map(x => x.v)
  console.log(`\n== ${name} ==  n=${v.length} 中央値=${med(v)} 最低=${Math.min(...v)} 最高=${Math.max(...v)}   （記事: ${claim}）`)
  console.log('  額の分布:', JSON.stringify(tally(arr, x => x.v)))
  console.log('  最低額の案件:', arr.filter(x => x.v === Math.min(...v)).map(x => x.t).join(' / '))
}

console.log('\n== 常設 / 単発イベント ==')
console.log('place_type:', JSON.stringify(tally(pub, r => r.place_type || '(null)')), '（記事: 常設97 / 単発13）')

console.log('\n== 税の明記 ==')
const tax = pub.filter(r => /税/.test(norm(r.fee)))
console.log('fee に「税」を含む:', tax.length, '（記事: 71件が税別・税込を明記）')

console.log('\n== 出店料が0/無料になりうる案件を総当たりで確認 ==')
for (const r of pub) {
  const f = norm(r.fee)
  const blob = [r.fee, r.description, r.details].filter(Boolean).join(' ')
  if (/無料|買取|最低保証|ギャラ|謝礼|出店料はいただ|出店料なし|出店料無/.test(blob)) {
    console.log(`  fee=${JSON.stringify(f.slice(0,70))} | ${r.title}`)
  }
}
console.log('\n※ 上のうち「出店者が1円も払わない」ものだけが FAQ の言う無料案件')
