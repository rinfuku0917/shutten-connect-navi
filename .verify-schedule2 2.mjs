import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
async function all(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999)
    if (error) throw new Error(error.message); out.push(...data)
    if (data.length < 1000) break
  }
  return out
}
const places = await all('places')
const live = places.filter(p => p.status === 'published' && !p.closed)

// 全302件で open_days が2行以上のものはあるか
const multiAll = places.filter(p => (p.open_days || []).map(x => (x || '').trim()).filter(Boolean).length > 1)
console.log('全302件中 open_days が2行以上:', multiAll.length)
console.log('open_days の最大行数:', Math.max(...places.map(p => (p.open_days || []).filter(Boolean).length)))
// schedule が2件以上（複数日）のものは？表示は " / " で全部つなぐので欠落しない
const multiSch = live.filter(p => Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 1)
console.log('募集中で schedule の日付が2件以上:', multiSch.length)

console.log('\n===== 募集中110件の日程データ（画面に出る順） =====')
const rows = []
for (const p of live) {
  const sch = Array.isArray(p.schedule) ? p.schedule.filter(d => d && d.date) : []
  const od = (p.open_days || []).map(x => (x || '').trim()).filter(Boolean)
  let src, text
  if (sch.length > 0) { src = 'schedule'; text = sch.map(d => d.date).join(' / ') }
  else if (od.length > 0) { src = 'open_days'; text = od[0] }
  else { src = '空→要相談'; text = '' }
  rows.push({ src, text, type: p.place_type })
}
const nonEmpty = rows.filter(r => r.src !== '空→要相談')
console.log('空（要相談表示）:', rows.length - nonEmpty.length, '/ 何か書いてある:', nonEmpty.length)
console.log('\n--- 何か書いてある54件の中身 ---')
nonEmpty.forEach((r, i) => console.log(`${String(i + 1).padStart(2)} [${r.src}][${r.type}] ${r.text}`))

// 指摘者の正規表現での分類
const R_REVIEWER = /曜|毎週|毎月|平日|土日/
console.log('\n指摘者の正規表現(曜|毎週|毎月|平日|土日)で open_days[0] が一致:',
  rows.filter(r => r.src === 'open_days' && R_REVIEWER.test(r.text)).length)

// 曜日をきちんと拾う分類（「金、土、日」「月〜日」など曜の字が無い書き方も含める）
const WEEK_STRICT = /[月火水木金土日]\s*(?:曜|[、,・／\/～〜]|$)|曜|毎週|毎月|平日|週末|土日|祝|毎日|全日/
const HAS_DATE = /\d{1,2}\s*月\s*\d{1,2}\s*日|\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}/
let w = 0, d = 0, both = 0, neither = 0
const neitherList = []
for (const r of nonEmpty) {
  const hw = WEEK_STRICT.test(r.text), hd = r.src === 'schedule' || HAS_DATE.test(r.text)
  if (hw && hd) both++
  else if (hw) w++
  else if (hd) d++
  else { neither++; neitherList.push(r.text) }
}
console.log('\n--- 54件をきちんと分類 ---')
console.log('曜日のみ:', w, '/ 日付のみ:', d, '/ 両方:', both, '/ どちらでもない:', neither)
console.log('どちらでもない:', JSON.stringify(neitherList))
