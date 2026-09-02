// 反証用: get-food-truck-offers のジャンル表を独自に検証する
// 方法は指摘者と変える: supabase-js のフィルタ(.contains/.eq)を使わず、
// PostgREST に生 HTTP で当てて、genre の「素の値」をそのまま見る。
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function fetchAll(table, select) {
  const out = []
  const step = 500
  for (let from = 0; ; from += step) {
    const to = from + step - 1
    const r = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id.asc`, {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${to}`, Prefer: 'count=exact' },
    })
    if (!r.ok) throw new Error(`${table} ${r.status} ${await r.text()}`)
    const rows = await r.json()
    out.push(...rows)
    const cr = r.headers.get('content-range') // e.g. "0-499/1386"
    if (rows.length < step) { console.log(`[${table}] content-range=${cr}`); break }
  }
  return out
}

const sellers = await fetchAll('public_sellers', 'id,shop_name,name,genre')
console.log('=== public_sellers 総行数:', sellers.length)

// --- 1. genre の素の型を数える（パースしない） ---
const rawKind = {}
for (const s of sellers) {
  const v = s.genre
  const k = v === null ? 'null'
    : Array.isArray(v) ? 'JS配列(=jsonb/text[]として返っている)'
    : typeof v === 'string' ? (v.trim() === '' ? '空文字'
        : (v.trim().startsWith('[') ? 'JSON配列っぽい文字列' : '素の文字列(JSONでない)'))
    : typeof v
  rawKind[k] = (rawKind[k] || 0) + 1
}
console.log('=== genre の素の型 ===')
console.log(rawKind)

// 素の文字列（＝JSONとして壊れている候補）を全部出す
const rawBare = sellers.filter(s => typeof s.genre === 'string' && s.genre.trim() !== '' && !s.genre.trim().startsWith('['))
console.log('=== JSONでない素の文字列の行（全件） ===')
for (const s of rawBare) console.log('  ', JSON.stringify({ id: s.id, shop: s.shop_name, genre: s.genre }))

// --- 2. パースして正規化 ---
function toList(v) {
  if (v == null) return []
  if (Array.isArray(v)) return v.map(String)
  if (typeof v === 'string') {
    const t = v.trim()
    if (t === '') return []
    if (t.startsWith('[')) {
      try { const p = JSON.parse(t); return Array.isArray(p) ? p.map(String) : [String(p)] }
      catch { return ['<<JSONパース失敗:' + t + '>>'] }
    }
    return [t]
  }
  return [String(v)]
}

const naive = {}   // 延べ（重複そのまま）
const perShop = {} // 店ごとに重複排除
let picksTotal = 0
let emptyShops = 0
const dupInside = []
for (const s of sellers) {
  const list = toList(s.genre).map(x => x.trim()).filter(x => x !== '')
  if (list.length === 0) { emptyShops++; continue }
  picksTotal += list.length
  for (const g of list) naive[g] = (naive[g] || 0) + 1
  const uniq = new Set(list)
  if (uniq.size !== list.length) dupInside.push({ id: s.id, genre: list })
  for (const g of uniq) perShop[g] = (perShop[g] || 0) + 1
}

console.log('\n=== ジャンル未設定（null/空/空配列）の店:', emptyShops)
console.log('=== 延べピック数(重複込み):', picksTotal)
console.log('=== 店ごと重複排除の合計:', Object.values(perShop).reduce((a, b) => a + b, 0))
console.log('=== 同一店の配列内に重複がある件数:', dupInside.length, JSON.stringify(dupInside.slice(0, 5)))

const sortRows = o => Object.entries(o).sort((a, b) => b[1] - a[1])
console.log('\n=== ジャンル別（延べ） ===')
for (const [g, n] of sortRows(naive)) console.log(`  ${g}\t${n}`)
console.log('\n=== ジャンル別（店ごと重複排除） ===')
for (const [g, n] of sortRows(perShop)) console.log(`  ${g}\t${n}`)

// --- 3. 記事の表と突き合わせ ---
const article = { 食事: 600, スイーツ: 509, ドリンク: 475, 物販: 36 }
console.log('\n=== 記事の表 vs 実データ ===')
let artSum = 0
for (const [g, n] of Object.entries(article)) {
  artSum += n
  console.log(`  ${g}: 記事=${n} / 延べ=${naive[g] ?? 0} / 重複排除=${perShop[g] ?? 0}  ${(naive[g] ?? 0) === n ? 'OK' : '★不一致'}`)
}
console.log('  記事の表の4行合計 =', artSum, '（本文の総店舗数1,386より', artSum - 1386, '多い）')
const notInArticle = sortRows(naive).filter(([g]) => !(g in article))
console.log('  記事の表に載っていないジャンル:', JSON.stringify(notInArticle))
console.log('  表外ジャンルの延べ合計:', notInArticle.reduce((a, b) => a + b[1], 0))
console.log('  全ジャンルの延べ合計:', picksTotal)

// --- 4. 本文「食事とスイーツで1,100店を超えます」の検証 ---
const setHas = (s, g) => toList(s.genre).map(x => x.trim()).includes(g)
const meal = sellers.filter(s => setHas(s, '食事'))
const sweet = sellers.filter(s => setHas(s, 'スイーツ'))
const either = sellers.filter(s => setHas(s, '食事') || setHas(s, 'スイーツ'))
const both = sellers.filter(s => setHas(s, '食事') && setHas(s, 'スイーツ'))
console.log('\n=== 本文「食事とスイーツで1,100店を超えます」 ===')
console.log('  食事:', meal.length, '/ スイーツ:', sweet.length, '/ 単純合計:', meal.length + sweet.length)
console.log('  実際の実店舗数（食事 or スイーツ の重複排除）:', either.length)
console.log('  両方を選んでいる店:', both.length)
console.log('  → 1,100を超えているか:', either.length > 1100 ? 'YES' : 'NO（★本文は誤り）')

// --- 5. 「登録1,386店舗」の裏取り ---
console.log('\n=== 総店舗数 ===')
console.log('  public_sellers 行数:', sellers.length, '/ 記事の主張: 1,386', sellers.length === 1386 ? 'OK' : '★不一致')
console.log('  ジャンルを1つ以上入れている店:', sellers.length - emptyShops)
