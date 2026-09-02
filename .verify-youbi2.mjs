import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const out=[]
for(let f=0;;f+=500){const{data,error}=await sb.from('places').select('id,title,status,closed,open_days,schedule,max_slots').range(f,f+499);if(error)throw error;out.push(...data);if(data.length<500)break}
const pub = out.filter(r=>r.status==='published'&&!r.closed)

const shown = pub.map(p=>{
  if(Array.isArray(p.schedule)&&p.schedule.filter(d=>d&&d.date).length>0)
    return {t:p.schedule.filter(d=>d&&d.date).map(d=>d.date).join(' / '), src:'schedule'}
  const od=(p.open_days||[]).map(x=>(x||'').trim()).filter(Boolean)[0]
  return od?{t:od,src:'open_days'}:{t:'要相談',src:'none'}
})
const notSoudan = shown.filter(s=>s.t!=='要相談')
console.log('「要相談」以外:', notSoudan.length)

// 「具体的な日付」を含むもの（数字＋月日 or ISO日付）
const hasDate = notSoudan.filter(s=>/\d{4}-\d{2}-\d{2}|\d{1,2}\s*[\/月]\s*\d{1,2}/.test(s.t))
console.log('具体的な日付を含む:', hasDate.length)

// 曜日のみ（日付なし）
const dowOnly = notSoudan.filter(s=>!/\d{4}-\d{2}-\d{2}|\d{1,2}\s*[\/月]\s*\d{1,2}/.test(s.t))
console.log('日付なし（曜日・文言のみ）:', dowOnly.length)
dowOnly.forEach(s=>console.log('   -', s.t.slice(0,50)))

// open_days が空でない生の件数（schedule 優先を無視）
console.log('\nopen_days が空でない(生):', pub.filter(r=>(r.open_days||[]).map(x=>(x||'').trim()).filter(Boolean).length>0).length)
console.log('schedule に日付あり:', pub.filter(r=>Array.isArray(r.schedule)&&r.schedule.filter(d=>d&&d.date).length>0).length)
console.log('どちらかに何か入っている:', pub.filter(r=>((r.open_days||[]).map(x=>(x||'').trim()).filter(Boolean).length>0)||(Array.isArray(r.schedule)&&r.schedule.filter(d=>d&&d.date).length>0)).length)
