import fs from 'node:fs'
const SP = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/live.json'
const r = JSON.parse(fs.readFileSync(SP, 'utf8'))

// ---- 私の分類（fee本文を読んで手で決めたもの。番号は先の一覧の通し番号）----
const FIX = [1,2,3,5,8,13,18,19,23,30,31,32,34,35,36,38,42,44,46,48,49,51,53,54,55,57,59,60,61,62,63,65,66,67,68,76,78,82,83,85,87,92,94,95,98,99,100,102,103,107,108]
const SHR = [4,6,7,9,10,11,12,14,15,16,17,20,21,22,24,25,26,27,28,29,37,39,40,41,43,45,50,52,71,74,77,81,84,86,90,91,96,97,101,104,105,106,109,110]
const BOTH = [33,56,64,69,70,72,75,80,88]
const ASK = [47,58,73,79,89,93]
console.log('固定', FIX.length, '歩合', SHR.length, '併用', BOTH.length, '応相談', ASK.length,
  '計', FIX.length + SHR.length + BOTH.length + ASK.length)
const allIdx = [...FIX, ...SHR, ...BOTH, ...ASK].sort((a, b) => a - b)
console.log('重複/漏れ:', allIdx.length !== new Set(allIdx).size ? 'あり' : 'なし',
  '欠番:', [...Array(110).keys()].map(i => i + 1).filter(i => !allIdx.includes(i)))

const isEvent = (i) => r[i - 1].place_type === 'event'
const cross = (arr) => ({ 常設: arr.filter(i => !isEvent(i)).length, 単発: arr.filter(isEvent).length })
console.log('固定', cross(FIX), '歩合', cross(SHR), '併用', cross(BOTH), '応相談', cross(ASK))

// ---- 料率 ----
const RATE = { 4:10,6:20,7:10,9:10,10:10,11:10,12:10,14:10,15:10,16:10,17:10,20:15,21:20,22:15,24:15,25:10,
  26:15,27:10,28:10,29:15,37:10,39:10,40:10,41:10,43:10,45:10,50:10,52:15,71:10,74:10,77:10,81:10,84:10,
  86:10,90:10,91:10,96:10,97:15,101:10,104:10,105:15,106:15,109:10,110:10,
  33:15,56:15,64:10,69:15,70:10,72:20,75:20,80:10,88:15 }
const rc = {}
for (const k of [...SHR, ...BOTH]) rc[RATE[k]] = (rc[RATE[k]] || 0) + 1
console.log('歩合を含む', SHR.length + BOTH.length, '件の料率:', rc)

// ---- 常設かつ固定の48件の平日/週末 ----
const AMT = { // [平日, 週末]
  1:[5000,5000],2:[5000,5000],3:[7500,7500],5:[5000,5000],8:[7000,8000],18:[7000,9000],
  19:[3000,4500],30:[3000,4500],31:[5000,5000],32:[3000,4500],34:[5500,7500],35:[3000,4500],
  36:[3000,4500],38:[3000,4500],42:[3000,4500],44:[3000,4500],46:[3000,4500],48:[3000,4500],
  49:[3000,4500],51:[3000,4500],53:[7500,7500],54:[5000,7500],55:[3000,4500],57:[5000,7000],
  59:[7500,7500],60:[5000,5000],61:[7500,7500],62:[7500,7500],63:[7500,7500],65:[3000,4500],
  66:[5000,5000],67:[3000,4500],68:[3000,4500],78:[5000,5000],82:[8000,8000],83:[4500,6500],
  85:[7500,7500],87:[5000,7500],92:[5000,5000],94:[5000,5000],95:[5000,5000],98:[5000,5000],
  99:[5000,5000],100:[7500,7500],102:[5000,5000],103:[5000,5000],107:[5000,5000],108:[5000,5000] }
const keys = Object.keys(AMT).map(Number)
console.log('常設×固定の件数:', keys.length, '/ 固定のうち常設:', FIX.filter(i => !isEvent(i)).length)
const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
for (const [name, idx] of [['平日', 0], ['週末', 1]]) {
  const v = keys.map(k => AMT[k][idx])
  const tally = {}; v.forEach(x => tally[x] = (tally[x] || 0) + 1)
  console.log(name, '中央値', med(v), '最低', Math.min(...v), '最高', Math.max(...v), tally)
}

// ---- 税の明記 ----
const taxRe = /税別|税込|税抜|＋税|\+税|（税）|\(税\)|税\)/
const taxed = r.filter(x => x.fee && taxRe.test(x.fee))
console.log('税を明記している件数:', taxed.length, '/', r.length)
console.log('明記なしの fee:', r.filter(x => !(x.fee && taxRe.test(x.fee))).map(x => x.fee))

// ---- 出店料が金額として書かれていない案件 ----
console.log('\n応相談・不明の fee:', ASK.map(i => `${i}:${r[i-1].title} => ${r[i-1].fee}`))

// ---- open_days / schedule の充足 ----
console.log('\nopen_days あり:', r.filter(x => x.open_days).length, '/ schedule あり:', r.filter(x => x.schedule).length,
  '/ genres あり:', r.filter(x => x.genres && x.genres.length).length)

// ---- day_type_fees と fee本文の整合 ----
for (const x of r) {
  if (!x.day_type_fees) continue
  const d = x.day_type_fees
  const wd = (d.weekday?.placeFee || 0) + (d.weekday?.companyFee || 0)
  const we = (d.weekend?.placeFee || 0) + (d.weekend?.companyFee || 0)
  const m = x.fee.match(/平日([\d,]+)円（税別）、週末([\d,]+)円/)
  const t = m ? [Number(m[1].replace(/,/g, '')), Number(m[2].replace(/,/g, ''))] : null
  if (t && (t[0] !== wd || t[1] !== we)) console.log('不一致:', x.title, '本文', t, 'day_type_fees合計', [wd, we],
    '（うち場所側', [d.weekday?.placeFee, d.weekend?.placeFee], '運営側', [d.weekday?.companyFee, d.weekend?.companyFee], '）')
}
console.log('day_type_fees を持つ件数:', r.filter(x => x.day_type_fees).length)
