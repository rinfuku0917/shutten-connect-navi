import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const { data } = await sb.from('posts').select('slug,title,status,published_at,created_at,updated_at').order('published_at',{ascending:false})
console.log('記事一覧（公開日 / 更新日）')
for (const p of data) {
  const has = (p.updated_at||'').slice(0,10) !== (p.published_at||'').slice(0,10)
  console.log([p.status, (p.published_at||'').slice(0,10), (p.updated_at||'').slice(0,10), has?'←更新あり':'  ', p.slug].join(' | '))
}
