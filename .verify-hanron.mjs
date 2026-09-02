import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1000行打ち切り対策：必ず range でページングする
async function all(cols) {
  const out = []
  let from = 0
  const step = 500
  for (;;) {
    const { data, error } = await sb.from('places').select(cols).order('id').range(from, from + step - 1)
    if (error) throw error
    out.push(...data)
    if (data.length < step) break
    from += step
  }
  return out
}

const rows = await all('id,title,status,closed,fee,day_type_fees,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,schedule,prefecture,place_type,host_id')
console.log('places 全行:', rows.length)

const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('公開中(published かつ closed でない):', pub.length)

const sup = pub.filter(r => String(r.place_type || '').includes('スーパー') || String(r.place_type || '').includes('食品'))
console.log('スーパー・食品店:', sup.length)
console.log('place_type の値:', [...new Set(pub.map(r => r.place_type))].join(' / '))

const money = x => (typeof x === 'number' ? x : null)
const side = (d, k) => (d && typeof d === 'object' && d[k]) ? d[k] : null

console.log('\n===== スーパー35件の生データ =====')
for (const r of sup) {
  const d = r.day_type_fees
  const wd = side(d, 'weekday'), we = side(d, 'weekend')
  console.log([
    r.title,
    '| price_fixed=' + r.price_fixed,
    'company_fixed=' + r.company_fixed_amount,
    'unit=' + r.place_fixed_unit + '/' + r.company_fixed_unit,
    'share=' + r.price_share_pct + '%/' + r.company_share_pct + '%',
    'dtf=' + JSON.stringify(d),
    'fee=' + JSON.stringify(r.fee),
    'host=' + String(r.host_id || '').slice(0, 8)
  ].join(' '))
}

// day_type_fees を持つ案件だけ、placeFee / companyFee の分解を集計
console.log('\n===== day_type_fees を持つスーパー案件の分解 =====')
const dtfRows = sup.filter(r => {
  const d = r.day_type_fees
  return d && typeof d === 'object' && ['weekday','weekend'].some(k => side(d,k) && (typeof side(d,k).placeFee === 'number' || typeof side(d,k).companyFee === 'number'))
})
console.log('day_type_fees あり:', dtfRows.length, '件')
const byPattern = new Map()
for (const r of dtfRows) {
  const key = JSON.stringify(r.day_type_fees)
  if (!byPattern.has(key)) byPattern.set(key, [])
  byPattern.get(key).push(r.title)
}
for (const [k, titles] of byPattern) {
  const d = JSON.parse(k)
  const t = s => s ? ((money(s.placeFee) || 0) + (money(s.companyFee) || 0)) : null
  console.log(`\n  パターン: ${k}`)
  console.log(`  合計 平日=${t(d.weekday)} 週末=${t(d.weekend)}  / 場所の取り分 平日=${d.weekday?.placeFee} 週末=${d.weekend?.placeFee}`)
  console.log(`  ${titles.length}件: ${titles.slice(0,20).join(', ')}`)
}

// 公開ページ(feeText)が出す金額 = price_fixed + company_fixed_amount
console.log('\n===== 公開ページの表示額(price_fixed+company_fixed_amount)の分布 =====')
const dist = new Map()
for (const r of sup) {
  const fixed = (r.price_fixed || 0) + (r.company_fixed_amount || 0)
  const key = `${fixed}円 (place=${r.price_fixed} + company=${r.company_fixed_amount})`
  dist.set(key, (dist.get(key) || 0) + 1)
}
for (const [k, v] of [...dist].sort()) console.log(' ', k, '->', v, '件')
