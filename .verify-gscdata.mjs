import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
const env = Object.fromEntries(fs.readFileSync('/Users/hidekifukusada/Desktop/コネクトナビ/shutten-connect-navi/.env.local','utf8')
  .split('\n').filter(l=>l.includes('=')).map(l=>{const i=l.indexOf('=');return [l.slice(0,i).trim(), l.slice(i+1).trim()]}))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// 1) PostgREST の OpenAPI から、匿名キーで見えるテーブル一覧を取る
const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/', {
  headers: { apikey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, Authorization: 'Bearer ' + env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
})
const spec = await r.json()
const tables = Object.keys(spec.definitions || spec.components?.schemas || {})
console.log('=== 匿名キーで見えるテーブル ===')
console.log(tables.join('\n'))

console.log('\n=== 検索データっぽい名前のテーブル ===')
const hits = tables.filter(t=>/search|query|impress|click|rank|position|analytic|gsc|console|traffic|metric|stat|view|pageview|session/i.test(t))
console.log(hits.length ? hits.join('\n') : '(該当なし)')
