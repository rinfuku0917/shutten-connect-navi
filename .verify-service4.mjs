import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
async function all(t){const o=[];for(let f=0;;f+=1000){const{data,error}=await db.from(t).select('*').range(f,f+999);if(error)throw new Error(error.message);o.push(...data);if(data.length<1000)break}return o}
const live=(await all('places')).filter(p=>p.status==='published'&&!p.closed)
const pctOnly = live.filter(p => ((p.price_share_pct||0)+(p.company_share_pct||0))>0)
console.log('構造化された歩合が入っている案件', pctOnly.length)
let dropped=0
for(const p of pctOnly){
  const raw=String(p.fee??'')
  const disp='売上の'+((p.price_share_pct||0)+(p.company_share_pct||0))+'%'
  const rawHasTax=/税/.test(raw)
  if(rawHasTax) { dropped++; if(dropped<=8) console.log('  税の記載が本文にあるが表示は歩合のみ:', p.title.slice(0,24),'｜fee=',JSON.stringify(raw.slice(0,50)),'｜表示=',disp) }
}
console.log('うち本文に「税」があるもの', dropped)
console.log('\n share_tax_basis / share_tax_rate が入っている案件', live.filter(p=>p.share_tax_basis||p.share_tax_rate).length)
console.log('募集中で fee本文に「税」があるもの', live.filter(p=>/税/.test(String(p.fee??''))).length)
