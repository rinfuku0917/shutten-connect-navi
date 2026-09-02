import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all=[],from=0
for(;;){const{data,error}=await sb.from('places').select('*').range(from,from+499);if(error){console.log(error);process.exit(1)}all=all.concat(data);if(data.length<500)break;from+=500}
const pub = all.filter(p=>p.status==='published' && !p.closed)
const od = p => (Array.isArray(p.open_days)?p.open_days:[]).map(x=>(x||'').trim()).filter(Boolean)
const sch = p => (Array.isArray(p.schedule)?p.schedule:[]).filter(d=>d&&d.date)
const vague = t => /相談|応相|問い合わせ|問合|未定|要確認|応談|など|随時/.test(t)
const perm = p => p.place_type !== 'event'

const defs = {
  'A schedule に日付あり': p=>sch(p).length>0,
  'B open_days が非空': p=>od(p).length>0,
  'C A または B': p=>sch(p).length>0||od(p).length>0,
  'D 詳細ページが日程を出す(実装どおり)': p=>sch(p).length>0||od(p).length>0,
  'E C かつ 相談語なし': p=>(sch(p).length>0||od(p).length>0)&&!vague(od(p).join(' ')),
  'F open_days非空 かつ 相談語なし': p=>od(p).length>0&&!vague(od(p).join(' ')),
  'G schedule配列が非null(日付有無問わず)': p=>Array.isArray(p.schedule)&&p.schedule.length>0,
  'H C かつ open_time もある': p=>(sch(p).length>0||od(p).length>0)&&!!p.open_time,
  'I 常設 かつ C': p=>perm(p)&&(sch(p).length>0||od(p).length>0),
  'J 常設 かつ open_days非空': p=>perm(p)&&od(p).length>0,
  'K C かつ 曜日文字を含む': p=>{const t=od(p).join(' ');return sch(p).length>0||/[月火水木金土日]曜/.test(t)},
  'L open_days に曜日文字': p=>/[月火水木金土日]曜/.test(od(p).join(' ')),
  'M open_time と close_time の両方': p=>!!p.open_time&&!!p.close_time,
  'N C かつ day_type_fees あり': p=>(sch(p).length>0||od(p).length>0)&&!!p.day_type_fees,
}
console.log('母数 募集中:', pub.length, '\n')
for (const [k,f] of Object.entries(defs)){
  const n = pub.filter(f).length
  console.log((n===48?'★48一致★ ':'         ')+k+' = '+n+'件')
}

// 出店料104件の再現
const feeVague = t => /相談|問い合わせ|問合|不明|ー|-|未定/.test(t||'')
const hasMoney = p => ((p.price_fixed||0)+(p.company_fixed_amount||0)+(p.price_share_pct||0)+(p.company_share_pct||0))>0
console.log('\n--- 出店料 ---')
console.log('金額データあり かつ fee に相談語なし:', pub.filter(p=>hasMoney(p)&&!feeVague(p.fee)).length)
console.log('金額データなし(=応相談):', pub.filter(p=>!hasMoney(p)).length)
pub.filter(p=>!hasMoney(p)).forEach(p=>console.log('   fee=',JSON.stringify(p.fee),'|',p.title))

// 常設48件仮説
console.log('\n--- 出店料記事の「常設48件」 ---')
const permAll = pub.filter(perm)
console.log('常設:', permAll.length, '/ 単発イベント:', pub.length-permAll.length)
const fixedOnly = permAll.filter(p=>((p.price_fixed||0)+(p.company_fixed_amount||0))>0 && ((p.price_share_pct||0)+(p.company_share_pct||0))===0)
const shareOnly = permAll.filter(p=>((p.price_fixed||0)+(p.company_fixed_amount||0))===0 && ((p.price_share_pct||0)+(p.company_share_pct||0))>0)
const bothF = permAll.filter(p=>((p.price_fixed||0)+(p.company_fixed_amount||0))>0 && ((p.price_share_pct||0)+(p.company_share_pct||0))>0)
const none = permAll.filter(p=>!hasMoney(p))
console.log('常設・固定制のみ:', fixedOnly.length, '/ 歩合のみ:', shareOnly.length, '/ 併用:', bothF.length, '/ 応相談:', none.length)
