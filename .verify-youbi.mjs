import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('=')).map(l => {
    const i = l.indexOf('=')
    return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
  })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(cols) {
  const out = []
  for (let from = 0; ; from += 500) {
    const { data, error } = await sb.from('places').select(cols).range(from, from + 499)
    if (error) { console.error('ERR', error.message); process.exit(1) }
    out.push(...data)
    if (data.length < 500) break
  }
  return out
}

// まず1行だけ取って、列名の一覧（匿名キーで見える範囲）を確認する
const { data: one } = await sb.from('places').select('*').limit(1)
console.log('=== places の列（匿名キーで見えるもの） ===')
console.log(Object.keys(one[0]).join(', '))
console.log('曜日らしい列名:', Object.keys(one[0]).filter(k => /day|week|youbi|dow/i.test(k)).join(', ') || '(なし)')

const rows = await all('id, title, status, closed, open_days, schedule, max_slots, description, recruit, fee, day_type_fees, open_time, close_time, details')
console.log('\n全件:', rows.length)

const pub = rows.filter(r => r.status === 'published' && !r.closed)
console.log('募集中(published かつ closed でない):', pub.length)

const DOW = /(月曜|火曜|水曜|木曜|金曜|土曜|日曜|平日|土日|週末|祝日|毎週)/

// open_days
const odFilled = pub.filter(r => Array.isArray(r.open_days) && r.open_days.map(x => (x || '').trim()).filter(Boolean).length > 0)
console.log('\n--- open_days ---')
console.log('中身が入っている件数:', odFilled.length)
console.log('2要素以上ある件数:', pub.filter(r => Array.isArray(r.open_days) && r.open_days.map(x => (x||'').trim()).filter(Boolean).length > 1).length)
const odDow = odFilled.filter(r => DOW.test(r.open_days.map(x=>(x||'').trim()).filter(Boolean).join(' ')))
console.log('曜日らしい語を含む件数:', odDow.length)
console.log('例（先頭10件）:')
odFilled.slice(0, 10).forEach(r => console.log('  ', JSON.stringify(r.open_days), '|', (r.title||'').slice(0, 30)))

// schedule
const schFilled = pub.filter(r => Array.isArray(r.schedule) && r.schedule.filter(d => d && d.date).length > 0)
console.log('\n--- schedule（具体的な日程） ---')
console.log('日付が入っている件数:', schFilled.length)

// 画面の「日程」欄に実際に出る文字列を再現（PlaceDetailClient.tsx の scheduleText と同じロジック）
let cntSchedule = 0, cntOpenDays = 0, cntSoudan = 0, dowInShown = 0
const shownSamples = []
for (const p of pub) {
  let text
  if (Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 0) {
    text = p.schedule.filter(d => d && d.date).map(d => d.date + ' ' + d.start + '〜' + d.end).join(' / ')
    cntSchedule++
  } else {
    const od = (p.open_days || []).map(x => (x || '').trim()).filter(Boolean)[0]
    if (od) { text = od; cntOpenDays++ } else { text = '要相談'; cntSoudan++ }
  }
  if (DOW.test(text)) dowInShown++
  shownSamples.push(text)
}
console.log('\n--- 詳細ページの「日程」欄に実際に出る値 ---')
console.log('schedule 由来:', cntSchedule, '/ open_days 由来:', cntOpenDays, '/ 「要相談」:', cntSoudan)
console.log('日程欄に曜日らしい語が出る件数:', dowInShown, '/', pub.length)
console.log('日程欄の値の例（先頭15件）:')
shownSamples.slice(0, 15).forEach(t => console.log('   -', t.slice(0, 60)))
console.log('「要相談」以外の値の例:')
shownSamples.filter(t => t !== '要相談').slice(0, 15).forEach(t => console.log('   -', t.slice(0, 60)))

// max_slots
console.log('\n--- max_slots（募集台数） ---')
console.log('入っている件数:', pub.filter(r => r.max_slots != null).length, '/', pub.length)

// 出店料
console.log('\n--- day_type_fees（平日/土日祝で料金が変わる） ---')
console.log('入っている件数:', pub.filter(r => r.day_type_fees && Object.keys(r.day_type_fees).length > 0).length)

// 本文（description / recruit）に曜日の記述があるか
const descDow = pub.filter(r => DOW.test((r.description || '') + ' ' + (r.recruit || '')))
console.log('\n--- 募集要項の自由文（description/recruit） ---')
console.log('曜日らしい語を含む件数:', descDow.length, '/', pub.length)
console.log('description が空でない件数:', pub.filter(r => (r.description||'').trim()).length)
console.log('例:')
descDow.slice(0, 6).forEach(r => {
  const m = ((r.description || '') + ' ' + (r.recruit || '')).match(new RegExp('.{0,25}' + DOW.source + '.{0,25}'))
  console.log('   -', (r.title||'').slice(0,20), '…', (m ? m[0] : '').replace(/\n/g, ' '))
})

// details の中に曜日らしいキーがあるか
const dkeys = new Set()
pub.forEach(r => { if (r.details) Object.keys(r.details).forEach(k => dkeys.add(k)) })
console.log('\n--- details の中のキー一覧 ---')
console.log([...dkeys].sort().join(', '))
