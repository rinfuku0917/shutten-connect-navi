import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// app/blog/page.tsx の getPosts をそのまま再現 (page=1, category='書類・保険')
const PER_PAGE=10
let q = sb.from('posts').select('id, slug, title, excerpt, category, cover_emoji, published_at, content', {count:'exact'}).eq('status','published')
q = q.eq('category','書類・保険')
const {data,count,error} = await q.order('published_at',{ascending:false}).range(0,9)
console.log('=== /blog?category=書類・保険 のページ描画結果を再現 ===')
console.log('error:', error?.message ?? 'なし')
console.log('count(総件数):', count)
console.log('返った記事:', data?.map(p=>({slug:p.slug,title:p.title,published_at:p.published_at})))
console.log('=> 空ページになるか:', (data?.length??0)===0 ? 'YES(空)' : 'NO(記事が出る)')

// 詳細ページの条件も見る
const {data:d2} = await sb.from('posts').select('*').eq('slug','kitchen-car-required-documents').maybeSingle()
console.log('\n=== kitchen-car-required-documents の全カラム ===')
if(d2){ for(const [k,v] of Object.entries(d2)) console.log(`  ${k}: ${typeof v==='string'&&v.length>120 ? v.slice(0,120)+'…('+v.length+'文字)' : JSON.stringify(v)}`) }
else console.log('  取得できず')
