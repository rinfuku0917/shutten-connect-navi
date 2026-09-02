import fs from 'node:fs'
const rows = JSON.parse(fs.readFileSync(new URL('./.verify-donki-dump.json', import.meta.url), 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)
const regular = pub.filter(r => r.place_type === 'regular')

// fee 本文から「平日◯円／週末◯円」を拾う（記事の集計は構造化項目ではなく本文由来のはず）
const num = s => Number(String(s).replace(/,/g, ''))
function parse(txt) {
  const t = String(txt || '')
  const wd = [], we = []
  const wdRe = /平日[^0-9%％]{0,12}?([0-9][0-9,]*)\s*円/g
  const weRe = /(?:週末|土日祝|土日|土・日|休日|祝日)[^0-9%％]{0,12}?([0-9][0-9,]*)\s*円/g
  let m
  while ((m = wdRe.exec(t))) wd.push(num(m[1]))
  while ((m = weRe.exec(t))) we.push(num(m[1]))
  return { wd, we }
}
let n = 0
const wdAll = [], weAll = []
const detail = []
for (const r of regular) {
  const p = parse(r.fee)
  if (!p.wd.length && !p.we.length) continue
  n++
  const wd = p.wd.length ? Math.min(...p.wd) : null
  const we = p.we.length ? Math.min(...p.we) : null
  if (wd != null) wdAll.push(wd)
  if (we != null) weAll.push(we)
  detail.push({ t: r.title, wd, we })
}
const med = a => { const s = [...a].sort((x, y) => x - y); const k = s.length; return k % 2 ? s[(k - 1) / 2] : (s[k / 2 - 1] + s[k / 2]) / 2 }
console.log('本文に平日/週末の金額がある常設案件:', n, '件')
console.log('平日 中央値', med(wdAll), '最低', Math.min(...wdAll), '最高', Math.max(...wdAll), '件数', wdAll.length)
console.log('週末 中央値', med(weAll), '最低', Math.min(...weAll), '最高', Math.max(...weAll), '件数', weAll.length)
console.log('\n週末が高い順:')
detail.sort((a, b) => (b.we ?? 0) - (a.we ?? 0)).slice(0, 12).forEach(x => console.log('  週末', x.we, '平日', x.wd, x.t))
console.log('\n週末の値の分布:', JSON.stringify(Object.entries(weAll.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {})).sort((a, b) => a[0] - b[0])))
console.log('平日の値の分布:', JSON.stringify(Object.entries(wdAll.reduce((m, v) => (m[v] = (m[v] || 0) + 1, m), {})).sort((a, b) => a[0] - b[0])))

// 高井戸を8,000に置き換えたら中央値・最高はどうなるか
const weSwap = weAll.map(v => v === 7500 ? 8000 : v)
console.log('\n高井戸の週末を8,000に置き換えた場合: 中央値', med(weSwap), '最低', Math.min(...weSwap), '最高', Math.max(...weSwap))
