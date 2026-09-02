import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all=[],from=0
for(;;){const{data,error}=await sb.from('places').select('*').range(from,from+499);if(error){console.log(error);process.exit(1)}all=all.concat(data);if(data.length<500)break;from+=500}
const pub=all.filter(p=>p.status==='published'&&!p.closed)
const od=p=>(Array.isArray(p.open_days)?p.open_days:[]).map(x=>(x||'').trim()).filter(Boolean)
const sch=p=>(Array.isArray(p.schedule)?p.schedule:[]).filter(d=>d&&d.date)
const disp=p=>{const s=sch(p);if(s.length>0)return s.map(d=>d.date).join(' ');const o=od(p);return o[0]||''}

// 「日程が具体的」を厳しく取る色々な定義を総当たり
const junk=/^(ー|-|–|—|未定|なし)$/
const notDate=/いつからでも|募集開始予定|随時|応相談|要相談/
const tests={
 '実装どおり(日程欄が要相談でない)':p=>disp(p)!=='',
 '↑ かつ プレースホルダ「ー」除く':p=>disp(p)!=''&&!junk.test(disp(p).trim()),
 '↑ かつ 日付でない文言も除く':p=>disp(p)!=''&&!junk.test(disp(p).trim())&&!notDate.test(disp(p)),
 '↑ かつ 相談語を含むものも除く':p=>disp(p)!=''&&!junk.test(disp(p).trim())&&!notDate.test(disp(p))&&!/相談/.test(disp(p)),
 '曜日か日付を含む':p=>/[月火水木金土日]|\d+月|\d{4}-\d{2}-\d{2}|祝/.test(disp(p)),
 '曜日か日付を含む かつ 相談語なし':p=>/[月火水木金土日]|\d+月|\d{4}-\d{2}-\d{2}|祝/.test(disp(p))&&!/相談/.test(disp(p)),
 '具体的な日付(年月日)のみ':p=>/\d{4}-\d{2}-\d{2}|\d+月\s*\d+日|\d+日（/.test(disp(p)),
 '常設 かつ 日程欄あり':p=>p.place_type!=='event'&&disp(p)!=='',
 'イベント含む 日程欄あり かつ 常設のみ相談語除く':p=>disp(p)!==''&&!(p.place_type!=='event'&&/相談/.test(disp(p))),
}
console.log('母数 募集中:',pub.length,'\n記事の主張: 48件\n')
for(const[k,f]of Object.entries(tests)){const n=pub.filter(f).length;console.log((n===48?'★★ 48一致 ★★  ':'               ')+n+'件  '+k)}

// 出店料の再分類（万円対応）
const yen=p=>/\d[\d,]*\s*(万)?\s*円/.test(p.fee||'')||((p.price_fixed||0)+(p.company_fixed_amount||0))>0
const pct=p=>/\d+\s*[%％]/.test(p.fee||'')||((p.price_share_pct||0)+(p.company_share_pct||0))>0
console.log('\n--- 出店料（万円対応版） ---')
console.log('固定:',pub.filter(p=>yen(p)&&!pct(p)).length,'/ 歩合:',pub.filter(p=>!yen(p)&&pct(p)).length,'/ 併用:',pub.filter(p=>yen(p)&&pct(p)).length,'/ 金額なし:',pub.filter(p=>!yen(p)&&!pct(p)).length)
console.log('記事:      固定51 / 歩合44 / 併用9 / 応相談6')
console.log('金額あり合計:',pub.filter(p=>yen(p)||pct(p)).length,' ←記事の104')
const P=pub.filter(p=>p.place_type!=='event')
console.log('常設97のうち 固定制:',P.filter(p=>yen(p)&&!pct(p)).length,' ←記事の「常設48件」')
