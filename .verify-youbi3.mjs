import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return[l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const out=[];for(let f=0;;f+=500){const{data,error}=await sb.from('places').select('id,title,status,closed,open_days,schedule').range(f,f+499);if(error)throw error;out.push(...data);if(data.length<500)break}
const pub=out.filter(r=>r.status==='published'&&!r.closed)
const shown=pub.map(p=>{
  if(Array.isArray(p.schedule)&&p.schedule.filter(d=>d&&d.date).length>0)
    return p.schedule.filter(d=>d&&d.date).map(d=>d.date+' '+d.start+'〜'+d.end).join(' / ')
  return (p.open_days||[]).map(x=>(x||'').trim()).filter(Boolean)[0]||'要相談'
})
// 曜日の意味を伝えているか（「月火水木金土日」の羅列や「金、土、日」も拾う）
const DOW=/(月曜|火曜|水曜|木曜|金曜|土曜|日曜|平日|土日|週末|祝日|毎週|全曜日|[月火水木金土日]\s*[、,・～〜\/]\s*[月火水木金土日]|[月火水木金土]{3,}日)/
const hit=shown.filter(t=>t!=='要相談'&&DOW.test(t))
console.log('募集中:',pub.length)
console.log('日程欄に何か出る:',shown.filter(t=>t!=='要相談').length)
console.log('日程欄が「要相談」:',shown.filter(t=>t==='要相談').length)
console.log('日程欄が曜日を伝えている:',hit.length)
console.log('\n曜日を伝えていない「要相談以外」:')
shown.filter(t=>t!=='要相談'&&!DOW.test(t)).forEach(t=>console.log('   -',t.slice(0,60)))
