import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

async function all(table, select) {
  const out = []; const step = 500
  for (let f = 0; ; f += step) {
    const r = await fetch(`${U}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id.asc`,
      { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: `${f}-${f + step - 1}` } })
    if (!r.ok) throw new Error(`${table} ${r.status} ${await r.text()}`)
    const rows = await r.json(); out.push(...rows)
    if (rows.length < step) break
  }
  return out
}

// 1行だけ取って列名を見る
const one = await fetch(`${U}/rest/v1/public_sellers?select=*&limit=1`, { headers: { apikey: K, Authorization: `Bearer ${K}` } }).then(r => r.json())
console.log('=== public_sellers の列 ===')
console.log(Object.keys(one[0]).join(', '))

const cols = Object.keys(one[0]).join(',')
const s = await all('public_sellers', cols)
console.log('\n総数:', s.length)

const toList = v => {
  if (v == null) return []
  if (Array.isArray(v)) return v.map(String)
  const t = String(v).trim()
  if (t === '') return []
  if (t.startsWith('[')) { try { const p = JSON.parse(t); return Array.isArray(p) ? p.map(String) : [String(p)] } catch { return [] } }
  return [t]
}

// 空配列 '[]' が何件あるか
const emptyArr = s.filter(x => typeof x.genre === 'string' && x.genre.trim() === '[]').length
const nulls = s.filter(x => x.genre === null).length
console.log('genre が null:', nulls, ' / genre が "[]":', emptyArr, ' / 合計未設定:', nulls + emptyArr)

// 記事の 600/509/475 と自分の 601/510/476 の差 +1 の犯人を探す
const three = ['食事', 'スイーツ', 'ドリンク']
const hasAll3 = s.filter(x => three.every(g => toList(x.genre).includes(g)))
console.log('\n食事+スイーツ+ドリンクを全部選んでいる店:', hasAll3.length)

// 日付列があれば、新しい順に見る
const dateCols = Object.keys(one[0]).filter(k => /(created|updated|_at)$/.test(k))
console.log('日付っぽい列:', dateCols.join(', ') || 'なし')
for (const dc of dateCols) {
  const sorted = [...s].filter(x => x[dc]).sort((a, b) => String(b[dc]).localeCompare(String(a[dc])))
  console.log(`\n--- ${dc} が新しい順 上位8件 ---`)
  for (const x of sorted.slice(0, 8)) {
    console.log('   ', x[dc], '|', JSON.stringify(x.shop_name), '| genre=', JSON.stringify(x.genre))
  }
  // 直近の1件が3ジャンル持ちか
  const newest = sorted[0]
  if (newest) console.log('   最新の1件のジャンル:', JSON.stringify(toList(newest.genre)))
}

// 各ジャンルについて「その1件を除くと記事の数になる」候補を探す
// = updated/created が最も新しい、食事・スイーツ・ドリンクの3つを持つ店
if (dateCols.length) {
  const dc = dateCols[0]
  const cand = hasAll3.filter(x => x[dc]).sort((a, b) => String(b[dc]).localeCompare(String(a[dc])))
  console.log('\n=== 3ジャンル持ちを' + dc + '新しい順に上位5 ===')
  for (const x of cand.slice(0, 5)) console.log('   ', x[dc], '|', JSON.stringify(x.shop_name), '|', JSON.stringify(toList(x.genre)))
}
