import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const slugs = ['renting-parking-space', 'food-truck-fee-guide', 'kitchen-car-location-guide', 'kitchen-car-required-documents']

for (const slug of slugs) {
  const { data, error } = await sb.from('posts')
    .select('slug,title,status,category,target_keyword,meta_description,excerpt,content,published_at,updated_at')
    .eq('slug', slug).maybeSingle()
  if (error) { console.log(slug, 'ERROR', error.message); continue }
  if (!data) { console.log(slug, 'NOT FOUND (匿名キーでは見えない=下書きの可能性)'); continue }
  const body = data.content || ''
  const count = (s, k) => (s.split(k).length - 1)
  const chars = body.replace(/\s/g, '').length
  console.log('=====', slug)
  console.log(' status:', data.status, '| category:', data.category)
  console.log(' title :', data.title)
  console.log(' kw    :', JSON.stringify(data.target_keyword))
  console.log(' meta  :', (data.meta_description || '').slice(0, 60) + '...')
  console.log(' 本文字数(空白除く):', chars)
  for (const k of ['空き駐車場', '活用', '遊休', '空き', '駐車場', 'キッチンカー', '出店料', '貸す', '貸し']) {
    console.log(`   本文「${k}」: ${count(body, k)}  / タイトル: ${count(data.title, k)} / meta: ${count(data.meta_description || '', k)} / excerpt: ${count(data.excerpt || '', k)}`)
  }
  // md と DB 本文の一致確認
  const p = `docs/blog/${slug}.md`
  if (fs.existsSync(p)) {
    const md = fs.readFileSync(p, 'utf8')
    const mdBody = md.replace(/^---[\s\S]*?\n---\n/, '').trim()
    console.log(' md本文とDB本文が一致:', mdBody.replace(/\s/g, '') === body.trim().replace(/\s/g, ''))
  }
}

// 「空き駐車場」「活用」を含む他の記事がないか（カニバリ確認）
const { data: all } = await sb.from('posts').select('slug,title,status,target_keyword,content').range(0, 999)
console.log('\n===== 全記事:', all?.length)
for (const p of all || []) {
  const hits = ['空き駐車場', '遊休', '活用'].filter(k => (p.content || '').includes(k) || (p.title || '').includes(k))
  if (hits.length) console.log(` ${p.status} ${p.slug} :: ${p.title} :: hit=${hits.join(',')} :: kw=${JSON.stringify(p.target_keyword)}`)
}
console.log('\n--- target_keyword 一覧 ---')
for (const p of all || []) console.log(` ${p.status}\t${p.slug}\t${JSON.stringify(p.target_keyword)}`)
