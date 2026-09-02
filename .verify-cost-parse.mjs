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
const norm=s=>String(s||'').replace(/[０-９，、]/g,c=>'0123456789,,'['０１２３４５６７８９，、'.indexOf(c)]||c)

// fee文字列から「1日あたりの固定円」を全部拾う
function yens(fee){
  const t=norm(fee); const out=[]
  // 「N万円」
  for(const m of t.matchAll(/([0-9]+(?:\.[0-9]+)?)\s*万円/g)) out.push(Math.round(parseFloat(m[1])*10000))
  // 「N,NNN円」/「NNNN円」
  for(const m of t.matchAll(/([0-9][0-9,]{2,})\s*円/g)) out.push(Number(m[1].replace(/,/g,'')))
  return out.filter(v=>v>=500&&v<=200000)
}
function pcts(fee){
  const t=norm(fee); const out=[]
  for(const m of t.matchAll(/([0-9]{1,2})\s*[%％]/g)) out.push(Number(m[1]))
  return out
}

for(const type of ['regular','event']){
  const g=pub.filter(r=>r.place_type===type)
  const fixedRows=[], shareRows=[]
  for(const r of g){
    const y=yens(r.fee), p=pcts(r.fee)
    if(p.length) shareRows.push({r,p})
    if(y.length) fixedRows.push({r,y})
  }
  const flat=fixedRows.flatMap(x=>x.y)
  console.log(`\n########## ${type} (${g.length}件) ##########`)
  console.log(` 円表記あり ${fixedRows.length}件 / %表記あり ${shareRows.length}件`)
  if(flat.length){
    console.log(` 円の値: 最小${Math.min(...flat).toLocaleString()} 中央値${med(flat).toLocaleString()} 最大${Math.max(...flat).toLocaleString()}`)
    const dist=flat.reduce((a,v)=>{a[v]=(a[v]||0)+1;return a},{})
    console.log(' 分布:', Object.entries(dist).sort((a,b)=>a[0]-b[0]).map(([k,v])=>`${Number(k).toLocaleString()}円×${v}`).join(', '))
    console.log(` 10,000円以上の件数: ${flat.filter(v=>v>=10000).length}`)
  }
  if(shareRows.length){
    const pf=shareRows.flatMap(x=>x.p)
    console.log(' %の分布:', JSON.stringify(pf.reduce((a,v)=>{a[v]=(a[v]||0)+1;return a},{})))
  }
}

// 常設で1万円以上の案件を列挙（イベント専用の帯かどうかの検証）
console.log('\n===== 常設(regular)で 10,000円以上を提示している案件 =====')
for(const r of pub.filter(r=>r.place_type==='regular')){
  const y=yens(r.fee).filter(v=>v>=10000)
  if(y.length) console.log(`  ${y.map(v=>v.toLocaleString()).join('/')}円  «${String(r.fee).slice(0,60)}»  ${String(r.title).slice(0,34)}`)
}
