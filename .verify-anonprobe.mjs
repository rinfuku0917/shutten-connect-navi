// 匿名キーで seller_documents / applications / auth.users が読めるかを確かめる
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('NEXT_PUBLIC_SUPABASE_ANON_KEY')
const sb = createClient(url, key)

console.log('URL:', url)

// 1) 対照群：読めるはずのテーブル
for (const t of ['places', 'posts']) {
  const { data, error, count } = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`[control] ${t}: ${error ? 'ERR ' + error.code + ' ' + error.message : 'OK count=' + count}`)
}

// 2) 本題：読めないと言われているテーブル
for (const t of ['seller_documents', 'applications', 'sellers', 'messages', 'sales']) {
  const r = await sb.from(t).select('*', { count: 'exact', head: true })
  console.log(`[target]  ${t}: ${r.error ? 'ERR ' + r.error.code + ' ' + r.error.message : 'OK count=' + r.count}`)
  // head:false でも試す（RLSで0行になるのか、拒否されるのかを見分ける）
  const r2 = await sb.from(t).select('*').limit(1)
  console.log(`           -> rows: ${r2.error ? 'ERR ' + r2.error.code : (r2.data?.length ?? 0) + '行'}`)
}

// 3) auth.users は PostgREST 経由では露出しない想定
const au = await sb.from('users').select('*').limit(1)
console.log('[target]  public.users:', au.error ? 'ERR ' + au.error.code + ' ' + au.error.message : (au.data?.length ?? 0) + '行')

// 4) 匿名セッションで auth のユーザー情報が取れるか
const { data: u, error: ue } = await sb.auth.getUser()
console.log('[auth]    getUser:', ue ? 'ERR ' + ue.message : JSON.stringify(u?.user))

// 5) doc_type の実データが1件でも読めるか（記事の「6種類」を数字で裏取りできるか）
const dt = await sb.from('seller_documents').select('doc_type, status')
console.log('[doc]     seller_documents doc_type:', dt.error ? 'ERR ' + dt.error.code + ' ' + dt.error.message : JSON.stringify(dt.data))
