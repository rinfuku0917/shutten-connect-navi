import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=')).map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(cols)}`,
      { headers: { apikey: KEY, Authorization: 'Bearer ' + KEY, Range: `${from}-${from + 999}` } })
    if (!r.ok) { console.log('ERR', r.status, await r.text()); break }
    const j = await r.json(); out.push(...j); if (j.length < 1000) break
  }
  return out
}
const cols = 'id,title,status,closed,fee,day_type_fees,schedule,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,prefecture,place_type,address'
const rows = await all('places', cols)
const pub = rows.filter(r => r.status === 'published' && !r.closed)
const yens = t => [...String(t || '').matchAll(/([0-9][0-9,]*)\s*円/g)].map(m => parseInt(m[1].replace(/,/g, ''), 10))

// 茨城のチェーンB（記事の3行目 5,000/5,000 ×14件）を探す
console.log('=== 茨城の公開案件 ===')
const ibk = pub.filter(r => r.prefecture === '茨城県')
console.log('件数:', ibk.length)
const bkey = new Map()
for (const r of ibk) {
  const k = `固定${(r.price_fixed || 0) + (r.company_fixed_amount || 0)} unit=${r.place_fixed_unit} dtf=${r.day_type_fees ? JSON.stringify(r.day_type_fees) : '-'} fee[${[...new Set(yens(r.fee))].join(',')}]`
  if (!bkey.has(k)) bkey.set(k, [])
  bkey.get(k).push(r.title)
}
for (const [k, v] of [...bkey.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`  ${v.length}件 | ${k}`)
  console.log(`        例: ${v.slice(0, 3).join(' / ')}`)
}

// 公開案件全体で「fee本文の金額」と「構造化された固定額の合計」が食い違う件を洗う
console.log('\n=== 公開案件：構造化固定額 vs fee本文 の食い違い ===')
let mismatch = 0, checked = 0
for (const r of pub) {
  const fixed = (r.price_fixed || 0) + (r.company_fixed_amount || 0)
  const ys = new Set(yens(r.fee))
  if (fixed <= 0 || ys.size === 0) continue
  checked++
  if (!ys.has(fixed)) { mismatch++; console.log(`  ★ 固定${fixed} が fee本文[${[...ys].join(',')}] に無い | ${r.title}`) }
}
console.log(`固定額と本文の両方がある案件 ${checked} 件中、食い違い ${mismatch} 件`)

// 高井戸店が公開ページでどう出るか（feeText の再現）
const h = pub.find(r => /高井戸/.test(r.title || ''))
console.log('\n=== 高井戸店：公開ページの「出店料」欄の再現 ===')
console.log('schedule:', h.schedule, '/ price_fixed:', h.price_fixed, '/ company_fixed_amount:', h.company_fixed_amount,
  '/ share:', h.price_share_pct, h.company_share_pct)
const pct = (h.price_share_pct || 0) + (h.company_share_pct || 0)
const fixed = (h.price_fixed || 0) + (h.company_fixed_amount || 0)
console.log('→ perDayFeeRange(schedule)=null, fixed=' + fixed + ', pct=' + pct + ' なので feeText は fee本文をそのまま返す')
console.log('→ 画面表示:', JSON.stringify(h.fee))
