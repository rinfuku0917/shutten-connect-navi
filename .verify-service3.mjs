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
    if (error) throw new Error(error.message); out.push(...data); if (data.length < 1000) break
  }
  return out
}
const live = (await all('places')).filter(p => p.status === 'published' && !p.closed)
const norm = s => String(s ?? '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0)).replace(/,/g, '').replace(/％/g, '%').replace(/\s+/g, ' ')
const feeKindOf = p => {
  const t = norm(p.fee)
  const hasYen = /\d{3,6}\s*円/.test(t) || /\d+\s*万円/.test(t)
  const hasPct = /\d{1,2}\s*%/.test(t)
  const capOnly = /上限|最低保証/.test(t)
  if (hasYen && hasPct && !capOnly) return '併用'
  if (hasPct) return '歩合'
  if (hasYen) {
    const k = /(?:平日|週末|土日|土日祝|休日|1日|一日)[^。]{0,12}?\d{3,6}\s*円/.test(t) || /\d{3,6}\s*円\s*\/\s*日/.test(t) || /^\s*\d{3,6}\s*円/.test(t)
    if (!k && /相談|問い合わせ|問合せ|不明|未定|買取|予定/.test(t)) return '応相談'
    return '固定'
  }
  return '応相談'
}
const perDayFeeRange = (schedule) => {
  if (!Array.isArray(schedule)) return null
  const vals = schedule.map(d => Number(d?.fee)).filter(v => Number.isFinite(v) && v > 0)
  if (vals.length === 0) return null
  return { min: Math.min(...vals), max: Math.max(...vals) }
}
const feeText = (p) => {
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  const range = perDayFeeRange(p.schedule)
  if (range) { const a = [range.min === range.max ? `${range.min}円/日` : `${range.min}〜${range.max}円/日`]; if (pct > 0) a.push('売上の' + pct + '%'); return a.join(' ＋ ') }
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  if (fixed === 0 && pct === 0) return p.fee || '要相談'
  const unit = p.place_fixed_unit === 'per_event' ? '期間' : '日'
  const a = []; if (fixed > 0) a.push(`${fixed}円/${unit}`); if (pct > 0) a.push('売上の' + pct + '%')
  return a.join(' ＋ ')
}
console.log('=== 併用（記事の分類）の案件が、案件ページでどう表示されるか ===')
for (const p of live.filter(p => feeKindOf(p) === '併用')) {
  console.log('・', p.title.slice(0, 30))
  console.log('   募集要項の本文 fee:', JSON.stringify(norm(p.fee).slice(0, 90)))
  console.log('   案件ページの表示  :', feeText(p).slice(0, 60))
}
console.log('\n=== 歩合（記事の分類）のうち、本文に金額もあるもの ===')
let n = 0
for (const p of live.filter(p => feeKindOf(p) === '歩合')) {
  const t = norm(p.fee)
  if (/\d{3,6}\s*円/.test(t) || /\d+\s*万円/.test(t)) { n++; console.log('・', p.title.slice(0, 26), '｜fee=', JSON.stringify(t.slice(0, 70)), '｜表示=', feeText(p).slice(0, 40)) }
}
console.log('該当', n, '件')
console.log('\n=== 固定（記事の分類）の案件が、ページでどう表示されるか（先頭10件） ===')
for (const p of live.filter(p => feeKindOf(p) === '固定').slice(0, 10)) {
  console.log('・', p.title.slice(0, 26), '｜表示=', JSON.stringify(feeText(p).slice(0, 60)))
}
const kinds = live.map(feeKindOf)
const cnt = v => kinds.filter(x => x === v).length
console.log('\n本文基準の集計: 固定', cnt('固定'), '歩合', cnt('歩合'), '併用', cnt('併用'), '応相談', cnt('応相談'))
// 表示基準（構造化列）での集計
const dispKind = p => {
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  const range = perDayFeeRange(p.schedule)
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0) + (range ? 1 : 0)
  if (fixed > 0 && pct > 0) return '併用'
  if (pct > 0) return '歩合'
  if (fixed > 0) return '固定'
  return '本文をそのまま表示'
}
const d = live.map(dispKind)
console.log('表示基準の集計: 固定', d.filter(x => x === '固定').length, '歩合', d.filter(x => x === '歩合').length, '併用', d.filter(x => x === '併用').length, '本文そのまま', d.filter(x => x === '本文をそのまま表示').length)
