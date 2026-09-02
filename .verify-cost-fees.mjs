import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')&&!l.trim().startsWith('#'))
  .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const rows=[]
for(let f=0;;f+=1000){
  const {data,error}=await sb.from('places').select('*').range(f,f+999)
  if(error){console.log('ERR',error.message);break}
  rows.push(...data); if(data.length<1000)break
}
const pub = rows.filter(r=>r.status==='published' && !r.closed)
const med=a=>{const s=[...a].sort((x,y)=>x-y);return s.length?(s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2):null}

for(const t of ['regular','event']){
  const g=pub.filter(r=>r.place_type===t)
  const fixed=g.filter(r=>Number(r.price_fixed)>0)
  const share=g.filter(r=>Number(r.price_share_pct)>0)
  const fv=fixed.map(r=>Number(r.price_fixed))
  const sv=share.map(r=>Number(r.price_share_pct))
  console.log(`\n===== place_type=${t}  (${g.length}件) =====`)
  console.log(` 固定制 ${fixed.length}件 / 歩合制 ${share.length}件 / 両方0 ${g.filter(r=>!(Number(r.price_fixed)>0)&&!(Number(r.price_share_pct)>0)).length}件`)
  if(fv.length){
    console.log(` 固定額: 最小${Math.min(...fv).toLocaleString()} 中央値${med(fv).toLocaleString()} 最大${Math.max(...fv).toLocaleString()}`)
    console.log(' 固定額の分布:', JSON.stringify(fv.reduce((a,v)=>{a[v]=(a[v]||0)+1;return a},{})))
    console.log(' 単位(place_fixed_unit):', JSON.stringify(fixed.reduce((a,r)=>{a[r.place_fixed_unit||'(null)']=(a[r.place_fixed_unit||'(null)']||0)+1;return a},{})))
  }
  if(sv.length) console.log(` 歩合%: 中央値${med(sv)} 分布 ${JSON.stringify(sv.reduce((a,v)=>{a[v]=(a[v]||0)+1;return a},{}))}`)
}

// イベント案件を1件ずつ（少数なので全部見る）
console.log('\n===== event 案件の中身 =====')
for(const r of pub.filter(r=>r.place_type==='event')){
  console.log(` ${String(r.price_fixed).padStart(7)}円/${r.place_fixed_unit||'-'}  歩合${r.price_share_pct||0}%  ${String(r.prefecture||'').padEnd(5)} ${String(r.title||'').slice(0,44)}`)
}
// 全体（記事の数値の再現）
const fixedAll=pub.filter(r=>Number(r.price_fixed)>0).map(r=>Number(r.price_fixed))
const shareAll=pub.filter(r=>Number(r.price_share_pct)>0).map(r=>Number(r.price_share_pct))
console.log(`\n===== 全公開110件 =====\n 固定制 ${fixedAll.length}件 中央値 ${med(fixedAll).toLocaleString()}円 / 歩合制 ${shareAll.length}件 中央値 ${med(shareAll)}%`)
console.log(' 歩合10%の件数:', shareAll.filter(v=>v===10).length)
