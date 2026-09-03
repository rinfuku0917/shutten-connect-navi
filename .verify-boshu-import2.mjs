import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const sb = createClient(U, K, { auth: { persistSession: false } })
const all = async (t, sel = '*') => { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await sb.from(t).select(sel).range(f, f + 999); if (error) throw new Error(t + ': ' + error.message); o.push(...data); if (data.length < 1000) break } return o }

// 匿名キーで imported_sellers が本当に読めないのか、生のHTTPで確認
for (const t of ['imported_sellers', 'profiles', 'menus', 'public_sellers']) {
  const r = await fetch(`${U}/rest/v1/${t}?select=*&limit=1`, { headers: { apikey: K, Authorization: `Bearer ${K}` } })
  console.log(`${t.padEnd(18)} HTTP ${r.status}  ${(await r.text()).slice(0, 120)}`)
}

const REG = ['東京','神奈川','千葉','埼玉','茨城','群馬','栃木','大阪','兵庫','奈良','京都','滋賀','和歌山','愛知','静岡','三重','岐阜','山梨','長野','石川','新潟','富山','福井','岡山','広島','島根','鳥取','山口','愛媛','香川','高知','徳島','福岡','佐賀','長崎','熊本','大分','宮崎','鹿児島','沖縄','北海道','青森','岩手','秋田','宮城','山形','福島']

const s = await all('public_sellers')
const menus = await all('menus', 'id,seller_id,price,photo_url')
const withMenu = new Set(menus.map(m => m.seller_id))
const genresOf = r => { let v = r.genre; if (typeof v === 'string') { try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) } } return (v ?? []).map(x => String(x).trim()).filter(Boolean) }
const untouched = r => genresOf(r).length === 0 && (r.photos ?? []).length === 0 && !withMenu.has(r.id)

// shop_name が「空文字」= 取り込み側の書き方（s.shop || ''）
const shopNull = s.filter(r => r.shop_name === null).length
const shopEmpty = s.filter(r => r.shop_name === '').length
console.log(`\nshop_name: null=${shopNull} 空文字=${shopEmpty} 中身あり=${s.length - shopNull - shopEmpty}`)
console.log(`  空文字のうち untouched: ${s.filter(r => r.shop_name === '' && untouched(r)).length}`)
console.log(`  null   のうち untouched: ${s.filter(r => r.shop_name === null && untouched(r)).length}`)

// エリアの語彙。登録フォームの選択肢に無い値が入っている人＝フォーム以外の経路
const bad = new Map()
let outVocab = 0, outUntouched = 0
for (const r of s) {
  const a = r.areas ?? []
  const ng = a.filter(x => !REG.includes(String(x).trim()))
  if (ng.length) { outVocab++; if (untouched(r)) outUntouched++; for (const x of ng) bad.set(x, (bad.get(x) ?? 0) + 1) }
}
console.log(`\n登録フォームの選択肢に無いエリア値を持つ人: ${outVocab}（うち untouched ${outUntouched}）`)
console.log('  出てきた値（多い順・上位25）:')
;[...bad.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25).forEach(([k, v]) => console.log(`    ${String(v).padStart(4)}  「${k}」`))

// エリア数の分布（フォームは複数選択、CSVは自由記述）
const cnt = {}
for (const r of s) { const n = (r.areas ?? []).length; cnt[n] = (cnt[n] ?? 0) + 1 }
console.log('\nエリア数の分布:', JSON.stringify(cnt))
const cntU = {}, cntT = {}
for (const r of s) { const n = (r.areas ?? []).length; if (untouched(r)) cntU[n] = (cntU[n] ?? 0) + 1; else cntT[n] = (cntT[n] ?? 0) + 1 }
console.log('  untouched(606):', JSON.stringify(cntU))
console.log('  何か埋めた(780):', JSON.stringify(cntT))

// 記事のエリア表を、untouched を除いて出し直すとどうなるか
const areasOf = (arr) => { const o = {}; for (const r of arr) for (const a of (r.areas ?? [])) o[a] = (o[a] ?? 0) + 1; return o }
const A = areasOf(s), B = areasOf(s.filter(r => !untouched(r)))
console.log('\n=== エリア別（全体 → 何か埋めた人だけ） ===')
for (const k of ['東京', '埼玉', '神奈川', '千葉', '茨城', '大阪']) console.log(`  ${k}: ${A[k] ?? 0} → ${B[k] ?? 0}`)

// メニューの内訳（記事: 3,677品 / 価格3,675 / 写真2,818）
console.log(`\nメニュー総数 ${menus.length} / 価格あり ${menus.filter(m => m.price != null).length} / 写真あり ${menus.filter(m => m.photo_url).length}`)
