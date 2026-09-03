import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
async function all(t){const o=[];for(let f=0;;f+=1000){const{data,error}=await db.from(t).select('*').range(f,f+999);if(error)throw new Error(error.message);o.push(...data);if(data.length<1000)break}return o}
const live=(await all('places')).filter(p=>p.status==='published'&&!p.closed)
const first=p=>((p.open_days||[]).map(x=>(x||'').trim()).filter(Boolean)[0]||'')
const withDates=p=>Array.isArray(p.schedule)&&p.schedule.filter(d=>d?.date).length>0
const youbi=live.filter(p=>!withDates(p)&&/曜|毎週|毎月|平日|土日/.test(first(p)))
console.log('日程欄に曜日らしい記載が出る案件', youbi.length)
console.log('日付が出る案件', live.filter(withDates).length)
console.log('「要相談」と出る案件', live.filter(p=>!withDates(p)&&!first(p)).length)
console.log('open_days はあるが曜日表現でないもの', live.filter(p=>!withDates(p)&&first(p)&&!/曜|毎週|毎月|平日|土日/.test(first(p))).length)
console.log('\n常設(regular)のうち日程が要相談', live.filter(p=>p.place_type==='regular'&&!withDates(p)&&!first(p)).length,'/ 常設', live.filter(p=>p.place_type==='regular').length)
