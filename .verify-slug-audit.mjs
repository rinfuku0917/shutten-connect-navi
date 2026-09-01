import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 全 posts を range で回収（1000行打ち切り対策）
let all = [], from = 0
for (;;) {
  const { data, error } = await sb.from('posts')
    .select('id,slug,title,status,category,excerpt,meta_description,content,published_at,updated_at,target_keyword')
    .order('slug').range(from, from + 499)
  if (error) { console.error('ERR', error); process.exit(1) }
  all = all.concat(data)
  if (data.length < 500) break
  from += 500
}
console.log('posts total:', all.length)
console.log('published  :', all.filter(p => p.status === 'published').length)

// slug に fee を含むもの全部
console.log('\n=== slug に "fee" を含む記事 ===')
for (const p of all.filter(p => p.slug.includes('fee'))) {
  console.log(`- ${p.slug} [${p.status}] cat=${p.category} title="${p.title}"`)
}

const targets = all.filter(p => /^host-fee-setting-guide/.test(p.slug))
const terms = ['出店料', '料金', '相場', '円', '手数料', '歩合', '賃料', '使用料',
               '設定', '価格', 'いくら', '売上', '満足度', '滞在時間', '話題', '集客', '導入']

for (const p of targets) {
  console.log(`\n================ ${p.slug} ================`)
  console.log('status  :', p.status)
  console.log('title   :', p.title)
  console.log('category:', p.category)
  console.log('keyword :', p.target_keyword)
  console.log('excerpt :', p.excerpt)
  console.log('metadesc:', p.meta_description)
  console.log('pub/upd :', p.published_at, '/', p.updated_at)
  console.log('本文の長さ:', p.content.length)
  const c = p.content
  console.log('--- 語の出現回数（本文のみ） ---')
  for (const t of terms) {
    const n = c.split(t).length - 1
    if (n > 0) console.log(`  ${t}: ${n}`)
  }
  console.log('--- 見出し一覧 ---')
  for (const line of c.split('\n')) {
    if (/^#{1,4}\s/.test(line)) console.log('  ' + line.trim())
  }
  console.log('--- 冒頭400字 ---')
  console.log(c.slice(0, 400).replace(/\n/g, ' / '))
}
