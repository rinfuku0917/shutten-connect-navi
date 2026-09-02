// 反証用: supermarket-food-truck「何を売る車を入れるか」の相性表を検証する。
// 指摘者と方法を変える: supabase-js を使わず PostgREST に生HTTP。
// Range ヘッダで必ずページングし、content-range の総数と自分で集めた行数を突き合わせる。
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => {
      const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H = { apikey: K, Authorization: `Bearer ${K}` }

async function fetchAll(table, select, qs = '') {
  const out = []; const step = 500; let total = null
  for (let from = 0; ; from += step) {
    const r = await fetch(`${U}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id.asc${qs}`,
      { headers: { ...H, Range: `${from}-${from + step - 1}`, Prefer: 'count=exact' } })
    if (!r.ok) throw new Error(`${table} ${r.status} ${await r.text()}`)
    const rows = await r.json(); out.push(...rows)
    total = (r.headers.get('content-range') || '').split('/')[1]
    if (rows.length < step) break
  }
  console.log(`[${table}${qs}] 集めた行数=${out.length} / サーバ申告の総数=${total}`)
  if (total !== '*' && Number(total) !== out.length) throw new Error('!!! ページング漏れ')
  return out
}

const toArr = v => {
  if (v == null) return []
  if (Array.isArray(v)) return v.map(x => String(x).trim()).filter(Boolean)
  const t = String(v).trim(); if (!t) return []
  if (t.startsWith('[')) { try { const j = JSON.parse(t); if (Array.isArray(j)) return j.map(x => String(x).trim()).filter(Boolean) } catch {} }
  return t.split(/[,、，]/).map(x => x.trim()).filter(Boolean)
}

// ============ 1. 出店者のジャンル区分は本当に4〜5種類しかないか ============
const sellers = await fetchAll('public_sellers', 'id,shop_name,genre')
const gc = {}
for (const s of sellers) for (const g of toArr(s.genre)) gc[g] = (gc[g] || 0) + 1
console.log('\n=== public_sellers の genre 実値（出現順に全部） ===')
console.log('異なり数:', Object.keys(gc).length)
for (const [g, n] of Object.entries(gc).sort((a, b) => b[1] - a[1])) console.log(`  ${g}: ${n}`)
const none = sellers.filter(s => toArr(s.genre).length === 0).length
console.log('ジャンル未設定:', none)

// 記事本文の数値と突き合わせ
console.log('\n記事:食事601/スイーツ510/ドリンク476/物販36 ← 実測:',
  ['食事','スイーツ','ドリンク','物販'].map(g => `${g}=${gc[g] || 0}`).join(' / '))

// ============ 2. 細かい粒度（クレープ・弁当・パン等）はどこかに存在するか ============
const fine = ['クレープ','ドーナツ','たい焼き','コーヒー','タピオカ','ジュース','ケバブ','ホットドッグ','弁当','唐揚げ','焼き鳥','パン']
console.log('\n=== 細かい粒度の語が genre 値として存在するか ===')
for (const w of fine) {
  const asGenre = Object.keys(gc).filter(g => g.includes(w))
  console.log(`  ${w}: genre値としての出現=${asGenre.length ? asGenre.join('|') : 'なし'}`)
}
// 参考: 屋号に含まれる数（＝ジャンル区分ではないので集計には使えない）
console.log('（参考）屋号に含む店数:', fine.map(w =>
  `${w}=${sellers.filter(s => (s.shop_name || '').includes(w)).length}`).join(' '))

// ============ 3. 公開中の案件と places.genres ============
const places = await fetchAll('places', 'id,title,place_type,status,closed,genres,prefecture')
const pub = places.filter(p => p.status === 'published' && !p.closed)
console.log('\n=== places 全体:', places.length, '/ 公開中(published かつ closed でない):', pub.length)

const ptc = {}
for (const p of pub) ptc[p.place_type || '(空)'] = (ptc[p.place_type || '(空)'] || 0) + 1
console.log('公開中の place_type 内訳:', JSON.stringify(ptc, null, 1))

const sup = pub.filter(p => (p.place_type || '').includes('スーパー'))
console.log('スーパー・食品店:', sup.length)

const withG = pub.filter(p => toArr(p.genres).length > 0)
console.log('\npublic中 genres が入っている案件:', withG.length, '/', pub.length)
const supG = sup.filter(p => toArr(p.genres).length > 0)
console.log('スーパー35件のうち genres 入り:', supG.length)
const pgv = {}
for (const p of withG) for (const g of toArr(p.genres)) pgv[g] = (pgv[g] || 0) + 1
console.log('places.genres の実値:', JSON.stringify(pgv))

// ============ 4. 案件側に「売ってほしいジャンル」を持つ列があるか ============
const one = await fetch(`${U}/rest/v1/places?select=*&limit=1`, { headers: H }).then(r => r.json())
console.log('\n=== places の列名一覧 ===')
console.log(Object.keys(one[0] || {}).join(', '))
const s1 = await fetch(`${U}/rest/v1/public_sellers?select=*&limit=1`, { headers: H }).then(r => r.json())
console.log('\n=== public_sellers の列名一覧 ===')
console.log(Object.keys(s1[0] || {}).join(', '))

// ============ 5. 読めないテーブルの確認 ============
for (const t of ['applications', 'seller_documents']) {
  const r = await fetch(`${U}/rest/v1/${t}?select=id&limit=1`, { headers: H })
  console.log(`\n${t}: HTTP ${r.status} ${r.ok ? JSON.stringify(await r.json()) : (await r.text()).slice(0, 120)}`)
}
