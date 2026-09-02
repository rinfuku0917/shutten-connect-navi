import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync(new URL('./.env.local', import.meta.url),'utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(),l.slice(i+1).trim()]}))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
async function all(t,c){const o=[];for(let f=0;;f+=1000){const{data,error}=await db.from(t).select(c).range(f,f+999);if(error){console.log(error.message);return o}o.push(...data);if(data.length<1000)break}return o}
const pub=(await all('places','*')).filter(p=>p.status==='published'&&!p.closed)
const RETAIL=/イオン|アリオ|Ario|ペリエ|Olympic|オリンピック|サンユー|スーパー|ストアー|モール|ショッピング|百貨店|商業施設|ホームセンター|ヨーカ|マルエツ|ライフ|ベイシア|カインズ|ドンキ|コーナン|西友|アピタ|ピアゴ|ゆめタウン|ららぽ|パルコ|マート|フーズ|ガッツ|プラザ/i
const SCHOOL=/学校|大学|専門|学園|キャンパス|高校|短大/
const r=pub.filter(p=>RETAIL.test(p.title||''))
const s=pub.filter(p=>SCHOOL.test(p.title||''))
console.log('公開中',pub.length)
console.log('小売・商業系っぽいタイトル:',r.length)
console.log('学校系っぽいタイトル:',s.length)
console.log('両方に当たる:',pub.filter(p=>RETAIL.test(p.title||'')&&SCHOOL.test(p.title||'')).length)
console.log('\n小売・商業系の内訳:'); r.forEach(p=>console.log('   - '+p.title))
