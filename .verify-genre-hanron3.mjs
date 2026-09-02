import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
async function all(t, sel) {
  const out = []; const step = 500
  for (let f = 0; ; f += step) {
    const r = await fetch(`${U}/rest/v1/${t}?select=${encodeURIComponent(sel)}&order=id.asc`,
      { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${f}-${f + step - 1}` } })
    if (!r.ok) throw new Error(`${t} ${r.status} ${await r.text()}`); const rows = await r.json(); out.push(...rows)
    if (rows.length < step) break
  } return out
}
const toList = v => { if (v == null) return []; if (Array.isArray(v)) return v.map(String)
  const t = String(v).trim(); if (t === '') return []
  if (t.startsWith('[')) { try { const p = JSON.parse(t); return Array.isArray(p) ? p.map(String) : [String(p)] } catch { return [] } } return [t] }

const s = await all('public_sellers', 'id,name,shop_name,genre,areas,photos,role,approval_status')

const dist = (k) => { const o = {}; for (const x of s) { const v = String(x[k]) ; o[v] = (o[v]||0)+1 } return o }
console.log('role の分布:', dist('role'))
console.log('approval_status の分布:', dist('approval_status'))

const tally = rows => { const o = {}; for (const x of rows) for (const g of new Set(toList(x.genre).map(v=>v.trim()).filter(Boolean))) o[g]=(o[g]||0)+1; return o }
const target = { 食事: 600, スイーツ: 509, ドリンク: 475, 物販: 36 }
const match = o => Object.entries(target).every(([g,n]) => (o[g]||0) === n)

const filters = {
  '全件': () => true,
  'role=seller': x => x.role === 'seller',
  'approval_status=approved': x => x.approval_status === 'approved',
  'shop_name あり': x => x.shop_name && String(x.shop_name).trim() !== '',
  'shop_name なし': x => !x.shop_name || String(x.shop_name).trim() === '',
  '写真あり': x => Array.isArray(x.photos) ? x.photos.length>0 : toList(x.photos).length>0,
  'areas あり': x => toList(x.areas).length > 0,
}
console.log('\n=== フィルタ別のジャンル集計（記事の 600/509/475/36 と一致するか） ===')
for (const [label, fn] of Object.entries(filters)) {
  const rows = s.filter(fn); const o = tally(rows)
  console.log(`  ${label} (n=${rows.length}): 食事=${o['食事']||0} スイーツ=${o['スイーツ']||0} ドリンク=${o['ドリンク']||0} 物販=${o['物販']||0} ${match(o)?'★一致':''}`)
}

// 記事の数になるには「食事・スイーツ・ドリンクの3つ全部を持つ店を1件だけ」除けばよい。
// そんな1件を除外して物販が36のまま＝物販を持たない店。該当する店を列挙して素性を見る。
const three = ['食事','スイーツ','ドリンク']
const cand = s.filter(x => { const g = new Set(toList(x.genre).map(v=>v.trim())); return three.every(t=>g.has(t)) && !g.has('物販') })
console.log('\n=== 食事・スイーツ・ドリンクを持ち物販を持たない店:', cand.length, '件（このうち1件を除くと記事の数になる） ===')
console.log('   うち shop_name 空:', cand.filter(x=>!x.shop_name||String(x.shop_name).trim()==='').length)
console.log('   うち approval_status:', JSON.stringify(cand.reduce((o,x)=>{o[String(x.approval_status)]=(o[String(x.approval_status)]||0)+1;return o},{})))

// 「サービス」「菓子・スイーツ」「キッチンカー」の店を全部出す
console.log('\n=== 表に載っていないジャンルの店（全件） ===')
for (const x of s) {
  const g = toList(x.genre).map(v=>v.trim())
  if (g.some(v => ['サービス','菓子・スイーツ','キッチンカー'].includes(v)))
    console.log('   ', JSON.stringify({ shop: x.shop_name, name: x.name, genre: x.genre, approval: x.approval_status }))
}

// 表外ジャンルの店が「4分類のどれか」も同時に持っているか
const outside = s.filter(x => toList(x.genre).map(v=>v.trim()).some(v=>['サービス','菓子・スイーツ','キッチンカー'].includes(v)))
const onlyOutside = outside.filter(x => !toList(x.genre).map(v=>v.trim()).some(v=>['食事','スイーツ','ドリンク','物販'].includes(v)))
console.log('\n表外ジャンルを持つ店:', outside.length, '/ そのうち4分類を一切持たない店:', onlyOutside.length)
