import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('places').select('*').range(from, from + 499)
  if (error) { console.error('ERR', error); process.exit(1) }
  all = all.concat(data); if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)

const yen = s => {
  const out = []
  const re = /([0-9][0-9,]*)\s*円/g
  let m
  while ((m = re.exec(s))) out.push(Number(m[1].replace(/,/g, '')))
  return out
}
const fixedOf = p => (p.price_fixed || 0) + (p.company_fixed_amount || 0)
const side = (p, k) => {
  const d = (p.day_type_fees && typeof p.day_type_fees === 'object') ? p.day_type_fees : null
  if (!d || !d[k]) return null
  const a = typeof d[k].placeFee === 'number' ? d[k].placeFee : null
  const b = typeof d[k].companyFee === 'number' ? d[k].companyFee : null
  if (a === null && b === null) return null
  return (a || 0) + (b || 0)
}

// 平日額の推定：day_type_fees.weekday → 構造化固定額 → fee本文の最初の金額
function weekdayGuess(p) {
  const s = side(p, 'weekday'); if (s !== null) return { amt: s, src: 'day_type_fees' }
  const f = fixedOf(p); if (f > 0) return { amt: f, src: 'structured' }
  const ys = yen(p.fee || '')
  if (ys.length) return { amt: ys[0], src: 'fee_text' }
  return null
}
const rows = pub.map(p => ({ p, ...(weekdayGuess(p) || {}) })).filter(r => r.amt != null)
console.log('平日額あり（fee本文フォールバック込み）:', rows.length, '件')
const dist = {}; for (const r of rows) dist[r.amt] = (dist[r.amt] || 0) + 1
console.log('分布:', Object.entries(dist).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${k}:${v}`).join(' '))
const bySrc = {}; for (const r of rows) bySrc[r.src] = (bySrc[r.src]||0)+1
console.log('出どころ:', bySrc)

const five = rows.filter(r => r.amt === 5000)
console.log('\n===== 平日5,000円に数えられた案件', five.length, '件 =====')
five.forEach((r,i)=>{
  const blob = [r.p.title, r.p.fee, r.p.description, r.p.recruit].filter(Boolean).join(' ')
  const kc = /キッチンカー|移動販売|フードトラック/.test(blob)
  console.log(`${String(i+1).padStart(2)}. [${r.src}] ${kc?'KC言及あり':'★KC言及なし'} ${r.p.title} (${r.p.prefecture}/${r.p.place_type})`)
  console.log(`     fee=${JSON.stringify(r.p.fee)}`)
})

// 地域猫の位置づけ
const neko = pub.find(p => (p.title||'').includes('地域猫'))
const nr = rows.find(r => r.p.id === neko.id)
console.log('\n===== 地域猫マルシェ =====')
console.log('平日集計に入る？', !!nr, nr ? `額=${nr.amt} 出どころ=${nr.src}` : '')
console.log('fee内の金額すべて:', yen(neko.fee).join(', '))
console.log('recruit:', JSON.stringify(neko.recruit))
console.log('description全文:', neko.description)
console.log('本文にキッチンカー言及:', /キッチンカー|移動販売|フードトラック/.test([neko.title,neko.fee,neko.description,neko.recruit].filter(Boolean).join(' ')))

const med = a => { const s=[...a].sort((x,y)=>x-y); const n=s.length; return n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2 }
const wo = rows.filter(r => r.p.id !== neko.id)
console.log('\n地域猫を除くと: 件数', wo.length, '/ 5000円', wo.filter(r=>r.amt===5000).length, '/ 中央値', med(wo.map(r=>r.amt)))
console.log('地域猫を含むと: 件数', rows.length, '/ 5000円', rows.filter(r=>r.amt===5000).length, '/ 中央値', med(rows.map(r=>r.amt)))

// event 種別のうち固定額として拾われているもの（反証の試み：他にも同種が居ないか）
console.log('\n===== place_type=event なのに固定額として数えられた案件 =====')
for (const r of rows.filter(r => r.p.place_type === 'event')) {
  console.log(` - ${r.p.title} | 額=${r.amt} [${r.src}] | fee=${JSON.stringify(r.p.fee)}`)
}

// キッチンカー言及なしの案件を全部
console.log('\n===== 平日集計対象のうち KC 言及が一度も無いもの =====')
for (const r of rows) {
  const blob = [r.p.title, r.p.fee, r.p.description, r.p.recruit, r.p.details].filter(Boolean).join(' ')
  if (!/キッチンカー|移動販売|フードトラック|ケータリングカー/.test(blob))
    console.log(` - ${r.p.title} | 額=${r.amt} [${r.src}] | type=${r.p.place_type} | fee=${JSON.stringify(r.p.fee)}`)
}
