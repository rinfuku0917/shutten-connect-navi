import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
const env = Object.fromEntries(fs.readFileSync('.env.local','utf8').split('\n').filter(l=>l.includes('=')).map(l=>[l.slice(0,l.indexOf('=')).trim(), l.slice(l.indexOf('=')+1).trim()]))
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const {data} = await sb.from('posts').select('*').eq('slug','food-truck-fee-guide').maybeSingle()
console.log('title:', data.title)
console.log('target_keyword:', data.target_keyword)
console.log('meta_description:', data.meta_description)
console.log('excerpt:', data.excerpt)
console.log('保険 in meta_description?', (data.meta_description||'').includes('保険'))
console.log('保険 in excerpt?', (data.excerpt||'').includes('保険'))
console.log('保険 in title?', data.title.includes('保険'))
const body = data.content
console.log('\ntotal 保険 mentions in body:', (body.match(/保険/g)||[]).length)
console.log('body char count:', body.length)
// where does the sentence sit relative to headings
const lines = body.split('\n')
let lastH = ''
lines.forEach((l,i)=>{ if(/^#{2,3} /.test(l)) lastH=l.trim(); if(l.includes('どちらも1年更新')) console.log('\nsentence sits under heading:', lastH, '(line', i+1, 'of', lines.length+')') })
