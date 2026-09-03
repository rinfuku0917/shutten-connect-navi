import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('='))
    .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,{auth:{persistSession:false}})
async function all(t){const out=[];for(let f=0;;f+=500){const{data,error}=await db.from(t).select('*').range(f,f+499);if(error)throw new Error(error.message);out.push(...data);if(data.length<500)break}return out}
const live=(await all('places')).filter(p=>p.status==='published'&&!p.closed)
const T=p=>`${p.title} ${p.place_type??''} ${(p.genres??[]).join(' ')}`
const pct=n=>`${n}/110 = ${(n/110*100).toFixed(2)}%`

// A: スクリプトどおり
const A=[/スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/,
/大学|専門学校|高校|学校|学園|学院|キャンパス|学内/,
/イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/]
const inTop3A=p=>A.some(re=>re.test(T(p)))
// 先勝ちを踏まえ、上位3つ以外に先に取られるものはない（スーパー/学校/商業施設が1〜3番目）
console.log('A スクリプトどおり            :', pct(live.filter(inTop3A).length))

// B: 学園祭・文化祭・社内祭りは「イベント」として扱う（＝単発イベントは会場でなくイベントに数える）
const isFes=p=>/祭|フェス|フェア|マルシェ|EXPO|大会|フリマ/.test(p.title)
console.log('B 学園祭/文化祭をイベント扱い :', pct(live.filter(p=>inTop3A(p)&&!isFes(p)).length),
  ' 除外:', live.filter(p=>inTop3A(p)&&isFes(p)).map(p=>p.title).join(' / '))

// C: place_type='event' のものは会場でなくイベントに数える
console.log('\nplace_type の内訳:', JSON.stringify(live.reduce((a,p)=>(a[p.place_type??'null']=(a[p.place_type??'null']??0)+1,a),{})))
const evTop3 = live.filter(p=>inTop3A(p)&&p.place_type==='event')
console.log('C 単発イベントを上位3つから外す:', pct(live.filter(p=>inTop3A(p)&&p.place_type!=='event').length))
console.log('   （上位3つに入っている単発イベント '+evTop3.length+'件）')
for(const p of evTop3) console.log('     '+p.place_type+' | '+p.title)

// D: MEGAドンキを商業施設扱い（上位3つ内なので合計は不変）／さがみや・ガッツの扱い
console.log('\nD 「旧Olympic」でスーパーに入った件:', live.filter(p=>/旧Olympic/.test(p.title)).map(p=>p.title))

// E: 同一チェーンの寄与
const chain={}
for(const p of live.filter(inTop3A)){
  const k=/サンユーストアー/.test(p.title)?'サンユーストアー':/Olympic|旧Olympic/.test(p.title)?'Olympic':
    /イオン|Ario|そよら|ステラタウン/.test(p.title)?'イオン系':/専門学校|大学|学園|学院|高等看護/.test(p.title)?'学校（各校）':'その他'
  chain[k]=(chain[k]??0)+1
}
console.log('\nE 上位3つ94件の内訳（系列別）:', JSON.stringify(chain,null,1))
