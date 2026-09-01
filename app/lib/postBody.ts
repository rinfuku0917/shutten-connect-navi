// 記事本文（マークダウンを変換したHTML）を、SEOの決まりに合う形に整える。
//
// ・h1 はページに1つだけにする。記事タイトルが h1 なので、本文中の h1 は h2 に落とす
// ・h2 に id を振り、目次からページ内リンクで飛べるようにする
// ・目次に出す見出しの一覧を取り出す
//
// 見出しの文字から id を作ると日本語がURLエンコードされて読みにくいので、
// 出てきた順の連番（sec-1, sec-2 …）にしている。

export type TocItem = { id: string; text: string }

// タグを取り除いて、目次に出す文字だけにする
function stripTags(html: string): string {
  return html
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

export type FaqItem = { question: string; answer: string }

// 本文の「よくある質問」から、質問と答えの組を取り出す。
//
// 構造化データ（FAQPage）に使う。AGENTS.md のSEOルールで
// 「画面に出していない内容を構造化データにだけ書かない」と決めているため、
// 本文に書いてあるものだけをここから拾う。本文にFAQがなければ空を返す。
//
// 記事の書き方は docs/blog/TEMPLATE.md に合わせている。
//   ## よくある質問   ← この見出しから
//   ### 質問          ← h3 が質問
//   答え…             ← 次の見出しまでが答え
export function extractFaq(html: string): FaqItem[] {
  const head = html.match(/<h2[^>]*>(?:(?!<\/h2>)[\s\S])*?よくある質問(?:(?!<\/h2>)[\s\S])*?<\/h2>/)
  if (!head) return []
  const from = (head.index ?? 0) + head[0].length
  // 次の h2 が来たらFAQの章は終わり
  const rest = html.slice(from)
  const nextH2 = rest.search(/<h2[\s>]/)
  const section = nextH2 === -1 ? rest : rest.slice(0, nextH2)

  const items: FaqItem[] = []
  const re = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[\s>]|$)/g
  for (const m of section.matchAll(re)) {
    const question = stripTags(m[1])
    // 答えは段落をつなげて、1つの文にする
    const answer = stripTags(m[2].replace(/<\/(p|li|div)>/g, ' ')).replace(/\s+/g, ' ').trim()
    if (question && answer) items.push({ question, answer })
  }
  // 1問だけのFAQは構造化データにする意味が薄い
  return items.length >= 2 ? items : []
}

export function preparePostBody(rawHtml: string): { html: string; toc: TocItem[] } {
  // 本文中の h1 を h2 に落とす（ページの h1 は記事タイトルだけにする）
  let html = rawHtml
    .replace(/<h1(\s[^>]*)?>/g, (_m, attr) => `<h2${attr ?? ''}>`)
    .replace(/<\/h1>/g, '</h2>')

  // h2 に連番の id を振りながら、目次の材料を集める
  const toc: TocItem[] = []
  let n = 0
  html = html.replace(/<h2(\s[^>]*)?>([\s\S]*?)<\/h2>/g, (_m, attr: string | undefined, inner: string) => {
    n += 1
    const id = `sec-${n}`
    const text = stripTags(inner)
    if (text) toc.push({ id, text })
    const rest = (attr ?? '').replace(/\sid="[^"]*"/, '')
    return `<h2 id="${id}"${rest}>${inner}</h2>`
  })

  return { html, toc }
}
