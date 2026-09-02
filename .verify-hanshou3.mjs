import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const out = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) throw error; out.push(...data); if (data.length < 500) break
}
const pub = out.filter(p => p.status === 'published' && !p.closed)
const hasSchedule = p => Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 0
const openDay = p => ((p.open_days || []).map(x => (x || '').trim()).filter(Boolean)[0] || '')
const C = pub.filter(p => !hasSchedule(p) && !openDay(p))

// もっと広い正規表現（日付・期間の表現も曜日の手がかりに数える）で反証を試す
const BROAD = /[月火水木金土日]曜|毎週|毎月|平日|土日|週末|祝日|曜日|[0-9０-９]{1,2}\s*[\/月]\s*[0-9０-９]{1,2}|ランチ|通年|毎日|常設/
const text = p => [p.title, p.recruit, p.description, JSON.stringify(p.details || {})].join('\n')
const strictWD = /[月火水木金土日]曜|毎週|毎月|平日|土日|週末|祝日|曜日/
console.log('要相談 56件のうち')
console.log('  厳しめ正規表現（曜日語のみ, details全体も見る）で手がかりあり:', C.filter(p => strictWD.test(text(p))).length)
console.log('  → 手がかり無し:', C.filter(p => !strictWD.test(text(p))).length)
console.log('  ゆるい正規表現（日付/ランチ/常設なども可）で手がかりあり:', C.filter(p => BROAD.test(text(p))).length)
console.log('  → それでも手がかり無し:', C.filter(p => !BROAD.test(text(p))).length)
console.log('\n Olympic系（details に「平日」）が どこに書いてあるか:')
const oly = C.find(p => /Olympic/.test(p.title))
if (oly) {
  console.log('  title:', oly.title)
  console.log('  description:', JSON.stringify((oly.description || '').slice(0, 200)))
  console.log('  details:', JSON.stringify(oly.details).slice(0, 600))
  console.log('  open_days:', JSON.stringify(oly.open_days), ' schedule:', JSON.stringify(oly.schedule))
}
console.log('\n 曜日の手がかりが本当に何も無い案件（厳しめ）:')
C.filter(p => !strictWD.test(text(p))).forEach(p => console.log('   -', p.title))
