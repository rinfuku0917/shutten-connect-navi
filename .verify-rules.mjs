import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n')
  .filter(l => l.includes('=') && !l.trim().startsWith('#'))
  .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

async function all(table, sel) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(sel).range(from, from + 999)
    if (error) { console.error(table, error.message); break }
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

const places = await all('places', '*')
console.log('places total:', places.length)
const open = places.filter(p => p.status === 'published' && !p.closed)
console.log('published & not closed:', open.length)

// 出店料の明記状況
const feeState = { 固定のみ: 0, 歩合のみ: 0, 併用: 0, 'fee текст только': 0, なし要相談: 0 }
const noFee = []
for (const p of open) {
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  const perDay = Array.isArray(p.schedule) && p.schedule.some(d => d && (typeof d.placeFee === 'number' || typeof d.companyFee === 'number'))
  const dtf = p.day_type_fees && typeof p.day_type_fees === 'object' &&
    ['weekday', 'weekend'].some(k => p.day_type_fees[k] && (typeof p.day_type_fees[k].placeFee === 'number' || typeof p.day_type_fees[k].companyFee === 'number'))
  if (!fixed && !pct && !perDay && !dtf) {
    noFee.push({ id: p.id, title: p.title, fee: p.fee, dtf: p.day_type_fees })
  }
}
console.log('--- 構造化された金額が一切ない案件（feeTextは p.fee か「要相談」）:', noFee.length)
for (const n of noFee) console.log('   ', JSON.stringify(n.fee), '|', n.title?.slice(0, 40))

// fee テキストも空の案件
const totallyBlank = noFee.filter(n => !n.fee || !String(n.fee).trim())
console.log('--- 出店料が完全に空（画面に「要相談」と出る）:', totallyBlank.length)

// 「応相談」表記
const soudan = open.filter(p => /相談|応談|問い合わせ|問合せ/.test(String(p.fee || '')))
console.log('--- fee テキストに相談/問い合わせを含む:', soudan.length)
for (const s of soudan) console.log('   ', JSON.stringify(s.fee), '|', s.title?.slice(0, 40))

// max_slots
const noSlots = open.filter(p => p.max_slots == null)
console.log('--- max_slots が未設定:', noSlots.length, '/', open.length)

// schedule（曜日・日程）
const noSchedule = open.filter(p => !Array.isArray(p.schedule) || p.schedule.filter(d => d && d.date).length === 0)
console.log('--- schedule に日付が1件も無い:', noSchedule.length, '/', open.length)

// 都道府県
const pref = {}
for (const p of open) pref[p.prefecture || '(未設定)'] = (pref[p.prefecture || '(未設定)'] || 0) + 1
console.log('--- 都道府県:', JSON.stringify(Object.entries(pref).sort((a, b) => b[1] - a[1]), null, 0))

// place_type
const types = {}
for (const p of open) types[p.place_type || '(未設定)'] = (types[p.place_type || '(未設定)'] || 0) + 1
console.log('--- place_type:', JSON.stringify(Object.entries(types).sort((a, b) => b[1] - a[1])))

// genres 入りの件数（カテゴリページ作成条件の確認）
const withGenres = places.filter(p => Array.isArray(p.genres) && p.genres.length > 0)
console.log('--- genres が入っている案件:', withGenres.length, '/ 全', places.length)

// 税表記
const taxNoted = open.filter(p => /税/.test(String(p.fee || '')))
console.log('--- fee テキストに「税」を含む:', taxNoted.length)
