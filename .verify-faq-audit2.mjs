// 2回目：件数を別の方法で数え直す＋提案された直し方を当ててみる
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

// 件数を count で数え直す（range で取った16件と合うか）
const all = await sb.from('posts').select('id', { count: 'exact', head: true })
const pub = await sb.from('posts').select('id', { count: 'exact', head: true }).eq('status', 'published')
console.log('posts 全体 count:', all.count, '/ published count:', pub.count)

// range で slug を全部並べる
const slugs = []
for (let from = 0; ; from += 200) {
  const { data } = await sb.from('posts').select('slug,status,published_at').order('published_at').range(from, from + 199)
  slugs.push(...data)
  if (data.length < 200) break
}
console.log('取得した slug 数:', slugs.length)
slugs.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. ${s.status} ${s.slug}`))

// 提案された2つの直し方を当てて、既存記事が素通しできるか
function faqExactH2(html) {
  const m = html.match(/<h2[^>]*>((?:(?!<\/h2>)[\s\S])*?)<\/h2>/g) || []
  const hit = m.find(h => h.replace(/<[^>]*>/g, '').trim() === 'よくある質問')
  if (!hit) return []
  return extractFaq(html) // 章の抽出自体は同じなので件数だけ見る
}

let a = 0, b = 0, base = 0
for (const s of slugs.filter(x => x.status === 'published')) {
  const { data: p } = await sb.from('posts').select('content,slug').eq('slug', s.slug).single()
  let raw = await marked.parse(p.content)
  raw = raw.split('<table>').join('<div class="table-wrap"><table>')
  raw = raw.split('</table>').join('</table></div>')
  const { html } = preparePostBody(raw)
  const cur = extractFaq(html)
  if (!cur.length) continue
  base++
  const A = faqExactH2(html)
  const B = cur.filter(f => /[？?]\s*$/.test(f.question))
  if (A.length >= 2) a++
  if (B.length >= 2) b++
  console.log(`\n${p.slug}: 現状 ${cur.length}件 / 案A(h2完全一致) ${A.length}件 / 案B(？終わり) ${B.length}件`)
}
console.log(`\nFAQPage が出る記事: 現状 ${base} / 案A ${a} / 案B ${b}`)

// 案B の副作用テスト：サイト内の別FAQ（app/lib/faq.ts）は「。」終わりの質問文
const houseStyle = ['見積りは無料ですか。', '費用を抑えるにはどうすればよいですか。']
console.log('\n案B を当てたときに落ちる、社内の既存FAQ文体:',
  houseStyle.filter(q => !/[？?]\s*$/.test(q)))

// 案A の副作用テスト：テンプレを少し外した見出しが黙って無反応になるか
const variants = ['## よくある質問', '## よくある質問（出店料）', '## 出店料のよくある質問', '## よくある質問 ']
for (const h of variants) {
  const md = `${h}\n\n### Q1ですか？\n\nA1。\n\n### Q2ですか？\n\nA2。\n`
  const { html } = preparePostBody(await marked.parse(md))
  console.log(`  ${JSON.stringify(h)} -> 現状 ${extractFaq(html).length}件 / 案A ${faqExactH2(html).length}件`)
}
