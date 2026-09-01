// 指摘の再検証：extractFaq が「本文に出ているものだけ」を拾うか
// 実物の app/lib/postBody.ts を直接 import する（Node の型ストリップ）
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { marked } from 'marked'
import { preparePostBody, extractFaq } from './app/lib/postBody.ts'

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

// posts を range で全件取る
const posts = []
for (let from = 0; ; from += 500) {
  const { data, error } = await sb.from('posts').select('*').order('slug').range(from, from + 499)
  if (error) { console.error('ERR', error); process.exit(1) }
  posts.push(...data)
  if (data.length < 500) break
}
console.log('posts 全行数:', posts.length)
const statuses = {}
for (const p of posts) statuses[p.status] = (statuses[p.status] ?? 0) + 1
console.log('status 内訳:', statuses)

const published = posts.filter(p => p.status === 'published')
console.log('published 件数:', published.length)

let withFaq = 0
for (const p of published) {
  let raw = await marked.parse(p.content)
  raw = raw.split('<table>').join('<div class="table-wrap"><table>')
  raw = raw.split('</table>').join('</table></div>')
  const { html } = preparePostBody(raw)
  const faq = extractFaq(html)

  // 別方法での数え直し：本文マークダウンから h2「よくある質問」を含む章の h3 を素朴に数える
  const lines = p.content.split('\n')
  let inFaq = false
  const mdQuestions = []
  const allH2 = []
  for (const line of lines) {
    if (/^##\s/.test(line) && !/^###/.test(line)) {
      const t = line.replace(/^##\s*/, '').trim()
      allH2.push(t)
      inFaq = t.includes('よくある質問')
    } else if (inFaq && /^###\s/.test(line)) {
      mdQuestions.push(line.replace(/^###\s*/, '').trim())
    }
  }

  const flagH2 = allH2.filter(t => t.includes('よくある質問'))
  if (faq.length || flagH2.length || mdQuestions.length) {
    withFaq++
    console.log('\n=== ' + p.slug + ' (' + p.title + ')')
    console.log('  「よくある質問」を含む h2:', JSON.stringify(flagH2))
    console.log('  h2 が完全一致「よくある質問」か:', flagH2.map(t => t === 'よくある質問'))
    console.log('  extractFaq の件数:', faq.length, ' / 原稿の h3 件数:', mdQuestions.length)
    faq.forEach((f, i) => {
      const md = mdQuestions[i]
      const same = md === f.question
      console.log(`   Q${i + 1} [本文h3と一致: ${same}] ${f.question}`)
      if (!same) console.log(`        原稿側: ${md}`)
      console.log(`        末尾が？か: ${/[？?]\s*$/.test(f.question)}`)
      console.log(`        A: ${f.answer.slice(0, 60)}...`)
    })
  }
}
console.log('\nFAQ関連の記事数:', withFaq, '/ published', published.length)

// ---- 合成入力での誤爆再現 ----
console.log('\n---- 合成入力テスト ----')
const cases = [
  ['指摘の再現：質問でない h3', '## キッチンカー出店でよくある質問とトラブルの実例\n\n### 雨の日に売れなかった\n\n本文A。\n\n### 電源が足りなかった\n\n本文B。\n'],
  ['h2完全一致・正常系', '## よくある質問\n\n### 質問1ですか？\n\n答え1。\n\n### 質問2ですか？\n\n答え2。\n'],
  ['h3が1問だけ', '## よくある質問\n\n### 質問1ですか？\n\n答え1。\n'],
  ['答えが空', '## よくある質問\n\n### 質問1ですか？\n### 質問2ですか？\n'],
  ['FAQ章が末尾', '## 前段\n\n段落。\n\n## よくある質問\n\n### Q1ですか？\n\nA1。\n\n### Q2ですか？\n\nA2。\n'],
  ['h3見出しのFAQ', '## 章\n\n### よくある質問\n\n### Q1ですか？\n\nA1。\n\n### Q2ですか？\n\nA2。\n'],
  ['章の後にh2が続く（漏れ確認）', '## よくある質問\n\n### Q1ですか？\n\nA1。\n\n### Q2ですか？\n\nA2。\n\n## まとめ\n\n- 箇条書き\n'],
]
for (const [name, md] of cases) {
  const { html } = preparePostBody(await marked.parse(md))
  const faq = extractFaq(html)
  console.log(`\n[${name}] -> ${faq.length}件`)
  faq.forEach(f => console.log('   Q:', f.question, '| A:', f.answer.slice(0, 40)))
}
