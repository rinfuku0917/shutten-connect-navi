import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, select) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(select).range(from, from + 999)
    if (error) { console.log('ERR', table, error.message); return out }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const rows = await all('places',
  'id,title,prefecture,status,closed,price_fixed,price_share_pct,place_fixed_unit,company_fixed_amount,company_fixed_unit,company_share_pct,day_type_fees,schedule,fee')

const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('places 全件:', rows.length, '/ 公開中:', pub.length)

const med = a => {
  const s = [...a].sort((x, y) => x - y)
  if (!s.length) return null
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}
const fmt = a => a.length ? `n=${a.length} min=${Math.min(...a)} max=${Math.max(...a)} 中央値=${med(a)}` : 'n=0'

// ---- 1. day_type_fees を持つ案件 ----
const has = x => x && typeof x === 'object' &&
  (['weekday','weekend'].some(k => x[k] && (typeof x[k].placeFee === 'number' || typeof x[k].companyFee === 'number')))
const dtf = pub.filter(r => has(r.day_type_fees))
console.log('\n=== day_type_fees を持つ公開中案件:', dtf.length, '件 ===')
const shapes = {}
for (const r of dtf) {
  const d = r.day_type_fees
  const k = JSON.stringify(d)
  shapes[k] = (shapes[k] || 0) + 1
}
for (const [k, n] of Object.entries(shapes)) console.log(' ', n, '件:', k)
console.log('  タイトル:')
for (const r of dtf) console.log('   -', r.title, '| price_fixed=', r.price_fixed, 'company_fixed=', r.company_fixed_amount, '| pref=', r.prefecture)

// ---- 2. 固定制の集計。総額(place+company) と place側 の両方で ----
const fixedRows = pub.filter(r => (r.price_fixed || 0) + (r.company_fixed_amount || 0) > 0 || has(r.day_type_fees))
console.log('\n=== 固定額がある公開中案件:', fixedRows.length, '件 ===')

const wdTotal = [], wdPlace = [], weTotal = [], wePlace = []
for (const r of fixedRows) {
  if (has(r.day_type_fees)) {
    const d = r.day_type_fees
    const t = s => (typeof s?.placeFee === 'number' ? s.placeFee : 0) + (typeof s?.companyFee === 'number' ? s.companyFee : 0)
    const p = s => (typeof s?.placeFee === 'number' ? s.placeFee : 0)
    if (d.weekday) { wdTotal.push(t(d.weekday)); wdPlace.push(p(d.weekday)) }
    if (d.weekend) { weTotal.push(t(d.weekend)); wePlace.push(p(d.weekend)) }
  } else {
    const tot = (r.price_fixed || 0) + (r.company_fixed_amount || 0)
    const pl = r.price_fixed || 0
    if (tot > 0) { wdTotal.push(tot); weTotal.push(tot); wdPlace.push(pl); wePlace.push(pl) }
  }
}
console.log('平日 総額(出店者の支払):', fmt(wdTotal))
console.log('平日 place側(場所の取り分):', fmt(wdPlace))
console.log('週末 総額(出店者の支払):', fmt(weTotal))
console.log('週末 place側(場所の取り分):', fmt(wePlace))

// ---- 3. 記事の下限3,000円 / 4,500円は誰か ----
console.log('\n=== 総額3,000円ちょうどの案件 ===')
for (const r of fixedRows) {
  const tot = has(r.day_type_fees)
    ? ((r.day_type_fees.weekday?.placeFee || 0) + (r.day_type_fees.weekday?.companyFee || 0))
    : (r.price_fixed || 0) + (r.company_fixed_amount || 0)
  if (tot === 3000) console.log('  -', r.title, '| dtf=', has(r.day_type_fees), '| place=', has(r.day_type_fees) ? r.day_type_fees.weekday?.placeFee : r.price_fixed)
}

// ---- 4. company 側が入っている案件はどれくらいあるか（＝内数手数料の普及度）----
const withCompany = pub.filter(r => (r.company_fixed_amount || 0) > 0 || (r.company_share_pct || 0) > 0 || has(r.day_type_fees))
console.log('\n=== 運営の取り分(company_fixed_amount>0 or company_share_pct>0 or dtf)がある公開中案件:', withCompany.length, '/', pub.length, '===')
const noCompany = fixedRows.filter(r => !has(r.day_type_fees) && (r.company_fixed_amount || 0) === 0)
console.log('固定制のうち company_fixed_amount=0（＝price_fixed が総額＝場所の取り分）:', noCompany.length, '件')
console.log('  その price_fixed 分布:', fmt(noCompany.map(r => r.price_fixed || 0).filter(x => x > 0)))
const yesCompany = fixedRows.filter(r => has(r.day_type_fees) || (r.company_fixed_amount || 0) > 0)
console.log('固定制のうち 運営の取り分あり:', yesCompany.length, '件')

// ---- 5. 歩合の10% は place側か合算か ----
const pctRows = pub.filter(r => (r.price_share_pct || 0) + (r.company_share_pct || 0) > 0)
console.log('\n=== 歩合制の公開中案件:', pctRows.length, '件 ===')
const combo = {}
for (const r of pctRows) {
  const k = `place=${r.price_share_pct || 0}% company=${r.company_share_pct || 0}% 合計=${(r.price_share_pct || 0) + (r.company_share_pct || 0)}%`
  combo[k] = (combo[k] || 0) + 1
}
for (const [k, n] of Object.entries(combo).sort((a, b) => b[1] - a[1])) console.log(' ', n, '件:', k)
