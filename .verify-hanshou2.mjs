// 「7件」の出どころを特定する。記事の「場所の種類」表が110件を割り切れるか。
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
  const { data, error } = await sb.from('places')
    .select('id,title,prefecture,place_type,status,closed,genres').range(from, from + 999)
  if (error) throw new Error(error.message)
  out.push(...data)
  if (data.length < 1000) break
}
const open = out.filter(p => p.status === 'published' && !p.closed)

console.log('募集中:', open.length)
console.log('\n=== 募集中110件のタイトル一覧（place_type付き） ===')
open.sort((a, b) => (a.place_type || '').localeCompare(b.place_type || '') || a.title.localeCompare(b.title, 'ja'))
open.forEach((p, i) => console.log(`${String(i + 1).padStart(3)} [${p.place_type}] ${p.title}`))

// 「イベント会場」カテゴリで数えたら本当に7件になるのか？（指摘の主張を直接検証）
const g = (p) => Array.isArray(p.genres) ? p.genres : []
console.log('\n=== 指摘の主張「7件は場所カテゴリから取った」の検証 ===')
console.log('genres が null または空の募集中案件:', open.filter(p => g(p).length === 0).length, '/', open.length)
for (const cat of ['イベント会場', 'マルシェ・マーケット', '商業施設', 'スーパーマーケット', '大学・学校', 'オフィス街', '公園・広場']) {
  console.log(`  genres に「${cat}」を含む募集中案件: ${open.filter(p => g(p).includes(cat)).length}件`)
}

// 記事の学校まわりの記述と突き合わせ（平日記事：学校系30件のうち26件が常設）
const schoolRe = /大学|学校|学園|専門|キャンパス|高校|短大|保育|美容専門/
const schools = open.filter(p => schoolRe.test(p.title))
console.log('\n=== 学校らしいタイトルの案件 ===')
console.log('学校らしい件数:', schools.length,
  '／ うち regular:', schools.filter(p => p.place_type === 'regular').length,
  '／ event:', schools.filter(p => p.place_type === 'event').length)

// place_type=event 13件を「会場の種類」で割り振ったらどうなるか
console.log('\n=== place_type=event 13件の会場種別（手で見る） ===')
open.filter(p => p.place_type === 'event').forEach(p => {
  const kind = schoolRe.test(p.title) ? '学校' : 'イベント/その他'
  console.log(`  ${kind.padEnd(12)} | [${p.prefecture}] ${p.title}`)
})
