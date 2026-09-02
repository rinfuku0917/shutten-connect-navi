import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 全postsをrangeで回す
let all=[], from=0
while(true){
  const {data,error} = await sb.from('posts').select('id,slug,title,category,status,published_at').range(from,from+999)
  if(error){console.log('ERR',error.message);break}
  all=all.concat(data); if(data.length<1000)break; from+=1000
}
console.log('=== 全posts件数(匿名キーで見える範囲):', all.length)
for(const p of all) console.log(`  status=${p.status} | category=${JSON.stringify(p.category)} | ${p.slug}`)

console.log('\n=== published のみ カテゴリ別集計 ===')
const pub = all.filter(p=>p.status==='published')
const CATS=['出店場所の探し方','開業・許可','書類・保険','募集者向け']
for(const c of CATS){
  const n = pub.filter(p=>p.category===c).length
  console.log(`  ${c} : ${n}件 ${n===0?'  <-- 空!':''}`)
}
const other = pub.filter(p=>!CATS.includes(p.category))
console.log('  (4カテゴリ外/null):', other.length, other.map(p=>`${p.slug}=${JSON.stringify(p.category)}`).join(', '))
