import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

async function all(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const places = await all('places')
const live = places.filter(p => p.status === 'published' && !p.closed)
console.log('全places:', places.length, '/ 募集中:', live.length)

// --- 画面表示ロジックを PlaceDetailClient.tsx:251-253 のとおり再現 ---
const displayed = p => {
  const hasDate = Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 0
  if (hasDate) return { kind: 'date', text: p.schedule.filter(d => d.date).map(d => d.date + ' ' + d.start + '〜' + d.end).join(' / ') }
  const od = (p.open_days || []).map(x => (x || '').trim()).filter(Boolean)
  if (od.length === 0) return { kind: 'placeholder', text: '要相談' }
  return { kind: 'open_days', text: od[0], rest: od.length }
}

const WEEK = /曜|毎週|毎月|平日|土日|週末|祝/

let date = 0, placeholder = 0, odWeek = 0, odOther = 0
const otherSamples = []
const multi = []
for (const p of live) {
  const d = displayed(p)
  if (d.kind === 'date') date++
  else if (d.kind === 'placeholder') placeholder++
  else if (WEEK.test(d.text)) odWeek++
  else { odOther++; if (otherSamples.length < 25) otherSamples.push(d.text) }
  if (d.kind === 'open_days' && d.rest > 1) multi.push({ title: p.title, days: (p.open_days || []).filter(Boolean) })
}
console.log('\n== 画面の「日程」欄に何が出るか（110件） ==')
console.log('  日付が出る          :', date)
console.log('  要相談（未記載）    :', placeholder)
console.log('  open_days[0]が曜日系:', odWeek)
console.log('  open_days[0]がその他:', odOther)
console.log('  合計:', date + placeholder + odWeek + odOther)
console.log('\n  その他の中身の例:', JSON.stringify(otherSamples, null, 1))
console.log('\n  open_days が2行以上ある案件:', multi.length)
console.log(JSON.stringify(multi.slice(0, 12), null, 1))

// --- 常設だけ ---
const reg = live.filter(p => p.place_type === 'regular')
let rDate = 0, rPh = 0, rWeek = 0, rOther = 0
for (const p of reg) {
  const d = displayed(p)
  if (d.kind === 'date') rDate++
  else if (d.kind === 'placeholder') rPh++
  else if (WEEK.test(d.text)) rWeek++
  else rOther++
}
console.log('\n== 常設', reg.length, '件だけ ==')
console.log('  日付', rDate, '/ 要相談', rPh, '/ 曜日系', rWeek, '/ その他', rOther)

// --- open_days の生データの実態（1行目に限らず全行 + schedule も含めて） ---
let anyWeekAnywhere = 0, anyDateAnywhere = 0, nothingAtAll = 0, otherOnly = 0
const nothingSamples = []
for (const p of live) {
  const od = (p.open_days || []).map(x => (x || '').trim()).filter(Boolean)
  const sch = Array.isArray(p.schedule) ? p.schedule.filter(d => d && d.date) : []
  const joined = od.join(' ')
  const hasWeek = WEEK.test(joined)
  const hasDate = sch.length > 0 || /\d{1,2}\s*[\/月]\s*\d{1,2}/.test(joined)
  if (hasWeek) anyWeekAnywhere++
  if (hasDate) anyDateAnywhere++
  if (od.length === 0 && sch.length === 0) { nothingAtAll++; if (nothingSamples.length < 10) nothingSamples.push(p.title) }
  else if (!hasWeek && !hasDate) otherOnly++
}
console.log('\n== 日程データの実態（open_days全行 + schedule） ==')
console.log('  曜日系の記載がどこかにある:', anyWeekAnywhere)
console.log('  日付の記載がどこかにある  :', anyDateAnywhere)
console.log('  日程データが完全に空      :', nothingAtAll)
console.log('  何か書いてあるが曜日でも日付でもない:', otherOnly)
console.log('  空の例:', JSON.stringify(nothingSamples, null, 1))

// --- open_days / schedule のカラム型の確認 ---
const s = live.find(p => (p.open_days || []).length > 0)
console.log('\nopen_days のサンプル:', JSON.stringify(s?.open_days))
const s2 = live.find(p => Array.isArray(p.schedule) && p.schedule.length > 0)
console.log('schedule のサンプル:', JSON.stringify(s2?.schedule))

// --- schedule はあるが date が空、というケース ---
const schedNoDate = live.filter(p => Array.isArray(p.schedule) && p.schedule.length > 0 && p.schedule.filter(d => d && d.date).length === 0)
console.log('\nschedule はあるが date が全部空:', schedNoDate.length)
