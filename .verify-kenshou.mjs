import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]
    })
)

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1000行打ち切り対策で range で回す
const all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb
    .from('places')
    .select('id,title,status,closed,place_type,fee,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,day_type_fees,schedule')
    .range(from, from + 499)
  if (error) { console.error('ERR', error); process.exit(1) }
  all.push(...data)
  if (data.length < 500) break
}

console.log('全行数:', all.length)
const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中(published かつ closed でない):', pub.length)
console.log('  うち place_type=event:', pub.filter(p => p.place_type === 'event').length)
console.log('  うち event 以外(常設):', pub.filter(p => p.place_type !== 'event').length)

// --- 出店料の決め方を分類 ---
const fixedOf = p => (p.price_fixed || 0) + (p.company_fixed_amount || 0)
const pctOf = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
// 日ごとの金額（schedule内）
const schedFees = p => (Array.isArray(p.schedule) ? p.schedule : [])
  .map(s => (s?.placeFee ?? 0) + (s?.companyFee ?? 0))
  .filter(n => n > 0)

function kind(p) {
  const f = fixedOf(p) > 0 || schedFees(p).length > 0
  const s = pctOf(p) > 0
  if (f && s) return '併用'
  if (f) return '固定'
  if (s) return '歩合'
  return '応相談'
}

const tally = {}
for (const p of pub) { const k = kind(p); tally[k] = (tally[k] || 0) + 1 }
console.log('\n== 決め方（公開中全体）==', tally)

const perm = pub.filter(p => p.place_type !== 'event')
const evt = pub.filter(p => p.place_type === 'event')
const t2 = {}, t3 = {}
for (const p of perm) { const k = kind(p); t2[k] = (t2[k] || 0) + 1 }
for (const p of evt) { const k = kind(p); t3[k] = (t3[k] || 0) + 1 }
console.log('== 常設のみ ==', perm.length, t2)
console.log('== イベントのみ ==', evt.length, t3)

// --- 平日/週末の金額 ---
const med = a => {
  const s = [...a].sort((x, y) => x - y)
  if (!s.length) return null
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const dt = f => f ? (f.placeFee ?? 0) + (f.companyFee ?? 0) : 0

function dayAmounts(list, label) {
  const wd = [], we = [], flat = []
  for (const p of list) {
    if (kind(p) !== '固定' && kind(p) !== '併用') continue
    const d = p.day_type_fees
    if (d && (d.weekday || d.weekend)) {
      if (dt(d.weekday) > 0) wd.push(dt(d.weekday))
      if (dt(d.weekend) > 0) we.push(dt(d.weekend))
    } else {
      const f = fixedOf(p)
      if (f > 0) { flat.push(f); wd.push(f); we.push(f) }
    }
  }
  const stat = (a, n) => a.length
    ? `${n}: n=${a.length} 中央値${med(a).toLocaleString()} 最低${Math.min(...a).toLocaleString()} 最高${Math.max(...a).toLocaleString()}`
    : `${n}: なし`
  console.log(`\n--- ${label} (対象 ${list.length}件) ---`)
  console.log(' ' + stat(wd, '平日'))
  console.log(' ' + stat(we, '週末'))
  console.log(' 平日の内訳:', JSON.stringify(count(wd)))
  console.log(' 週末の内訳:', JSON.stringify(count(we)))
  console.log(' day_type_fees を持つ件数:', list.filter(p => p.day_type_fees && (p.day_type_fees.weekday || p.day_type_fees.weekend)).length)
  return { wd, we, flat }
}
function count(a) {
  const m = {}
  for (const v of a) m[v] = (m[v] || 0) + 1
  return Object.fromEntries(Object.entries(m).sort((x, y) => Number(x[0]) - Number(y[0])))
}

dayAmounts(pub, '公開中110件すべて（＝駐車場記事の書き方どおりの母数）')
dayAmounts(perm, '常設のみ（＝出店料記事が明記している母数）')
dayAmounts(evt, 'イベントのみ')

// 歩合の料率
const rates = {}
for (const p of pub) { const r = pctOf(p); if (r > 0) rates[r] = (rates[r] || 0) + 1 }
console.log('\n== 歩合の料率（公開中全体）==', rates)
