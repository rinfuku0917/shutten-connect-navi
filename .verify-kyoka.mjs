import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = Object.fromEntries(
  fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
    .split('\n').filter(l=>l.includes('=')&&!l.trim().startsWith('#')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]})
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1) all posts visible with anon key
const all = []
for (let from=0;;from+=1000){
  const { data, error } = await sb.from('posts').select('id,slug,title,status,published_at,content').range(from, from+999)
  if (error){ console.log('ERR posts:', error.message); break }
  all.push(...data); if (data.length<1000) break
}
console.log('=== posts visible to anon:', all.length)
for (const p of all) console.log(` slug=${p.slug} status=${p.status} pub=${p.published_at} len=${(p.content||'').length}`)

// 2) does the draft exist / is its body reachable anonymously?
const target = all.find(p=>p.slug==='kitchen-car-required-documents')
console.log('\n=== draft row visible anonymously?', !!target)

// 3) how many posts contain the 営業許可 jurisdiction wording
const needles = ['要ることがあります','とは限りません','必要になることがあります','保健所ごと','都道府県をまたぐ']
for (const p of all){
  const c = p.content||''
  const hits = needles.filter(n=>c.includes(n))
  if (hits.length) console.log(` ${p.slug} :: ${hits.join(' / ')}`)
}
