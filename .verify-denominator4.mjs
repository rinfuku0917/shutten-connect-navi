import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
const env = Object.fromEntries(readFileSync('.env.local','utf8').split('\n').map(l=>l.match(/^([A-Z_]+)=(.*)$/)).filter(Boolean).map(m=>[m[1],m[2].replace(/^"|"$/g,'')]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {auth:{persistSession:false}})
const out=[]; for(let f=0;;f+=1000){const {data}=await sb.from('public_sellers').select('*').range(f,f+999); if(!data?.length)break; out.push(...data); if(data.length<1000)break}
const EX=['株式会社nav','株式会社アーク']
const ex=out.filter(r=>EX.includes((r.shop_name??'').trim()))
console.log('除外2社:', ex.map(r=>`${r.shop_name} genre=${JSON.stringify(r.genre)} areas=${JSON.stringify(r.areas)} photos=${Array.isArray(r.photos)?r.photos.length:r.photos}`).join('\n  '))
console.log('\ngenre の型サンプル:', out.slice(0,5).map(r=>JSON.stringify(r.genre)).join(' | '))
const g={}; for(const r of out){const v=Array.isArray(r.genre)?r.genre:[r.genre]; for(const x of v) g[x??'(なし)']=(g[x??'(なし)']||0)+1}
console.log('genre 内訳(全1386):', JSON.stringify(g))
const kept=out.filter(r=>!EX.includes((r.shop_name??'').trim()))
const g2={}; for(const r of kept){const v=Array.isArray(r.genre)?r.genre:[r.genre]; for(const x of v) g2[x??'(なし)']=(g2[x??'(なし)']||0)+1}
console.log('genre 内訳(除外2社を抜いた1384):', JSON.stringify(g2))
console.log('\n写真あり: 全1386 =', out.filter(r=>(r.photos??[]).length>0).length, ' / 1384 =', kept.filter(r=>(r.photos??[]).length>0).length)
