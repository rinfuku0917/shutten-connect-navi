import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 全カラムを取る（既存スクリプトはカラムを絞っていた。取りこぼしが無いか確かめる）
let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) { console.error('ERR', error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 500) break
}
console.log('全行:', all.length)
console.log('カラム一覧:', Object.keys(all[0]).join(', '))

const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('公開中:', pub.length)

// ---------- 1. 地域猫マルシェ を特定 ----------
const hits = pub.filter(p => (p.title || '').includes('地域猫') || (p.title || '').includes('マルシェ'))
console.log('\n===== タイトルに「地域猫」or「マルシェ」を含む公開案件 =====')
for (const p of hits) console.log(' -', p.id, '|', p.title)

const neko = pub.find(p => (p.title || '').includes('地域猫'))
console.log('\n===== 地域猫案件の全フィールド =====')
if (!neko) { console.log('見つからない') } else {
  for (const [k, v] of Object.entries(neko)) {
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v)
    if (v === null || v === '' ) continue
    console.log(`【${k}】 ${s}`)
  }
}

// ---------- 2. 記事の集計ロジックを自分で組み直して平日額を出す ----------
const fixedOf = p => (p.price_fixed || 0) + (p.company_fixed_amount || 0)
const pctOf = p => (p.price_share_pct || 0) + (p.company_share_pct || 0)
const side = (p, k) => {
  const d = (p.day_type_fees && typeof p.day_type_fees === 'object') ? p.day_type_fees : null
  if (!d || !d[k]) return null
  const a = typeof d[k].placeFee === 'number' ? d[k].placeFee : null
  const b = typeof d[k].companyFee === 'number' ? d[k].companyFee : null
  if (a === null && b === null) return null
  return (a || 0) + (b || 0)
}
const weekdayAmt = p => { const s = side(p, 'weekday'); if (s !== null) return s; const f = fixedOf(p); return f > 0 ? f : null }

const wdRows = pub.map(p => ({ p, amt: weekdayAmt(p) })).filter(r => r.amt !== null)
console.log('\n===== 平日額を持つ案件（自前再集計） =====')
console.log('件数:', wdRows.length)
const dist = {}
for (const r of wdRows) dist[r.amt] = (dist[r.amt] || 0) + 1
console.log('分布:', Object.entries(dist).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}円:${v}件`).join('  '))
const med = a => { const s=[...a].sort((x,y)=>x-y); const n=s.length; return n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2 }
console.log('中央値:', med(wdRows.map(r=>r.amt)), '最低:', Math.min(...wdRows.map(r=>r.amt)), '最高:', Math.max(...wdRows.map(r=>r.amt)))

console.log('\n===== 平日 5,000円 の案件を全部並べる =====')
const f5 = wdRows.filter(r => r.amt === 5000)
console.log('件数:', f5.length)
f5.forEach((r, i) => {
  console.log(`${String(i+1).padStart(2)}. ${r.p.title}`)
  console.log(`     price_fixed=${r.p.price_fixed} company_fixed_amount=${r.p.company_fixed_amount} day_type_fees=${JSON.stringify(r.p.day_type_fees)}`)
  console.log(`     fee=${JSON.stringify(r.p.fee)}`)
})

// ---------- 3. 地域猫を除いた場合 ----------
if (neko) {
  const wo = wdRows.filter(r => r.p.id !== neko.id)
  console.log('\n===== 地域猫を除いた平日集計 =====')
  console.log('件数:', wo.length, '/ 5,000円:', wo.filter(r=>r.amt===5000).length, '/ 中央値:', med(wo.map(r=>r.amt)))
  console.log('地域猫は平日集計に入っているか:', wdRows.some(r => r.p.id === neko.id), '/ その額:', weekdayAmt(neko))
}

// ---------- 4. キッチンカー以外の業態が他にも混じっていないか（反証の試み） ----------
console.log('\n===== 平日額を持つ案件のうち、fee/description/recruit に「キッチンカー」「移動販売」が一度も出てこないもの =====')
const kw = /キッチンカー|移動販売|フードトラック|ケータリングカー/
const noKC = wdRows.filter(r => {
  const blob = [r.p.title, r.p.fee, r.p.description, r.p.recruit, r.p.place_type, r.p.notes, r.p.conditions].filter(Boolean).join(' / ')
  return !kw.test(blob)
})
console.log('件数:', noKC.length)
for (const r of noKC) {
  console.log(` - ${r.p.title} | 平日額=${r.amt} | place_type=${r.p.place_type}`)
  console.log(`     fee=${JSON.stringify(r.p.fee)}`)
  console.log(`     desc=${JSON.stringify((r.p.description||'').slice(0,200))}`)
  console.log(`     recruit=${JSON.stringify(r.p.recruit)}`)
}
