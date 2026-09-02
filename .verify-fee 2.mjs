import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all=[],from=0
for(;;){const{data,error}=await sb.from('places').select('*').range(from,from+499);if(error){console.log(error);process.exit(1)}all=all.concat(data);if(data.length<500)break;from+=500}
const pub = all.filter(p=>p.status==='published'&&!p.closed)
const od = p => (Array.isArray(p.open_days)?p.open_days:[]).map(x=>(x||'').trim()).filter(Boolean)
const sch = p => (Array.isArray(p.schedule)?p.schedule:[]).filter(d=>d&&d.date)

// fee をテキスト解析（記事の分類はこちら）
const feeStr = p => [p.fee||'', p.details||''].join(' ')
const hasYen = p => /\d[\d,]*\s*円/.test(p.fee||'') || ((p.price_fixed||0)+(p.company_fixed_amount||0))>0
const hasPct = p => /\d+\s*[%％]/.test(p.fee||'') || ((p.price_share_pct||0)+(p.company_share_pct||0))>0
const soudan = p => /相談|問い合わせ|問合|不明/.test(p.fee||'') || !(p.fee||'').trim() || /^[ー\-–—]+$/.test((p.fee||'').trim())

console.log('母数:', pub.length)
console.log('\n--- 出店料の分類（fee テキスト解析） ---')
const fixed = pub.filter(p=>hasYen(p)&&!hasPct(p))
const share = pub.filter(p=>!hasYen(p)&&hasPct(p))
const both  = pub.filter(p=>hasYen(p)&&hasPct(p))
const nofee = pub.filter(p=>!hasYen(p)&&!hasPct(p))
console.log('固定制:',fixed.length,'/ 歩合制:',share.length,'/ 併用:',both.length,'/ 金額なし:',nofee.length)
console.log('記事の記載   固定51 / 歩合44 / 併用9 / 応相談6')
console.log('\n金額あり(=104相当):', pub.length-nofee.length)
console.log('金額なしの fee:'); nofee.forEach(p=>console.log('   ',JSON.stringify(p.fee),'|',p.title))

console.log('\n--- 常設/イベント × 出店料 ---')
const perm = p=>p.place_type!=='event'
const P=pub.filter(perm), E=pub.filter(p=>!perm(p))
const cnt=(arr)=>[arr.filter(p=>hasYen(p)&&!hasPct(p)).length,arr.filter(p=>!hasYen(p)&&hasPct(p)).length,arr.filter(p=>hasYen(p)&&hasPct(p)).length,arr.filter(p=>!hasYen(p)&&!hasPct(p)).length]
console.log('常設('+P.length+'件) 固定/歩合/併用/応相談 =',cnt(P).join(' / '),'  ←記事: 48 / 36 / 9 / 4')
console.log('イベント('+E.length+'件) 固定/歩合/併用/応相談 =',cnt(E).join(' / '),'  ←記事: 3 / 8 / 0 / 2')

console.log('\n--- 日程欄に何か出る54件の中身 ---')
let i=0
for (const p of pub){
  const s=sch(p), o=od(p)
  if (s.length===0 && o.length===0) continue
  i++
  const t = s.length>0 ? s.map(d=>d.date+' '+d.start+'〜'+d.end).join(' / ') : o[0]
  console.log(String(i).padStart(3)+'. ['+(s.length>0?'sch':'od ')+'] '+(perm(p)?'常設':'ｲﾍﾞﾝﾄ')+' '+JSON.stringify(t.slice(0,60)))
}
