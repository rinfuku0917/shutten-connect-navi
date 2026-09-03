import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})
async function all(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data); if (data.length < 1000) break
  }
  return out
}
const places = await all('places')
const live = places.filter(p => p.status === 'published' && !p.closed)
console.log('公開中の案件:', live.length)

// スクリプトと同じ分類（商業施設・モール）
const MALL = /イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/
const BEFORE = [
  /スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/,
  /大学|専門学校|高校|学校|学園|学院|キャンパス|学内/,
]
const txt = p => `${p.title} ${p.place_type ?? ''} ${(p.genres ?? []).join(' ')}`
const malls = live.filter(p => !BEFORE.some(re => re.test(txt(p))) && MALL.test(txt(p)))
console.log('商業施設・モール:', malls.length)
console.log('うち place_type:', JSON.stringify(malls.reduce((a, p) => (a[p.place_type ?? 'null'] = (a[p.place_type ?? 'null'] ?? 0) + 1, a), {})))

// 「毎週決まった曜日」と読めるか。募集要項に曜日の指定があるか数える
const DOW = /月曜|火曜|水曜|木曜|金曜|土曜|日曜|[月火水木金土日]曜|毎週|隔週|第[1-4１-４]/
const fields = p => [p.title, p.description, p.fee, p.schedule, p.notes, p.conditions].filter(Boolean).join(' ')
const withDow = malls.filter(p => DOW.test(fields(p)))
console.log('曜日/毎週の記載がある:', withDow.length, '/', malls.length)
console.log('カラム一覧:', Object.keys(live[0]).join(', '))
console.log('\n-- 商業施設29件の place_type と曜日記載 --')
for (const p of malls) {
  console.log([p.place_type, DOW.test(fields(p)) ? '曜日あり' : '曜日なし', p.prefecture, String(p.title).slice(0, 40)].join(' | '))
}
