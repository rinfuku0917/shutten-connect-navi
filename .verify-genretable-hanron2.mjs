// 反証用 その2: スーパー35件の特定方法と、相性表に使える列があるかを確かめる
import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] }))
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const H = { apikey: K, Authorization: `Bearer ${K}` }

async function fetchAll(table, select) {
  const out = []; const step = 500; let total = null
  for (let from = 0; ; from += step) {
    const r = await fetch(`${U}/rest/v1/${table}?select=${encodeURIComponent(select)}&order=id.asc`,
      { headers: { ...H, Range: `${from}-${from + step - 1}`, Prefer: 'count=exact' } })
    const rows = await r.json(); out.push(...rows)
    total = (r.headers.get('content-range') || '').split('/')[1]
    if (rows.length < step) break
  }
  console.log(`[${table}] 行数=${out.length}/総数=${total}`)
  if (Number(total) !== out.length) throw new Error('ページング漏れ')
  return out
}
const toArr = v => Array.isArray(v) ? v.map(String) : []

const places = await fetchAll('places', 'id,title,description,details,recruit,place_type,status,closed,genres,prefecture,price_fixed,price_share_pct,day_type_fees')
const pub = places.filter(p => p.status === 'published' && !p.closed)
console.log('公開中:', pub.length)

// スーパーらしき案件を「タイトル＋説明」の語で拾う（記事の35件の再現を試みる）
const kw = /スーパー|マーケット|食品館|生鮮|マート|ストア/
const sup = pub.filter(p => kw.test(`${p.title || ''}`))
console.log('\n=== タイトルにスーパー系の語を含む公開中案件:', sup.length, '件 ===')
const byTitle = {}
for (const p of sup) { const k = (p.title || '').replace(/[0-9０-９\s]+.*$/, '').slice(0, 14); byTitle[k] = (byTitle[k] || 0) + 1 }
console.log(JSON.stringify(byTitle, null, 1))
console.log('うち genres 入り:', sup.filter(p => toArr(p.genres).length > 0).length,
  '/ genres に スーパーマーケット:', sup.filter(p => toArr(p.genres).includes('スーパーマーケット')).length)

// 案件本文に「売ってほしいジャンル」の指定があるか（クレープ等の語）
const fine = ['クレープ','ドーナツ','たい焼き','コーヒー','タピオカ','ジュース','ケバブ','ホットドッグ','弁当','唐揚げ','焼き鳥','パン','惣菜','ベーカリー']
console.log('\n=== 公開中110件の本文（title+description+details+recruit）に出る語 ===')
for (const w of fine) {
  const n = pub.filter(p => `${p.title||''}${p.description||''}${JSON.stringify(p.details||'')}${p.recruit||''}`.includes(w)).length
  console.log(`  ${w}: ${n}件`)
}

// 出店者側: ジャンル未設定を除いた実質母数
const sellers = await fetchAll('public_sellers', 'id,genre')
const has = sellers.filter(s => {
  const v = s.genre; if (v == null) return false
  const t = String(v).trim(); return t !== '' && t !== '[]'
})
console.log('\n=== public_sellers 総数:', sellers.length, '/ genre が入っている:', has.length)
