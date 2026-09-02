import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync(new URL('./.verify-kensho-dump.json', import.meta.url), 'utf8'))

const norm = s => (s || '').replace(/\r?\n/g, ' ').replace(/，/g, ',').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
const yen = s => parseInt(s.replace(/,/g, ''), 10)

// 「キッチンカー出店料」行があればその行だけを見る（Olympicの物販/催事行を混ぜない）
function feeLine(p) {
  const lines = (p.fee || '').split(/\r?\n/)
  const kc = lines.find(l => /キッチンカー出店料/.test(l))
  return norm(kc || p.fee)
}

const WD_AMT = /平日\s*[：:]?\s*([\d,]+)\s*円/
const WE_AMT = /(?:週末|土日祝|土日|休日)\s*[：:]?\s*([\d,]+)\s*円/
const BOTH_EQ = /平日\s*[\/・／]\s*週末|平日\s*[・]\s*週末\s*[：:]/

const rows = []
for (const p of pub) {
  const f = feeLine(p)
  const mentionsWD = /平日/.test(f), mentionsWE = /週末|土日|休日|土曜|日曜|祝/.test(f)
  if (!mentionsWD || !mentionsWE) continue
  const wd = f.match(WD_AMT), we = f.match(WE_AMT)
  let a = null, b = null, form = ''
  if (wd && we) { a = yen(wd[1]); b = yen(we[1]); form = '個別記載' }
  else if (BOTH_EQ.test(f)) {
    const m = f.match(/([\d,]+)\s*円/)
    if (m) { a = b = yen(m[1]); form = '平日/週末まとめて1額' }
  }
  rows.push({ title: p.title, pref: p.prefecture, fee: f, a, b, form })
}

const withAmt = rows.filter(r => r.a != null)
const noAmt = rows.filter(r => r.a == null)
const cheaper = withAmt.filter(r => r.a < r.b)
const equal = withAmt.filter(r => r.a === r.b)
const dearer = withAmt.filter(r => r.a > r.b)

console.log('平日・週末の両方に言及する案件 :', rows.length)
console.log('  うち両方の金額あり        :', withAmt.length)
console.log('    平日のほうが安い        :', cheaper.length)
console.log('    同額                    :', equal.length)
console.log('    平日のほうが高い        :', dearer.length)
console.log('  金額の記載なし            :', noAmt.length, noAmt.map(r => r.title))

const diffs = cheaper.map(r => r.b - r.a).sort((x, y) => x - y)
const dist = diffs.reduce((m, d) => (m[d] = (m[d] || 0) + 1, m), {})
console.log('\n差がある案件の差額分布:', dist)
console.log('差額の中央値(差がある25件のみ):', diffs[(diffs.length - 1) / 2])
const allD = [...diffs, ...equal.map(() => 0)].sort((x, y) => x - y)
console.log('差額の中央値(同額も含む39件):', allD.length % 2 ? allD[(allD.length - 1) / 2] : (allD[allD.length / 2 - 1] + allD[allD.length / 2]) / 2)

console.log('\n--- 同額の案件 ---')
equal.forEach(r => console.log(`  ${r.pref} | ${r.title} | 「${r.fee}」 (${r.form})`))

// 出店料ガイドの「常設48件」表を再現できるか：フラット定額は平日=週末として数える
console.log('\n=== 常設の固定額 平日/週末の出現金額（フラット定額は両方に計上）===')
const wdC = {}, weC = {}
let n48 = 0
for (const p of pub) {
  if (p.place_type !== 'regular') continue
  const f = feeLine(p)
  const wd = f.match(WD_AMT), we = f.match(WE_AMT)
  let a = null, b = null
  if (wd && we) { a = yen(wd[1]); b = yen(we[1]) }
  else if (BOTH_EQ.test(f)) { const m = f.match(/([\d,]+)\s*円/); if (m) a = b = yen(m[1]) }
  else {
    const flat = f.match(/(?:^|[^%\d])1?\s*日\s*[：:]?\s*([\d,]+)\s*円/) || f.match(/^\s*([\d,]+)\s*円\s*\/\s*日/)
    if (flat && !/%|％/.test(f.split('(')[0])) { a = b = yen(flat[1]) }
  }
  if (a != null) { n48++; wdC[a] = (wdC[a] || 0) + 1; weC[b] = (weC[b] || 0) + 1 }
}
console.log('固定額を取り出せた常設件数:', n48)
console.log('平日:', Object.entries(wdC).sort((x, y) => x[0] - y[0]))
console.log('週末:', Object.entries(weC).sort((x, y) => x[0] - y[0]))
