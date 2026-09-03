// サービス仕様の検証用（読み取りのみ）
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

async function all(table, cols = '*') {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const places = await all('places')
const live = places.filter(p => p.status === 'published' && !p.closed)
const pub = places.filter(p => p.status === 'published')
console.log('places 全体', places.length)
console.log('published 全体（closed 含む）', pub.length)
console.log('published かつ closed でない = 募集中', live.length)
console.log('published かつ closed', pub.length - live.length)

// 都道府県
const prefs = {}
for (const p of live) prefs[p.prefecture ?? '(なし)'] = (prefs[p.prefecture ?? '(なし)'] ?? 0) + 1
console.log('募集中の都道府県', JSON.stringify(prefs, null, 0))
const prefsPub = {}
for (const p of pub) prefsPub[p.prefecture ?? '(なし)'] = (prefsPub[p.prefecture ?? '(なし)'] ?? 0) + 1
console.log('公開中(closed含む)の都道府県', JSON.stringify(prefsPub, null, 0))

// 案件ページの表示ロジック（PlaceDetailClient の feeText と同じ）を再現する
const perDayFeeRange = (schedule) => {
  if (!Array.isArray(schedule)) return null
  const vals = schedule.map(d => Number(d?.fee)).filter(v => Number.isFinite(v) && v > 0)
  if (vals.length === 0) return null
  return { min: Math.min(...vals), max: Math.max(...vals) }
}
const feeText = (p) => {
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  const range = perDayFeeRange(p.schedule)
  if (range) {
    const parts = [range.min === range.max ? `${range.min}円/日` : `${range.min}円〜${range.max}円/日`]
    if (pct > 0) parts.push('売上の' + pct + '%')
    return parts.join(' ＋ ')
  }
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  if (fixed === 0 && pct === 0) return p.fee || '要相談'
  const unit = p.place_fixed_unit === 'per_event' ? '期間' : '日'
  const parts = []
  if (fixed > 0) parts.push(`${fixed}円/${unit}`)
  if (pct > 0) parts.push('売上の' + pct + '%')
  return parts.join(' ＋ ')
}
// 「金額が画面に出ているか」＝ 数字＋円 か ％ が表示文に含まれるか
const shown = live.map(p => ({ id: p.id, title: p.title, fee: p.fee, t: feeText(p) }))
const withNum = shown.filter(s => /\d/.test(s.t) && /円|%/.test(s.t))
console.log('\n--- ログイン後に画面へ出る出店料 ---')
console.log('金額（円 or %）が出る件数', withNum.length, '/', live.length)
const noNum = shown.filter(s => !(/\d/.test(s.t) && /円|%/.test(s.t)))
console.log('金額が出ない件数', noNum.length)
for (const s of noNum) console.log('   ×', JSON.stringify(s.t).slice(0, 60), '｜fee=', JSON.stringify(String(s.fee ?? '')).slice(0, 60))

// blog-metrics の feeKindOf（fee本文基準）で応相談になるもの
const norm = s => String(s ?? '')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/,/g, '').replace(/％/g, '%').replace(/\s+/g, ' ')
const feeKindOf = p => {
  const t = norm(p.fee)
  const hasYen = /\d{3,6}\s*円/.test(t) || /\d+\s*万円/.test(t)
  const hasPct = /\d{1,2}\s*%/.test(t)
  const capOnly = /上限|最低保証/.test(t)
  if (hasYen && hasPct && !capOnly) return '併用'
  if (hasPct) return '歩合'
  if (hasYen) {
    const kakutei = /(?:平日|週末|土日|土日祝|休日|1日|一日)[^。]{0,12}?\d{3,6}\s*円/.test(t)
      || /\d{3,6}\s*円\s*\/\s*日/.test(t)
      || /^\s*\d{3,6}\s*円/.test(t)
    if (!kakutei && /相談|問い合わせ|問合せ|不明|未定|買取|予定/.test(t)) return '応相談'
    return '固定'
  }
  return '応相談'
}
const soudan = live.filter(p => feeKindOf(p) === '応相談')
console.log('\nfee本文基準の応相談', soudan.length)
for (const p of soudan) console.log('   ・', p.title, '｜fee=', JSON.stringify(String(p.fee ?? '')).slice(0, 70), '｜画面表示=', feeText(p))

// fee が空・null の件数
console.log('\nfee が空/null の募集中案件', live.filter(p => !String(p.fee ?? '').trim()).length)

// 出店者
const sellers = await all('public_sellers')
const menus = await all('menus')
console.log('\n--- 出店者 ---')
console.log('public_sellers（role=seller かつ approved）', sellers.length)
const EXCLUDED = ['株式会社nav', '株式会社アーク']
console.log('/sellers 一覧に出る数（運営2社を除く）', sellers.filter(s => !EXCLUDED.includes(String(s.shop_name ?? '').trim())).length)
console.log('写真あり', sellers.filter(s => (s.photos ?? []).length > 0).length)
const menuBy = new Set(menus.map(m => m.seller_id))
console.log('メニューあり', sellers.filter(s => menuBy.has(s.id)).length)
console.log('店名あり', sellers.filter(s => String(s.shop_name ?? '').trim()).length)
console.log('メニュー総数', menus.length, '／価格あり', menus.filter(m => m.price != null).length, '／写真あり', menus.filter(m => m.photo_url).length)

const genresOf = s => {
  let v = s.genre
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) }
  }
  return (v ?? []).map(x => String(x).trim()).filter(Boolean)
}
const gc = {}
let multi = 0
const meal = new Set(), sweet = new Set()
const areas = {}
for (const s of sellers) {
  const g = genresOf(s)
  if (g.length > 1) multi += 1
  for (const k of g) gc[k] = (gc[k] ?? 0) + 1
  if (g.includes('食事')) meal.add(s.id)
  if (g.includes('スイーツ')) sweet.add(s.id)
  for (const a of (s.areas ?? [])) areas[a] = (areas[a] ?? 0) + 1
}
console.log('ジャンル', JSON.stringify(gc))
console.log('2つ以上', multi, '／食事かスイーツ', new Set([...meal, ...sweet]).size)
console.log('エリア', JSON.stringify(areas))

// 匿名キーで読めないもの
for (const t of ['seller_documents', 'applications', 'profiles']) {
  const { error, count } = await db.from(t).select('*', { count: 'exact', head: true })
  console.log(`\n${t}: ${error ? 'エラー=' + error.message : '件数=' + count}`)
}
