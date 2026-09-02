import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env=Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>[l.slice(0,l.indexOf('=')).trim(),l.slice(l.indexOf('=')+1).trim()]))
const sb=createClient(env.NEXT_PUBLIC_SUPABASE_URL,env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const rows=[];for(let f=0;;f+=1000){const{data}=await sb.from('places').select('*').range(f,f+999);if(!data||!data.length)break;rows.push(...data);if(data.length<1000)break}
const open=rows.filter(p=>p.status==='published'&&!p.closed)
const cls=(p)=>{const t=[p.title,p.description,p.recruit].join(' ')
 if(/大学|専門学校|学園|学校|キャンパス|看護|高校/.test(t))return '学校'
 if(/イオンモール|モール|ショッピング|アリオ|ワールドポーターズ|ステラタウン|イオンタウン|イオンスタイル|そよら|商業施設/.test(t))return '商業施設'
 if(/スーパー|サンユー|Olympic|オリンピック|ドン・キホーテ|イオン|食品|生鮮|マルエツ|ライフ/.test(t))return 'スーパー'
 if(/祭|フェア|フェス|マルシェ|EXPO|イベント|Day/i.test(t))return 'イベント'
 if(/株式会社|企業|オフィス|事業所|TOTO/.test(t))return 'オフィス'
 if(/ゴルフ|レジャー/.test(t))return 'ゴルフ・レジャー'
 return 'その他'}
const c={};for(const p of open){const k=cls(p);c[k]=(c[k]||0)+1}
console.log('簡易分類:',JSON.stringify(c))
console.log('学校+商業施設:',(c['学校']||0)+(c['商業施設']||0),'/',open.length)
