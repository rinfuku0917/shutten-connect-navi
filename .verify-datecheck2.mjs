import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
const out=[]; for(let f=0;;f+=500){const{data,error}=await db.from('places').select('*').range(f,f+499); if(error)throw error; out.push(...data); if(data.length<500)break}
for (const col of ['created_at','posted_at','closed_at']) {
  const rows = out.filter(p=>p[col] && String(p[col]) >= '2026-09-01')
  console.log(`${col} >= 2026-09-01: ${rows.length} 件`)
  for (const r of rows) console.log('   ', r[col], r.status, 'closed=', r.closed, String(r.title).slice(0,30))
}
const max = c => out.map(p=>p[c]).filter(Boolean).sort().slice(-3)
console.log('created_at 最新3:', max('created_at'))
console.log('posted_at  最新3:', max('posted_at'))
console.log('closed_at  最新3:', max('closed_at'))
// メニューの作成時刻（時分まで）
const ms=[]; for(let f=0;;f+=1000){const{data,error}=await db.from('menus').select('id,created_at,price,photo_url').range(f,f+999); if(error)throw error; ms.push(...data); if(data.length<1000)break}
console.log('menus 最新8件の created_at:', ms.map(m=>m.created_at).filter(Boolean).sort().slice(-8))
console.log('menus 合計:', ms.length, '価格あり:', ms.filter(m=>m.price!=null).length)
