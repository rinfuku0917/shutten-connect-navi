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
  const { data } = await sb.from('places').select('*').range(from, from + 499)
  all = all.concat(data); if (data.length < 500) break
}
const pub = all.filter(p => p.status === 'published' && !p.closed)

const side = (p, k) => {
  const d = (p.day_type_fees && typeof p.day_type_fees === 'object') ? p.day_type_fees : null
  if (!d || !d[k]) return null
  const a = typeof d[k].placeFee === 'number' ? d[k].placeFee : null
  const b = typeof d[k].companyFee === 'number' ? d[k].companyFee : null
  if (a === null && b === null) return null
  return (a || 0) + (b || 0)
}
const fixedOf = p => (p.price_fixed || 0) + (p.company_fixed_amount || 0)
const yen = s => [...String(s||'').matchAll(/([0-9][0-9,]*)\s*円/g)].map(m => Number(m[1].replace(/,/g,'')))

// 記事の数字（平日59件/中央値5000/最低2000/最高8000, 3000が22件, 5000が20件）を再現する読み方：
//  ・「売上の◯％、上限N円」は歩合の上限なので固定額として数えない
//  ・「朝3時間550円 / 一日利用2500円~」は1日あたりの額(2500)を採る
function weekdayAmt(p) {
  const s = side(p, 'weekday'); if (s !== null) return s
  const f = fixedOf(p); if (f > 0) return f
  const t = String(p.fee || '')
  if (/上限/.test(t)) return null                       // 歩合の上限額は固定額ではない
  const dayMatch = t.match(/一日利用\s*([0-9][0-9,]*)\s*円/)
  if (dayMatch) return Number(dayMatch[1].replace(/,/g,''))
  const ys = yen(t); return ys.length ? ys[0] : null
}
function weekendAmt(p) {
  const s = side(p, 'weekend'); if (s !== null) return s
  const t = String(p.fee || '')
  const m = t.match(/(?:土日祝?|休日|週末)[^0-9]{0,6}([0-9][0-9,]*)\s*円/)
  if (m) return Number(m[1].replace(/,/g,''))
  if (/平日\s*\/\s*週末|平日・週末/.test(t)) { const ys = yen(t); return ys.length ? ys[0] : null }
  return null
}
const med = a => { const s=[...a].sort((x,y)=>x-y); const n=s.length; return n%2? s[(n-1)/2] : (s[n/2-1]+s[n/2])/2 }
const show = (label, rows) => {
  const v = rows.map(r=>r.amt)
  const d = {}; for (const x of v) d[x]=(d[x]||0)+1
  console.log(`${label}: 件数=${v.length} 中央値=${med(v)} 最低=${Math.min(...v)} 最高=${Math.max(...v)}`)
  console.log('   分布:', Object.entries(d).sort((a,b)=>a[0]-b[0]).map(([k,c])=>`${k}:${c}`).join(' '))
}

const wd = pub.map(p=>({p,amt:weekdayAmt(p)})).filter(r=>r.amt!=null)
const we = pub.map(p=>({p,amt:weekendAmt(p)})).filter(r=>r.amt!=null)
console.log('=== 記事の表を再現 ===')
show('平日', wd)
show('週末・祝日', we)
console.log('\n記事の記載: 平日 59件/中央値5,000/最低2,000/最高8,000、3,000円22件・5,000円20件')
console.log('　　　　　　週末 38件/中央値5,000/最低4,500/最高9,000、4,500円16件・5,000円13件')

const neko = pub.find(p=>(p.title||'').includes('地域猫'))
console.log('\n=== 地域猫マルシェの扱い ===')
console.log('平日集計に入るか:', wd.some(r=>r.p.id===neko.id), '額:', weekdayAmt(neko))
console.log('週末集計に入るか:', we.some(r=>r.p.id===neko.id), '額:', weekendAmt(neko))

const wo = wd.filter(r=>r.p.id!==neko.id)
console.log('\n=== 地域猫を除いた平日 ===')
show('平日(除外後)', wo)
console.log('→ 指摘の主張「58件・5,000円は19件・中央値5,000は不変」との一致:',
  wo.length===58 && wo.filter(r=>r.amt===5000).length===19 && med(wo.map(r=>r.amt))===5000 ? 'YES' : 'NO')

// 反証: 5,000円20件のうち、キッチンカー案件と確認できるのは何件か
console.log('\n=== 平日5,000円20件の内訳（KC言及の有無） ===')
for (const r of wd.filter(r=>r.amt===5000)) {
  const blob=[r.p.title,r.p.fee,r.p.description,r.p.recruit,r.p.details].filter(Boolean).join(' ')
  console.log(` ${/キッチンカー|移動販売|フードトラック/.test(blob)?'○':'×'} ${r.p.title}`)
}
// 地域猫と同じく「テント/ブース」語のある案件が他にないか
console.log('\n=== fee に「テント」「ブース」「出展」を含む公開案件 ===')
for (const p of pub) if (/テント|ブース|出展/.test(String(p.fee||'')+String(p.description||'')))
  console.log(` - ${p.title} | type=${p.place_type} | 平日=${weekdayAmt(p)} | fee=${JSON.stringify(p.fee)}`)
