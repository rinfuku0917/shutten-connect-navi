import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// paging to avoid the 1000-row cap
let all = [], from = 0
for(;;){
  const { data, error } = await sb.from('places').select('*').range(from, from+499)
  if (error) { console.log('ERR', error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 500) break
  from += 500
}
console.log('places 全行:', all.length)

const pub = all.filter(p => p.status === 'published' && !p.closed)
console.log('募集中 (published かつ closed が真でない):', pub.length)

// 詳細ページ PlaceDetailClient.tsx の scheduleText と同じロジックを再現
function scheduleText(p){
  const hasSched = Array.isArray(p.schedule) && p.schedule.filter(d => d && d.date).length > 0
  if (hasSched) return p.schedule.filter(d=>d.date).map(d=>d.date+' '+d.start+'〜'+d.end).join(' / ')
  const od = (Array.isArray(p.open_days) ? p.open_days : []).map(x=>(x||'').trim()).filter(Boolean)[0]
  return od || '要相談'
}

let bySched=0, byOpenDays=0, sou=0, both=0
const shown=[]
for (const p of pub){
  const hasSched = Array.isArray(p.schedule) && p.schedule.filter(d=>d&&d.date).length>0
  const hasOD = (Array.isArray(p.open_days)?p.open_days:[]).map(x=>(x||'').trim()).filter(Boolean).length>0
  if (hasSched && hasOD) both++
  const t = scheduleText(p)
  if (t === '要相談') { sou++; continue }
  if (hasSched) bySched++; else byOpenDays++
  shown.push({id:p.id, title:p.title, text:t, src: hasSched?'schedule':'open_days'})
}
console.log('\n--- 詳細ページの「日程」欄 ---')
console.log('schedule に日付あり(表示に採用):', bySched)
console.log('open_days の文字を表示:', byOpenDays)
console.log('日程欄に何か出る 合計:', shown.length)
console.log('「要相談」と出る:', sou)
console.log('（参考）schedule と open_days の両方を持つ:', both)

// 「相談」等を含む表示
const vague = shown.filter(s => /相談|応相|問い合わせ|問合|未定|要確認|応談/.test(s.text))
console.log('\n表示テキストに相談系の語を含む:', vague.length)
vague.forEach(v=>console.log('   ['+v.src+']', JSON.stringify(v.text), '←', v.title))
console.log('\n厳しく数えた場合（相談系を除く）:', shown.length - vague.length)

fs.writeFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/shown.json', JSON.stringify(shown,null,1))
