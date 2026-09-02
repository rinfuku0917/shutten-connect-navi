import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, cols) {
  const out = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 499)
    if (error) throw new Error(table + ': ' + error.message)
    out.push(...data)
    if (data.length < 500) break
  }
  return out
}

const rows = await all('places', '*')
console.log('places 全件:', rows.length)
console.log('カラム:', Object.keys(rows[0] || {}).join(','))

const pub = rows.filter(p => p.status === 'published' && !p.closed)
console.log('公開中（status=published かつ closed が真でない）:', pub.length)

// 画面(PlaceDetailClient.tsx L251-253)と同じ判定を再現する
const hasSchedule = p => Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 0
const openDayText = p => ((p.open_days || []).map(x => (x || '').trim()).filter(Boolean)[0] || '')
const scheduleText = p => hasSchedule(p)
  ? p.schedule.filter(d => d.date).map(d => d.date + ' ' + d.start + '〜' + d.end).join(' / ')
  : (openDayText(p) || '要相談')

const A = pub.filter(hasSchedule)
const B = pub.filter(p => !hasSchedule(p) && openDayText(p))
const C = pub.filter(p => !hasSchedule(p) && !openDayText(p))
console.log('\n[日程欄]')
console.log('  schedule に日付あり（具体的な日付が出る）:', A.length)
console.log('  open_days から出る:', B.length)
console.log('  「要相談」と出る:', C.length, '=', (C.length / pub.length * 100).toFixed(1) + '%')
console.log('  A+B（何か日程情報が出る）:', A.length + B.length)

console.log('\n[open_days で表示される実際の文字列（B の 全件）]')
B.forEach(p => console.log('   -', JSON.stringify(openDayText(p)), '|', (p.title || '').slice(0, 30)))

console.log('\n[schedule 表示の例（A の全件）]')
A.forEach(p => console.log('   -', scheduleText(p).slice(0, 70), '|', (p.title || '').slice(0, 26)))

// open_days が「曜日」を示しているか
const WD = /[月火水木金土日]曜|毎週|毎月|平日|土日|週末|祝日|曜日|[月火水木金土日]・[月火水木金土日]|\([月火水木金土日]\)|（[月火水木金土日]）/
console.log('\n  うち曜日を示す語を含む open_days:', B.filter(p => WD.test(openDayText(p))).length)

// C（要相談）のうち、他の欄に曜日の手がかりがあるか
const textOf = p => [p.title, p.recruit, p.description, p.details && p.details.notes].filter(Boolean).join('\n')
const cWith = C.filter(p => WD.test(textOf(p)))
console.log('\n[「要相談」56件相当のうち、タイトル/募集内容/概要/備考に曜日の語があるか]')
console.log('  曜日の語あり:', cWith.length)
console.log('  曜日の語なし:', C.length - cWith.length)
C.filter(p => !WD.test(textOf(p))).slice(0, 100).forEach(p =>
  console.log('   x', (p.title || '').slice(0, 34), '| recruit:', JSON.stringify((p.recruit || '').slice(0, 40)), '| desc:', JSON.stringify((p.description || '').slice(0, 40))))

// 募集台数
console.log('\n[募集台数 max_slots]')
console.log('  未設定(null):', pub.filter(p => p.max_slots == null).length)
console.log('  設定あり:', pub.filter(p => p.max_slots != null).length)
const slotVals = {}
pub.forEach(p => { const k = String(p.max_slots); slotVals[k] = (slotVals[k] || 0) + 1 })
console.log('  値の分布:', JSON.stringify(slotVals))

// 出店料
const feeText = p => {
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  const sched = (p.schedule || []).map(d => Number(d && d.fee)).filter(n => Number.isFinite(n) && n > 0)
  if (sched.length > 0) return 'schedule単価あり'
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  if (fixed === 0 && pct === 0) return p.fee ? 'feeテキスト:' + p.fee : '要相談'
  return '金額あり'
}
console.log('\n[出店料（ログイン後に見える値）]')
const feeKinds = {}
pub.forEach(p => { const k = feeText(p).startsWith('feeテキスト') ? 'feeテキスト' : feeText(p); feeKinds[k] = (feeKinds[k] || 0) + 1 })
console.log(' ', JSON.stringify(feeKinds))
console.log('  未ログインでは全件「🔒 ログイン後に表示」（PlaceDetailClient.tsx L307, canSeeFee は user があるときだけ true）')

// 常設/イベント・都道府県・場所の種類（記事の他の数字の裏取り）
const byType = {}
pub.forEach(p => { const k = p.place_type || '(null)'; byType[k] = (byType[k] || 0) + 1 })
console.log('\n[place_type]', JSON.stringify(byType))
const byPref = {}
pub.forEach(p => { const k = p.prefecture || '(null)'; byPref[k] = (byPref[k] || 0) + 1 })
console.log('[都道府県]', JSON.stringify(byPref, null, 0))
const byCat = {}
pub.forEach(p => { const k = p.category || '(null)'; byCat[k] = (byCat[k] || 0) + 1 })
console.log('[category]', JSON.stringify(byCat))
