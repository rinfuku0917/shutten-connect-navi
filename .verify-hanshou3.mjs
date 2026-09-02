// 記事の「場所の種類」表（合計110）を、生データから再現できるか検証する。
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const out = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('places').select('id,title,prefecture,place_type,status,closed').range(from, from + 999)
  if (error) throw new Error(error.message)
  out.push(...data); if (data.length < 1000) break
}
const open = out.filter(p => p.status === 'published' && !p.closed)

// 会場の種類による分類（place_type とは別の軸）。上から順に最初に当たったものを採用。
const rules = [
  ['スーパー・食品店',     /Olympic|ドン・キホーテ|サンユーストアー|さがみや|スーパー|ガッツ/i],
  ['学校・専門学校・大学', /大学|学校|学園|学院|キャンパス|短期大学/],
  ['商業施設・モール',     /イオン|Ario|アリオ|モール|ショッピング|ステラタウン|そよら|ペリエ|ワールドポーターズ|プラザ/i],
  ['ゴルフ場・レジャー施設', /ゴルフ/],
  ['オフィス・事業所',     /株式会社|TOTO|レゾナック/],
  ['イベント・お祭り',     /祭|フェア|フリマ|マルシェ|EXPO|フェス/i],
]
const buckets = {}
const unmatched = []
for (const p of open) {
  const hit = rules.find(([, re]) => re.test(p.title))
  const k = hit ? hit[0] : 'その他'
  ;(buckets[k] ||= []).push(p.title)
  if (!hit) unmatched.push(p.title)
}

console.log('=== 会場の種類で110件を機械分類した結果 vs 記事の表 ===')
const article = {
  'スーパー・食品店': 35, '学校・専門学校・大学': 30, '商業施設・モール': 29,
  'イベント・お祭り': 7, 'オフィス・事業所': 5, 'ゴルフ場・レジャー施設': 2, 'その他': 2,
}
let total = 0
for (const k of Object.keys(article)) {
  const n = (buckets[k] || []).length
  total += n
  console.log(`  ${k.padEnd(22)} 再現=${String(n).padStart(3)}  記事=${String(article[k]).padStart(3)}  ${n === article[k] ? '一致' : '差 ' + (n - article[k])}`)
}
console.log('  再現の合計:', total, '／ 記事の表の合計:', Object.values(article).reduce((a, b) => a + b, 0))
console.log('\nどのルールにも当たらなかったもの:', unmatched)

console.log('\n=== 会場の種類 × place_type のクロス集計（軸が別物であることの確認） ===')
const cross = {}
for (const p of open) {
  const hit = rules.find(([, re]) => re.test(p.title))
  const k = hit ? hit[0] : 'その他'
  cross[k] ||= { regular: 0, event: 0 }
  cross[k][p.place_type]++
}
console.table(cross)
const evTotal = Object.values(cross).reduce((a, b) => a + b.event, 0)
console.log('place_type=event の合計:', evTotal, '（＝13なら、イベントは複数の会場種別に散らばっている）')
