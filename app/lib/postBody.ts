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
