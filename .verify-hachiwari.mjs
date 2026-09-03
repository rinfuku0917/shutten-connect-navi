import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('='))
    .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})

// 独自のページング（範囲を変えて、打ち切りが起きていないかも見る）
async function all(t){const out=[];for(let f=0;;f+=500){const{data,error}=await db.from(t).select('*').range(f,f+499);if(error)throw new Error(error.message);out.push(...data);if(data.length<500)break}return out}
const places = await all('places')
console.log('places 全件:', places.length)

// 公開中の定義を、closed の値ごとに分解して確かめる
const pub = places.filter(p=>p.status==='published')
console.log('status=published:', pub.length)
const byClosed={}
for(const p of pub) byClosed[String(p.closed)] = (byClosed[String(p.closed)]??0)+1
console.log('published の closed 内訳:', byClosed)
const live = pub.filter(p=>!p.closed)
console.log('募集中(live):', live.length)

// --- スクリプトと同じ分類 ---
const VENUE=[['スーパー・食品店',/スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/],
['学校・専門学校・大学',/大学|専門学校|高校|学校|学園|学院|キャンパス|学内/],
['商業施設・モール',/イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/],
['ホームセンター・家電量販',/ホームセンター|カインズ|コーナン|ビバホーム|ケーヨー|ジョイフル|家電/],
['オフィス・事業所',/オフィス|ビル|本社|事業所|工場|会社|株式会社|センタービル/],
['病院・介護施設',/病院|クリニック|医療|介護|老人|福祉/],
['マンション・住宅',/マンション|団地|住宅|レジデンス/],
['公園・道の駅・公共',/公園|道の駅|市役所|区役所|役場|図書館|文化会館/],
['イベント・お祭り',/祭|フェス|マルシェ|イベント|大会|フェア|市$|の市|フリマ|クリマ|FamilyDay|Day$/],
['駐車場・遊休地',/駐車場|空き地|遊休/],
['ゴルフ場・レジャー',/ゴルフ|キャンプ|遊園地|温泉|プール|スポーツ/]]
const txt = p => `${p.title} ${p.place_type ?? ''} ${(p.genres ?? []).join(' ')}`
const venueOf = p => (VENUE.find(([,re])=>re.test(txt(p))) ?? ['その他'])[0]

const c={}; for(const p of live) c[venueOf(p)]=(c[venueOf(p)]??0)+1
console.log('\n=== 分類（スクリプトと同じ順序）===')
const tot = live.length
for(const [k,v] of Object.entries(c).sort((a,b)=>b[1]-a[1]))
  console.log(`  ${k}: ${v}件 (${(v/tot*100).toFixed(2)}%)`)
const top3 = (c['スーパー・食品店']??0)+(c['学校・専門学校・大学']??0)+(c['商業施設・モール']??0)
console.log(`\n上位3つ合計: ${top3} / ${tot} = ${(top3/tot*100).toFixed(3)}%`)
console.log(`  切り捨て:${Math.floor(top3/tot*100)}%  四捨五入:${Math.round(top3/tot*100)}%`)

// --- 分類の頑健さを見る：複数の区分にあてはまる案件はいくつあるか ---
console.log('\n=== 分類の重なり（先勝ちで捨てられた区分）===')
let multi=0
const conflicts=[]
for(const p of live){
  const hits = VENUE.filter(([,re])=>re.test(txt(p))).map(([n])=>n)
  if(hits.length>1){multi++; conflicts.push(`${p.title} → 採用:${hits[0]} / 他:${hits.slice(1).join(',')}`)}
}
console.log(`複数区分に当たる案件: ${multi}件 / ${tot}件`)
for(const x of conflicts.slice(0,40)) console.log('  '+x)
