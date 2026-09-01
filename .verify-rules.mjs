// ルール検証用（読み取りのみ）。extractFaq を全記事の本文に通す。
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'
import { preparePostBody, extractFaq } from './app/lib/postBody.ts'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.trim()).filter(l => l && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

const posts = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('posts').select('slug,title,status,content').range(from, from + 499)
  if (error) { console.error('ERR', error.message); break }
  posts.push(...data)
  if (data.length < 500) break
}
console.log('posts 総数:', posts.length)
console.log('status 内訳:', JSON.stringify(posts.reduce((a, p) => (a[p.status] = (a[p.status] || 0) + 1, a), {})))

for (const p of posts) {
  let raw = await marked.parse(p.content || '')
  raw = raw.split('<table>').join('<div class="table-wrap"><table>')
  raw = raw.split('</table>').join('</table></div>')
  const { html } = preparePostBody(raw)
  const faq = extractFaq(html)
  const hasFaqHeading = /<h[23][^>]*>[^<]*よくある質問/.test(html) || /よくある質問/.test(p.content || '')
  const mark = faq.length ? 'FAQ出力' : (hasFaqHeading ? '本文にFAQ語あるが出力なし' : '—')
  console.log(`\n[${p.status}] /blog/${p.slug}  ${mark}  (${faq.length}問)  ${p.title}`)
  faq.forEach((f, i) => {
    console.log(`   Q${i + 1}: ${f.question}`)
    console.log(`   A${i + 1}: ${f.answer.slice(0, 160)}${f.answer.length > 160 ? ' …[' + f.answer.length + '字]' : ''}`)
  })
  if (!faq.length && hasFaqHeading) {
    const idx = (p.content || '').indexOf('よくある質問')
    console.log('   周辺:', JSON.stringify((p.content || '').slice(Math.max(0, idx - 60), idx + 200)))
  }
}
