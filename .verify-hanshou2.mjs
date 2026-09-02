import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const out = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) throw error
  out.push(...data); if (data.length < 500) break
}
const pub = out.filter(p => p.status === 'published' && !p.closed)

const hasSchedule = p => Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 0
const openDayText = p => ((p.open_days || []).map(x => (x || '').trim()).filter(Boolean)[0] || '')

// --- 出店料：ログイン後に見える文字列を実際に組み立てる（PlaceDetailClient.feeText と同じ）
const perDayFeeRange = sched => {
  const ns = (sched || []).map(d => Number(d && d.fee)).filter(n => Number.isFinite(n) && n > 0)
  return ns.length ? { min: Math.min(...ns), max: Math.max(...ns) } : null
}
const feeText = p => {
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  const r = perDayFeeRange(p.schedule)
  if (r) return (r.min === r.max ? r.min + '円/日' : r.min + '〜' + r.max + '円/日') + (pct ? ' ＋売上' + pct + '%' : '')
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  if (fixed === 0 && pct === 0) return p.fee || '要相談'
  return (fixed > 0 ? fixed + '円/' + (p.place_fixed_unit === 'per_event' ? '期間' : '日') : '') + (pct ? (fixed > 0 ? ' ＋' : '') + '売上' + pct + '%' : '')
}
const VAGUE = /要相談|応相談|相談|未定|お問い?合わせ|問合せ|ご確認|調整/
const texts = pub.map(feeText)
console.log('[ログイン後の出店料表示]')
console.log('  金額（数字）を含む:', texts.filter(t => /[0-9]/.test(t)).length)
console.log('  数字を一切含まない:', texts.filter(t => !/[0-9]/.test(t)).length)
console.log('  「要相談/応相談/未定」等の語を含む:', texts.filter(t => VAGUE.test(t)).length)
const noNum = pub.map((p, i) => [texts[i], p.title]).filter(([t]) => !/[0-9]/.test(t))
console.log('  数字なしの中身（重複まとめ）:')
const cnt = {}; noNum.forEach(([t]) => cnt[t] = (cnt[t] || 0) + 1)
Object.entries(cnt).sort((a, b) => b[1] - a[1]).forEach(([t, n]) => console.log('    ', n + '件:', JSON.stringify(t.slice(0, 60))))

console.log('\n[「要相談」56件のログイン後の出店料]')
const C = pub.filter(p => !hasSchedule(p) && !openDayText(p))
const ct = C.map(feeText)
console.log('  数字あり:', ct.filter(t => /[0-9]/.test(t)).length, '/ 数字なし:', ct.filter(t => !/[0-9]/.test(t)).length)

console.log('\n[募集内容 recruit の記入率（公開中110件）]')
console.log('  recruit あり:', pub.filter(p => (p.recruit || '').trim()).length)
console.log('  description あり:', pub.filter(p => (p.description || '').trim()).length)

// 未ログインの詳細ページで「日程」以外に条件が何行出るか
console.log('\n[未ログインの詳細ページに出る条件行]')
console.log('  日程 / アクセス / 出店料(🔒) / 出店形態 の4行のみ。')
console.log('  募集台数・開催時間・電源などの「出店条件」表は canSeeFee(=ログイン)でのみ表示（L359-380）。')
console.log('  → 未ログインでは 募集台数は 110件すべて非表示。')

// 日程が「要相談」かつ出店形態が「常設」= 曜日が本当に読めない案件
console.log('\n[要相談56件の内訳]')
console.log('  常設(regular):', C.filter(p => p.place_type === 'regular').length, '/ イベント(event):', C.filter(p => p.place_type === 'event').length)

// 反証テスト：open_days が空でも details に曜日情報が入っていないか
const WD = /[月火水木金土日]曜|毎週|毎月|平日|土日|週末|祝日|曜日/
const inDetails = C.filter(p => p.details && WD.test(JSON.stringify(p.details)))
console.log('  details(備考含む) に曜日語:', inDetails.length)
inDetails.forEach(p => console.log('     -', p.title.slice(0, 30), '|', JSON.stringify(p.details).match(WD)[0]))
// 反証テスト：open_time/close_time で日程が補われているか
console.log('  open_time か close_time あり:', C.filter(p => p.open_time || p.close_time).length, '（時刻であって曜日ではない）')

// 記事の他の数字の検算
console.log('\n[記事の他の数字]')
console.log('  常設97 / イベント13 →', pub.filter(p => p.place_type === 'regular').length, '/', pub.filter(p => p.place_type === 'event').length)
