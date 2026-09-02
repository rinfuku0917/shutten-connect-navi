import { readFileSync } from 'node:fs'
const env = Object.fromEntries(
  readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local', 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL, KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` }
async function pageAll(select) {
  const out = []; const STEP = 500
  for (let f = 0; ; f += STEP) {
    const r = await fetch(`${URL_}/rest/v1/public_sellers?select=${encodeURIComponent(select)}&order=id.asc`, { headers: { ...H, Range: `${f}-${f + STEP - 1}` } })
    const d = await r.json(); out.push(...d); if (d.length < STEP) break
  }
  return out
}
const rows = await pageAll('id,shop_name,genre')

// 「スイーツ」を含む生値の全パターンを直接見る（サーバ側 like と自前集計のズレを潰す）
const pat = new Map()
for (const r of rows) if ((r.genre || '').includes('スイーツ')) pat.set(r.genre, (pat.get(r.genre) || 0) + 1)
console.log('=== genre 生値に「スイーツ」を含むパターン（上位20） ===')
console.log('  異なりパターン数:', pat.size, '/ 行数合計:', [...pat.values()].reduce((a, b) => a + b, 0))
for (const [k, v] of [...pat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20)) console.log(`  ${v.toString().padStart(4)}  ${k}`)

// JSON配列でない行、正規の5分類に無い値を全部出す
const VALID = ['食事', 'スイーツ', 'ドリンク', '物販', 'サービス']
console.log('\n=== JSON配列でない genre（旧い自由入力） ===')
for (const r of rows) {
  const t = (r.genre || '').trim()
  if (t && !t.startsWith('[')) console.log(`  ${r.shop_name} : ${JSON.stringify(r.genre)}`)
}
console.log('\n=== 正規5分類に無いトークンを持つ行 ===')
for (const r of rows) {
  const t = (r.genre || '').trim(); if (!t) continue
  let g = []
  if (t.startsWith('[')) { try { g = JSON.parse(t) } catch { g = [t] } } else g = t.split(/[,、，]/)
  const bad = g.map(x => String(x).trim()).filter(x => x && !VALID.includes(x))
  if (bad.length) console.log(`  ${r.shop_name} : ${JSON.stringify(r.genre)}`)
}

// 記事4分類のどれにも当てはまらない人（＝表から漏れる人）は何人か
let onlyOutside = 0, none = 0
const FOUR = ['食事', 'スイーツ', 'ドリンク', '物販']
for (const r of rows) {
  const t = (r.genre || '').trim()
  let g = []
  if (t.startsWith('[')) { try { g = JSON.parse(t) } catch { g = [t] } } else if (t) g = t.split(/[,、，]/)
  g = g.map(x => String(x).trim()).filter(Boolean)
  if (!g.length) { none++; continue }
  if (!g.some(x => FOUR.includes(x))) onlyOutside++
}
console.log(`\nジャンル未入力: ${none} 人`)
console.log(`ジャンルは入れているが、記事の4分類に1つも当てはまらない人: ${onlyOutside} 人`)
