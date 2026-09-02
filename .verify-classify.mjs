import fs from 'node:fs'
const P = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/places.json'
const rows = JSON.parse(fs.readFileSync(P, 'utf8'))
const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('母数:', pub.length)

// --- 方式A：構造化カラム（サイトが実際に表示する計算と同じ） ---
function perDayRange(schedule) {
  if (!Array.isArray(schedule)) return null
  const t = schedule.filter(d => d && (typeof d.placeFee === 'number' || typeof d.companyFee === 'number'))
    .map(d => (typeof d.placeFee === 'number' ? d.placeFee : 0) + (typeof d.companyFee === 'number' ? d.companyFee : 0))
  return t.length ? { min: Math.min(...t), max: Math.max(...t) } : null
}
function classifyCols(p) {
  const range = perDayRange(p.schedule)
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  let fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  if (range) fixed = Math.max(fixed, range.max || 0)
  if (fixed > 0 && pct > 0) return '併用'
  if (fixed > 0) return '固定'
  if (pct > 0) return '歩合'
  return 'fee欄へ'   // 構造化データ無し → fee テキストに落ちる
}

// --- 方式B：fee テキストを読む ---
function classifyText(p) {
  const f = (p.fee || '').trim()
  if (!f) return '応相談'
  const hasPct = /[0-9]+\s*[%％]/.test(f)
  const hasYen = /[0-9][0-9,，]*\s*円/.test(f)
  if (hasPct && hasYen) return '併用'
  if (hasPct) return '歩合'
  if (hasYen) return '固定'
  return '応相談'
}

// 方式A：構造化が空のものは fee テキストで補う（サイトの feeText と同じ挙動）
function classifyHybrid(p) {
  const c = classifyCols(p)
  return c === 'fee欄へ' ? classifyText(p) : c
}

for (const [name, fn] of [['A 構造化カラム優先(サイト表示と同じ)', classifyHybrid], ['B feeテキストのみ', classifyText]]) {
  const tally = {}
  for (const p of pub) tally[fn(p)] = (tally[fn(p)] || 0) + 1
  console.log('\n===', name, '===')
  console.log(tally)
}

// おおみか店を固定扱いにしたらどうなるか（＝記事の数字と一致するか）
const tallyB = {}, tallyB2 = {}
for (const p of pub) {
  const c = classifyText(p); tallyB[c] = (tallyB[c] || 0) + 1
  const c2 = classifyHybrid(p); tallyB2[c2] = (tallyB2[c2] || 0) + 1
}
console.log('\n記事の主張: 固定51 / 歩合44 / 併用9 / 応相談6')

// 歩合の料率分布（歩合＋併用）
console.log('\n=== 料率分布 ===')
for (const [name, fn] of [['A 構造化', classifyHybrid], ['B テキスト', classifyText]]) {
  const dist = {}
  for (const p of pub) {
    const c = fn(p)
    if (c !== '歩合' && c !== '併用') continue
    let pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
    if (!pct) { const m = (p.fee || '').match(/([0-9]+)\s*[%％]/); pct = m ? +m[1] : 0 }
    dist[pct] = (dist[pct] || 0) + 1
  }
  console.log(name, dist)
}
console.log('記事の主張: 10%=36 / 15%=13 / 20%=4 (歩合含む53件)')

// おおみか店の schedule を確認
const oo = pub.find(p => (p.title || '').includes('おおみか'))
console.log('\nおおみか schedule:', JSON.stringify(oo.schedule))
console.log('おおみか 方式A分類:', classifyHybrid(oo), '/ 方式B分類:', classifyText(oo))
console.log('おおみか サイト表示される出店料テキスト → 売上の' + ((oo.price_share_pct||0)+(oo.company_share_pct||0)) + '%')

// price_fixed が null でなく 0 の案件はどれくらいあるか（＝料金フォームで保存された痕跡）
const zeroNotNull = pub.filter(p => p.price_fixed === 0)
console.log('\npublished で price_fixed === 0 (null でない) の件数:', zeroNotNull.length)
console.log(zeroNotNull.map(p => p.title + ' (share=' + ((p.price_share_pct||0)+(p.company_share_pct||0)) + '%)').join('\n'))
