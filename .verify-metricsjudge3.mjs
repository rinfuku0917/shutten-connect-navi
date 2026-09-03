import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
async function pageAll(){const out=[];let last=null;for(let i=0;i<200;i++){let q=db.from('menus').select('id,seller_id,price,photo_url,created_at').order('id',{ascending:true}).limit(500);if(last!==null)q=q.gt('id',last);const{data,error}=await q;if(error)throw error;out.push(...data);if(data.length<500)break;last=data[data.length-1].id}return out}
const m = await pageAll()
const sorted=[...m].sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at)))
console.log('最新の created_at 上位12件:')
for(const r of sorted.slice(-12)) console.log('  ',r.created_at, r.seller_id, 'price='+r.price, r.photo_url?'写真あり':'写真なし')
// いくつかの時点で数え直す
for(const cut of ['2026-09-01T00:00:00Z','2026-09-02T00:00:00Z','2026-09-02T03:00:00Z','2026-09-02T06:00:00Z','2026-09-02T09:00:00Z','2026-09-02T12:00:00Z','2026-09-02T15:00:00Z']){
  const b=m.filter(x=>x.created_at<cut)
  console.log(`${cut} 以前: 総数${b.length} 価格あり${b.filter(x=>x.price!=null).length} 写真あり${b.filter(x=>x.photo_url).length} 出店者${new Set(b.map(x=>x.seller_id)).size}`)
}
