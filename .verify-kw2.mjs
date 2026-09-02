import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync(new URL('.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 「空き駐車場」「活用」で競合しうる既存記事
for (const slug of ['vacant-space-food-truck', 'host-fee-setting-guide2', 'host-fee-setting-guide', 'regular-event-schedule']) {
  const { data } = await sb.from('posts').select('slug,title,status,category,target_keyword,meta_description,content').eq('slug', slug).maybeSingle()
  if (!data) { console.log(slug, 'NOT FOUND'); continue }
  const b = data.content || ''
  const c = (s, k) => s.split(k).length - 1
  console.log('=====', slug, '|', data.status, '|', data.category)
  console.log(' title:', data.title)
  console.log(' kw   :', JSON.stringify(data.target_keyword))
  console.log(' meta :', (data.meta_description || '').slice(0, 80))
  console.log(' 字数 :', b.replace(/\s/g, '').length)
  for (const k of ['空き駐車場', '空き', '活用', '遊休', '駐車場', '貸す']) console.log(`   ${k}: 本文${c(b, k)} / タイトル${c(data.title, k)} / meta${c(data.meta_description || '', k)}`)
  const heads = b.split('\n').filter(l => /^#{1,3} /.test(l))
  console.log(' 見出し:', heads.slice(0, 20).join(' | '))
}

// 全記事で「駐車場」を扱っている本数（重複リスク）
const { data: all } = await sb.from('posts').select('slug,title,status,content').range(0, 999)
console.log('\n--- 本文に「駐車場」が5回以上出る記事 ---')
for (const p of all || []) {
  const n = (p.content || '').split('駐車場').length - 1
  if (n >= 5) console.log(` ${p.status}\t${n}回\t${p.slug}\t${p.title}`)
}
