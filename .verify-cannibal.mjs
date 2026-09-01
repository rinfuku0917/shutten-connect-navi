import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
    .split(/\r?\n/).filter(l=>l.includes('=')&&!l.startsWith('#'))
    .map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// ページングして全件
async function all(table, cols) {
  const out = []
  for (let from=0;;from+=1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from+999)
    if (error) { console.error(table, error.message); break }
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const posts = await all('posts', '*')
console.log('posts 総数:', posts.length)
console.log('カラム:', Object.keys(posts[0]||{}).join(', '))
fs.writeFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.verify-posts.json', JSON.stringify(posts,null,1))

console.log('\n===== 全記事一覧 =====')
posts.forEach((p,i)=>{
  console.log(`${String(i+1).padStart(2)}. slug=${p.slug}`)
  console.log(`    title=${p.title}`)
  console.log(`    category=${p.category}  target_keyword=${JSON.stringify(p.target_keyword)}  status=${p.status??'(なし)'}  published=${p.published??'(なし)'}`)
})
