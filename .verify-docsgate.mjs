import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local', 'utf8')
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.+)/)[1].trim()
const key = env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)/)[1].trim()
const sb = createClient(url, key)

// 1) 記事4本のDB状態
const { data: posts, error: e1 } = await sb
  .from('posts')
  .select('slug, title, status, published_at, content')
if (e1) { console.log('posts ERROR:', e1.message) }
else {
  console.log('=== posts 一覧 ===')
  for (const p of posts) {
    console.log(`- ${p.slug} | status=${p.status} | published_at=${p.published_at} | 本文${(p.content||'').length}字`)
  }
}

const target = (posts||[]).find(p => p.slug === 'kitchen-car-required-documents')
if (target) {
  const md = fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/docs/blog/kitchen-car-required-documents.md', 'utf8')
  const body = md.split(/^---$/m).slice(2).join('---').trim()
  const dbBody = (target.content || '').trim()
  console.log('\n=== 原稿とDB本文の一致 ===')
  console.log('原稿(front matter除く)長:', body.length, '/ DB長:', dbBody.length, '/ 完全一致:', body === dbBody)

  console.log('\n=== 指摘された2文がDB本文にあるか ===')
  const s1 = '4. **承認されたら応募できる**'
  const s2 = '書類がそろっていないと、その場で応募できません。'
  const s3 = '応募そのものは、書類がそろっていなくてもできます。'
  for (const s of [s1, s2, s3]) {
    console.log(`  DB本文に「${s}」: ${dbBody.includes(s)}`)
  }
  // 「応募できません/できます」まわりを全部拾う
  console.log('\n=== 本文中の「応募」を含む行 ===')
  dbBody.split('\n').forEach((line, i) => {
    if (line.includes('応募')) console.log(`  [${i+1}] ${line.trim()}`)
  })
}

// 2) 他の公開記事が同じ主張をしていないか（横断チェック）
console.log('\n=== 公開中3本に「応募できません」系の記述があるか ===')
for (const p of (posts||[])) {
  if (p.slug === 'kitchen-car-required-documents') continue
  const c = p.content || ''
  const hits = c.split('\n').filter(l => /書類.*応募|応募.*書類|承認.*応募|応募.*承認/.test(l))
  console.log(`--- ${p.slug} (${p.status}) : ${hits.length}件`)
  hits.forEach(h => console.log('   ', h.trim().slice(0, 160)))
}
