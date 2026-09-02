import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function all(table, sel, mod) {
  const out=[]; let from=0
  for(;;){ let q=sb.from(table).select(sel).range(from,from+499); if(mod) q=mod(q)
    const {data,error}=await q; if(error){console.error(table,error.message);break}
    out.push(...data); if(data.length<500) break; from+=500 }
  return out
}
const places = (await all('places','*',q=>q.eq('status','published'))).filter(p=>!p.closed)

const z2h = s => String(s||'').replace(/[０-９]/g,c=>'0123456789'[c.charCodeAt(0)-0xFF10]).replace(/％/g,'%').replace(/，/g,',')
const yen = s => { const m=z2h(s).match(/([\d,]+)\s*円/); return m?Number(m[1].replace(/,/g,'')):null }

// 案件ごとに 平日額 / 週末額 を取り出す（fee テキスト＋day_type_fees）
const rows=[]
for (const p of places) {
  const f = z2h(p.fee||'').split('\n')[0]   // 1行目＝キッチンカー向け
  const d = p.day_type_fees
  let wd=null, we=null, kind=null
  if (d) { const s=k=>d[k]?(Number(d[k].placeFee)||0)+(Number(d[k].companyFee)||0):null; wd=s('weekday'); we=s('weekend'); kind='固定(dtf)' }
  else {
    const hasShare = /\d+\s*%/.test(f)
    const wm = f.match(/平日[^0-9]{0,4}([\d,]+)\s*円/)
    const em = f.match(/(?:土日祝|休日|週末|土日)[^0-9]{0,4}([\d,]+)\s*円/)
    if (wm||em) { wd=wm?Number(wm[1].replace(/,/g,'')):null; we=em?Number(em[1].replace(/,/g,'')):null; kind=hasShare?'併用/最低保証':'固定(平日週末別)' }
    else if (/平日.{0,4}週末|平日・週末|週末.{0,4}平日/.test(f) && yen(f)) { wd=we=yen(f); kind='固定(平日週末同額)' }
    else if (/(1日|一日|１日|\/日|日額)/.test(f) && yen(f) && !hasShare) { wd=we=yen(f); kind='固定(1日◯円)' }
    else if (hasShare && yen(f)) { kind='併用' }
    else if (hasShare) { kind='歩合' }
    else if (yen(f)) { wd=we=yen(f); kind='固定(金額のみ)' }
    else kind='応相談/不明'
  }
  rows.push({t:p.title, fee:f, wd, we, kind, sched:Array.isArray(p.schedule)?p.schedule.length:0})
}
const cnt = {}; rows.forEach(r=>cnt[r.kind]=(cnt[r.kind]||0)+1)
console.log('=== 分類 ==='); console.log(cnt, '合計', rows.length)

const med = a=>{const s=[...a].sort((x,y)=>x-y); return s.length%2?s[(s.length-1)/2]:(s[s.length/2-1]+s[s.length/2])/2}
for (const [lbl,key] of [['平日','wd'],['週末','we']]) {
  const set = rows.filter(r=>r.kind.startsWith('固定') && r[key])
  const v = set.map(r=>r[key])
  console.log(`\n=== ${lbl}（固定制のみ n=${v.length}）中央値${med(v)} 最低${Math.min(...v)} 最高${Math.max(...v)} ===`)
  const dist={}; v.forEach(x=>dist[x]=(dist[x]||0)+1)
  console.log('分布:', Object.entries(dist).sort((a,b)=>a[0]-b[0]).map(([k,n])=>`${k}円:${n}件`).join('  '))
  console.log(`8,000円超の案件:`, set.filter(r=>r[key]>8000).map(r=>`${r.t.slice(0,20)}=${r[key]}「${r.fee.slice(0,40)}」`))
  console.log(`8,000円ちょうど:`, set.filter(r=>r[key]===8000).map(r=>`${r.t.slice(0,20)}「${r.fee.slice(0,40)}」`))
}
console.log('\n=== 平日<週末 の案件（両方明記） ===')
const both = rows.filter(r=>r.kind.startsWith('固定')&&r.wd&&r.we)
console.log('n=',both.length,' 平日<週末:',both.filter(b=>b.wd<b.we).length,' 同額:',both.filter(b=>b.wd===b.we).length,' 平日>週末:',both.filter(b=>b.wd>b.we).length)
const diff = both.filter(b=>b.wd<b.we).map(b=>b.we-b.wd)
console.log('差の中央値:', diff.length?med(diff):'-')
