import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('='))
    .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
async function all(t){const out=[];for(let f=0;;f+=500){const{data,error}=await db.from(t).select('*').range(f,f+499);if(error)throw new Error(error.message);out.push(...data);if(data.length<500)break}return out}
const live=(await all('places')).filter(p=>p.status==='published'&&!p.closed)
const VENUE=[['スーパー',/スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/],
['学校',/大学|専門学校|高校|学校|学園|学院|キャンパス|学内/],
['商業施設',/イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/],
['ホームセンター',/ホームセンター|カインズ|コーナン|ビバホーム|ケーヨー|ジョイフル|家電/],
['オフィス',/オフィス|ビル|本社|事業所|工場|会社|株式会社|センタービル/],
['病院',/病院|クリニック|医療|介護|老人|福祉/],['マンション',/マンション|団地|住宅|レジデンス/],
['公共',/公園|道の駅|市役所|区役所|役場|図書館|文化会館/],
['イベント',/祭|フェス|マルシェ|イベント|大会|フェア|市$|の市|フリマ|クリマ|FamilyDay|Day$/],
['駐車場',/駐車場|空き地|遊休/],['レジャー',/ゴルフ|キャンプ|遊園地|温泉|プール|スポーツ/]]
const txt=p=>`${p.title} ${p.place_type??''} ${(p.genres??[]).join(' ')}`
const venueOf=p=>(VENUE.find(([,re])=>re.test(txt(p)))??['その他'])[0]
const g={}
for(const p of live){(g[venueOf(p)]??=[]).push(p.title)}
for(const [k,v] of Object.entries(g).sort((a,b)=>b[1].length-a[1].length)){
  console.log(`\n### ${k} (${v.length}件)`)
  for(const t of v) console.log('   '+t)
}
