import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
async function all(t) {
  const out = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await db.from(t).select('*').range(f, f + 999)
    if (error) throw new Error(error.message)
    out.push(...data); if (data.length < 1000) break
  }
  return out
}
const live = (await all('places')).filter(p => p.status === 'published' && !p.closed)

// 出店料の内訳（場所側 placeFee と 運営側 companyFee）
console.log('--- 出店料の内訳が入っている案件 ---')
let dayTypeN = 0, fixedN = 0
const split = []
for (const p of live) {
  const d = p.day_type_fees
  if (d && (d.weekday || d.weekend)) {
    dayTypeN++
    split.push({
      title: p.title,
      wd: d.weekday ? `place=${d.weekday.placeFee} company=${d.weekday.companyFee}` : '-',
      we: d.weekend ? `place=${d.weekend.placeFee} company=${d.weekend.companyFee}` : '-',
      fee: String(p.fee ?? '').slice(0, 40),
    })
  }
  if (p.price_fixed || p.company_fixed_amount) fixedN++
}
console.log('day_type_fees あり', dayTypeN, '／ price_fixed か company_fixed_amount あり', fixedN)
for (const s of split.slice(0, 40)) console.log(' ', s.title.slice(0, 28), '｜平日', s.wd, '｜週末', s.we, '｜fee=', s.fee)

console.log('\n--- price_fixed（場所側）と company_fixed_amount（運営側）の分布 ---')
const tally = {}
for (const p of live) {
  const k = `place=${p.price_fixed ?? 'null'} / company=${p.company_fixed_amount ?? 'null'} / pct place=${p.price_share_pct ?? 'null'} company=${p.company_share_pct ?? 'null'}`
  tally[k] = (tally[k] ?? 0) + 1
}
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) console.log(' ', v.toString().padStart(3), k)

// 場所側の取り分が 0 の案件はいくつか
const zeroPlace = live.filter(p => (p.price_fixed ?? 0) === 0 && (p.price_share_pct ?? 0) === 0 && ((p.company_fixed_amount ?? 0) > 0 || (p.company_share_pct ?? 0) > 0))
console.log('\n場所側の取り分が0で、運営側にだけ金額が入っている案件', zeroPlace.length, '/', live.length)

// 募集台数
console.log('\nmax_slots が入っている募集中案件', live.filter(p => p.max_slots != null).length, '/', live.length)
// 日程・曜日
const hasSchedule = live.filter(p => Array.isArray(p.schedule) && p.schedule.filter(d => d?.date).length > 0)
console.log('日付入りの日程がある案件', hasSchedule.length)
const recruitWeekday = live.filter(p => /毎週|曜/.test(String(p.recruit ?? '') + String(p.schedule_note ?? '') + String(p.description ?? '')))
console.log('本文に「毎週」か「曜」が出てくる案件', recruitWeekday.length)
console.log('\n列の一覧:', Object.keys(live[0]).join(', '))
