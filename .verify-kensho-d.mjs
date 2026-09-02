import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = fs.readFileSync('.env.local', 'utf8')
const get = (k) => env.split('\n').find(l => l.startsWith(k + '='))?.slice(k.length + 1).trim()
const supabase = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
const { data, error } = await supabase.from('posts').select('*').eq('slug', 'get-food-truck-offers').limit(1)
if (error) { console.log('ERROR', error.message); process.exit(0) }
const p = data[0]
console.log('列:', Object.keys(p).join(', '))
console.log('status:', p.status, 'title:', p.title)
const bodyKey = ['content','body_md','markdown','body'].find(k => k in p)
console.log('本文列:', bodyKey)
const body = p[bodyKey] ?? ''
const md = fs.readFileSync('docs/blog/get-food-truck-offers.md','utf8')
const mdBody = md.split('---\n').slice(2).join('---\n').trim()
console.log('DB本文と原稿が一致:', body.trim() === mdBody)
console.log('1,386 を含む行:')
body.split('\n').filter(l => l.includes('1,386')).forEach(l => console.log('  ' + l.slice(0,140)))
