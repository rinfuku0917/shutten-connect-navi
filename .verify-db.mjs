import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const env = fs.readFileSync('.env.local', 'utf8')
const get = k => {
  const m = env.match(new RegExp('^' + k + '=(.*)$', 'm'))
  return m ? m[1].trim().replace(/^["']|["']$/g, '') : null
}
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const sb = createClient(url, key)

// posts の1行を取って列名を見る
const { data, error } = await sb.from('posts').select('*').limit(1)
if (error) {
  console.log('posts select error:', error.message)
} else if (data && data[0]) {
  console.log('=== posts テーブルの列名 ===')
  console.log(Object.keys(data[0]).sort())
  console.log('')
  console.log('data_snapshot 列は存在するか:', Object.keys(data[0]).includes('data_snapshot'))
}

// data_snapshot を名指しで選んでみる（存在しなければエラーになる）
const probe = await sb.from('posts').select('slug,data_snapshot').limit(1)
console.log('')
console.log('=== data_snapshot 列を名指しで select ===')
console.log(probe.error ? 'エラー: ' + probe.error.message : JSON.stringify(probe.data))

// 全記事の meta_description / content の文字数
let all = []
for (let from = 0; ; from += 1000) {
  const r = await sb.from('posts').select('slug,status,title,meta_description,content').range(from, from + 999)
  if (r.error) { console.log('err', r.error.message); break }
  all = all.concat(r.data)
  if (r.data.length < 1000) break
}
console.log('')
console.log('=== posts 全' + all.length + '件の文字数（公開・下書きとも） ===')
const rows = all.map(p => ({
  slug: p.slug,
  status: p.status,
  md: p.meta_description ? [...p.meta_description].length : 0,
  body: p.content ? [...p.content].length : 0,
})).sort((a, b) => a.md - b.md)
for (const r of rows) {
  const flagMd = r.md === 0 ? '  ←meta空' : r.md < 100 ? '  ←100未満' : r.md > 130 ? '  ←130超' : ''
  const flagBody = r.body < 1500 ? ' ←1500未満(現行警告が鳴る)' : r.body < 3500 ? ' ←3500未満(ルール下限割れ)' : ''
  console.log(`  md=${String(r.md).padStart(4)} body=${String(r.body).padStart(5)} ${r.status.padEnd(10)} ${r.slug}${flagMd}${flagBody}`)
}
console.log('')
const pub = rows.filter(r => r.status === 'published')
console.log('公開記事 ' + pub.length + '件のうち')
console.log('  meta_description が100未満:', pub.filter(r => r.md > 0 && r.md < 100).length)
console.log('  meta_description が130超  :', pub.filter(r => r.md > 130).length)
console.log('  本文が1500未満(現行警告)  :', pub.filter(r => r.body < 1500).length)
console.log('  本文が3500未満(ルール下限):', pub.filter(r => r.body < 3500).length)

// 対象記事の実際のDB上の値
const target = all.find(p => p.slug === 'food-truck-fee-guide')
console.log('')
console.log('=== food-truck-fee-guide のDB実値 ===')
console.log('status:', target.status)
console.log('meta_description 文字数:', [...target.meta_description].length)
console.log('content 文字数:', [...target.content].length)
