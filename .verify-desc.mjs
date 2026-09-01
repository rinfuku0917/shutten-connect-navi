import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n')
  .filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
let all=[], from=0
for(;;){
  const {data,error} = await sb.from('posts').select('slug,title,meta_description,excerpt,status,published_at').range(from,from+999)
  if(error){console.error('ERR',error.message);break}
  all=all.concat(data); if(data.length<1000)break; from+=1000
}
console.log('posts総数:',all.length)
console.log('\nslug | status | title長 | meta_desc長')
for(const p of all.sort((a,b)=>(a.slug>b.slug?1:-1))){
  const d=p.meta_description||p.excerpt||p.title
  console.log(`${p.slug} | ${p.status} | ${(p.title+' - 出店コネクトナビ').length} | ${d.length}${p.meta_description?'':' (excerpt/title代用)'}`)
}
const pub=all.filter(p=>p.status==='published')
const lens=pub.map(p=>(p.meta_description||p.excerpt||p.title).length).sort((a,b)=>a-b)
console.log('\n公開記事のmeta_desc長:',lens.join(', '))
console.log('中央値:',lens[Math.floor(lens.length/2)],'平均:',(lens.reduce((a,b)=>a+b,0)/lens.length).toFixed(1))
const target=all.find(p=>p.slug==='food-truck-fee-guide')
console.log('\n--- 対象記事 DB実値 ---')
console.log('title:',JSON.stringify(target.title),'→ len',target.title.length)
console.log('meta_description len:',target.meta_description.length)
const md=fs.readFileSync('docs/blog/food-truck-fee-guide.md','utf8')
const m=md.match(/^meta_description:\s*(.+)$/m)[1].trim()
console.log('原稿mdのmeta_description len:',m.length,'/ DBと一致:', m===target.meta_description)
