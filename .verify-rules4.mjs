import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function all(sel){const rows=[];for(let f=0;;f+=1000){const{data,error}=await sb.from('places').select(sel).range(f,f+999);if(error){console.error(error.message);break}if(!data||!data.length)break;rows.push(...data);if(data.length<1000)break}return rows}
const places = await all('*')
const pub = places.filter(p=>p.status==='published')
console.log('published:', pub.length)
console.log('closed=null:', pub.filter(p=>p.closed===null).length, ' closed=false:', pub.filter(p=>p.closed===false).length, ' closed=true:', pub.filter(p=>p.closed===true).length)
// 東京都で RelatedPlaces が実際に返す件数
const { data: rel } = await sb.from('places').select('id,title').eq('status','published').eq('closed',false).eq('prefecture','東京都').limit(4)
console.log('RelatedPlaces(東京都) 実クエリ結果:', (rel||[]).length)
