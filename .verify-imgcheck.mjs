import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

const env = fs.readFileSync('.env.local', 'utf8')
const get = k => (env.match(new RegExp('^' + k + '=(.*)$', 'm')) || [])[1]?.trim()
const sb = createClient(get('NEXT_PUBLIC_SUPABASE_URL'), get('NEXT_PUBLIC_SUPABASE_ANON_KEY'))

// posts は少数なのでrangeで全件回す
let rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb.from('posts').select('*').range(from, from + 999)
  if (error) { console.error('ERR', error); break }
  rows = rows.concat(data)
  if (data.length < 1000) break
}

console.log('posts total:', rows.length)
for (const p of rows) {
  const c = p.content || ''
  const mdImgs = [...c.matchAll(/!\[([^\]]*)\]\(([^)\s]+)\)/g)]
  const htmlImgs = [...c.matchAll(/<img[^>]+src=["']([^"']+)["']/g)]
  const firstHttps = c.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/)
  console.log('---')
  console.log('slug:', p.slug, '| status:', p.status, '| len:', c.length)
  console.log('  cover_emoji:', JSON.stringify(p.cover_emoji))
  console.log('  md images:', mdImgs.length, mdImgs.map(m => m[2]))
  console.log('  html images:', htmlImgs.length, htmlImgs.map(m => m[1]))
  console.log('  firstImage(https md):', firstHttps ? firstHttps[1] : null)
  // 先頭200文字（画像が冒頭にあるか）
  console.log('  head:', JSON.stringify(c.slice(0, 160)))
  // 画像に関する断り書きがないか
  const notes = [...c.matchAll(/.{0,60}(画像|写真|イメージ|図).{0,60}/g)].map(m => m[0])
  console.log('  mentions(画像/写真/図):', notes.length)
  notes.slice(0, 8).forEach(n => console.log('     *', JSON.stringify(n)))
}
