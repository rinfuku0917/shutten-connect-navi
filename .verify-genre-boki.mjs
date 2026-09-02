// 検証: supermarket-food-truck のジャンル内訳（食事601/スイーツ510/ドリンク476/物販36）
// 指摘者は supabase-js を使った由。こちらは PostgREST を素の fetch で叩き、
// さらにサーバ側 count=exact との突き合わせで二重に確認する。
import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }

async function serverCount(table, qs = '') {
  const r = await fetch(`${URL_}/rest/v1/${table}?select=id${qs ? '&' + qs : ''}`, {
    headers: { ...H, Prefer: 'count=exact', Range: '0-0' }
  })
  if (!r.ok) return { err: `${r.status} ${await r.text()}` }
  return { count: Number((r.headers.get('content-range') || '').split('/')[1]) }
}

async function pageAll(table, select) {
  const out = []
  const STEP = 500 // わざと1000以外にして、打ち切り位置に依存しないことを示す
  for (let from = 0; ; from += STEP) {
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id.asc`, {
      headers: { ...H, Range: `${from}-${from + STEP - 1}` }
    })
    if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
    const d = await r.json()
    out.push(...d)
    if (d.length < STEP) break
  }
  return out
}

// ---------- 1) 母集団の件数 ----------
for (const t of ['public_sellers', 'profiles', 'imported_sellers']) {
  const c = await serverCount(t)
  console.log(`server count ${t}:`, c.count ?? c.err)
}

const rows = await pageAll('public_sellers', 'id,shop_name,genre')
console.log('\npublic_sellers ページングで実取得:', rows.length, '行 / ユニークid', new Set(rows.map(r => r.id)).size)
console.log('（1000行で打ち切った場合の見え方: 1000）')

// ---------- 2) genre の生の形をまず見る ----------
const raw = rows.map(r => r.genre)
const nullish = raw.filter(v => v === null || v === undefined).length
const emptyStr = raw.filter(v => typeof v === 'string' && v.trim() === '').length
const emptyArr = raw.filter(v => typeof v === 'string' && ['[]', '[""]', '["",""]'].includes(v.trim())).length
console.log(`\ngenre 生値: null ${nullish} / 空文字 ${emptyStr} / 空JSON配列 ${emptyArr}`)
console.log('genre の型の内訳:', JSON.stringify(raw.reduce((a, v) => { const k = v === null ? 'null' : (typeof v === 'string' ? (v.trim().startsWith('[') ? 'jsonstr' : 'plain') : typeof v); a[k] = (a[k] || 0) + 1; return a }, {})))

// アプリ本体（app/dashboard/seller/page.tsx の parseGenres）と同じ規則で分解する
function parseGenres(v) {
  const t = (v || '').trim()
  if (!t) return []
  if (t.startsWith('[')) {
    try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean) } catch { /* 旧い自由入力 */ }
  }
  return t.split(/[,、，]/).map(x => x.trim()).filter(Boolean)
}

const tally = new Map()
let withGenre = 0
const perPerson = []
for (const r of rows) {
  const g = [...new Set(parseGenres(r.genre))] // 同一人物の重複選択は1回に潰す
  if (g.length) withGenre++
  perPerson.push(g.length)
  for (const x of g) tally.set(x, (tally.get(x) || 0) + 1)
}
const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1])
console.log('\n=== ジャンル別 人数（public_sellers 全行） ===')
for (const [k, v] of sorted) console.log(`  ${k}: ${v}`)
console.log('のべ選択数の合計:', sorted.reduce((a, [, v]) => a + v, 0))
console.log('ジャンルを1つ以上入れている人:', withGenre, `/ ${rows.length} = ${(withGenre / rows.length * 100).toFixed(1)}%`)
console.log('ジャンル未入力:', rows.length - withGenre)
console.log('1人あたり選択数の分布:', JSON.stringify(perPerson.reduce((a, n) => { a[n] = (a[n] || 0) + 1; return a }, {})))

// ---------- 3) 記事の4つの数字との突き合わせ ----------
const ART = { 食事: 601, スイーツ: 510, ドリンク: 476, 物販: 36 }
console.log('\n=== 記事の数字との一致 ===')
for (const [k, v] of Object.entries(ART)) {
  const mine = tally.get(k) || 0
  console.log(`  ${k}: 記事 ${v} / 実測 ${mine} → ${mine === v ? '一致' : '★不一致'}`)
}
console.log('記事の4つの合計:', Object.values(ART).reduce((a, b) => a + b, 0))
console.log('表から落ちているジャンル:', sorted.filter(([k]) => !(k in ART)).map(([k, v]) => `${k}=${v}`).join(' / ') || 'なし')

// ---------- 4) サーバ側 count で裏取り（別経路） ----------
console.log('\n=== サーバ側 count=exact での裏取り（部分一致） ===')
for (const g of ['食事', 'スイーツ', 'ドリンク', '物販', 'サービス', 'キッチンカー', '菓子']) {
  const c = await serverCount('public_sellers', `genre=like.*${encodeURIComponent(g)}*`)
  console.log(`  genre like *${g}*: ${c.count ?? c.err}`)
}
const notNull = await serverCount('public_sellers', 'genre=not.is.null')
const notEmpty = await serverCount('public_sellers', 'genre=not.is.null&genre=neq.')
console.log(`  genre not null: ${notNull.count ?? notNull.err}`)
console.log(`  genre not null かつ空文字でない: ${notEmpty.count ?? notEmpty.err}`)
const hasBracket = await serverCount('public_sellers', 'genre=like.*%5B*')
console.log(`  genre に "[" を含む: ${hasBracket.count ?? hasBracket.err}`)

// ---------- 5) 公開ページ /sellers が出す母数（除外2社） ----------
const EXCLUDED = ['株式会社nav', '株式会社アーク']
const shown = rows.filter(r => !EXCLUDED.includes((r.shop_name ?? '').trim()))
console.log(`\n/sellers 表示相当（除外2社を引く）: ${shown.length}`)
const tally2 = new Map()
let withGenre2 = 0
for (const r of shown) {
  const g = [...new Set(parseGenres(r.genre))]
  if (g.length) withGenre2++
  for (const x of g) tally2.set(x, (tally2.get(x) || 0) + 1)
}
console.log('  除外後のジャンル内訳:', [...tally2.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${v}`).join(' / '))
console.log('  除外後にジャンルを入れている人:', withGenre2)
