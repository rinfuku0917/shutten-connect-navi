import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
async function all(t) { const o = []; for (let f = 0; ; f += 1000) { const { data, error } = await db.from(t).select('*').range(f, f + 999); if (error) throw error; o.push(...data); if (data.length < 1000) break } return o }
const live = (await all('places')).filter(p => p.status === 'published' && !p.closed)
const MALL = /イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/
const BEFORE = [/スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/, /大学|専門学校|高校|学校|学園|学院|キャンパス|学内/]
const txt = p => `${p.title} ${p.place_type ?? ''} ${(p.genres ?? []).join(' ')}`
const malls = live.filter(p => !BEFORE.some(re => re.test(txt(p))) && MALL.test(txt(p)))
console.log('商業施設29件の open_days / open_time / schedule')
let 全曜日 = 0, 一部曜日 = 0, 空 = 0
for (const p of malls) {
  const od = Array.isArray(p.open_days) ? p.open_days : (p.open_days ?? null)
  const n = Array.isArray(od) ? od.length : (od ? String(od).length : 0)
  if (!od || n === 0) 空++
  else if (Array.isArray(od) && od.length >= 7) 全曜日++
  else 一部曜日++
  console.log([String(p.title).slice(0, 28).padEnd(30), 'open_days=' + JSON.stringify(od), 'time=' + (p.open_time ?? '-') + '~' + (p.close_time ?? '-'), 'schedule=' + String(p.schedule ?? '').slice(0, 30)].join(' | '))
}
console.log(`\n曜日の指定なし:${空}  一部の曜日のみ:${一部曜日}  7日すべて:${全曜日}`)
// 時間帯が入っているか
console.log('open_time あり:', malls.filter(p => p.open_time).length, '/', malls.length)
