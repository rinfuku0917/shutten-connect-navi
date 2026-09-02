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

// 本文の画像を、軽くしてから表示するように書き換える。
//
// もともとは Supabase のストレージのURLをそのまま img に入れており、
// 2688px の写真を760pxの幅で表示していた。1枚1〜3MB、公開記事ぶんで32MB。
// スマホで記事を開くと、これを毎回まるごとダウンロードしていた。
//
// Next の画像変換（/_next/image）を通すと、表示する幅に合わせて縮め、
// WebP で配信してくれる。ホストの許可は next.config.ts の images に書いてある。
//
// あわせて width と height を入れる。これが無いと、読み込むまで高さが0で、
// 画像が出た瞬間に本文が下へ飛ぶ（読んでいる行を見失う）。
// 大きさは app/lib/postImageSizes.ts に記録してある。一覧に無い画像は
// これまでどおり大きさ無しで出す（表示は崩れない）。
//
// 1枚目だけは先に読み込む。記事の先頭にあり、最初に目に入る絵だから。
// 2枚目以降は画面に近づいてから読み込む。

// 記事本文の幅は760px。画面の細かい端末に合わせて3段階だけ用意する
const WIDTHS = [828, 1200, 1920]
const SIZES = '(max-width: 800px) 100vw, 760px'

function optimized(src: string, w: number): string {
  return `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`
}

function rewriteImages(html: string, sizes: Record<string, { w: number; h: number }>): string {
  let n = 0
  return html.replace(/<img\s([^>]*?)src="(https:\/\/[^"]+)"([^>]*?)>/g, (whole, before: string, src: string, after: string) => {
    // 変換の対象は許可したホストだけ。それ以外はそのまま返す
    if (!src.includes('.supabase.co/storage/v1/object/public/') && !src.includes('app.connect-navi.com/covers/')) return whole
    n += 1
    const rest = (before + after).trim()
    const size = sizes[src]
    const dim = size ? ` width="${size.w}" height="${size.h}"` : ''
    const srcset = WIDTHS.map(w => `${optimized(src, w)} ${w}w`).join(', ')
    const loading = n === 1
      ? ' loading="eager" fetchpriority="high"'
      : ' loading="lazy" decoding="async"'
    return `<img ${rest} src="${optimized(src, 1200)}" srcset="${srcset}" sizes="${SIZES}"${dim}${loading}>`
  })
}

export function preparePostBody(
  rawHtml: string,
  imageSizes: Record<string, { w: number; h: number }> = {},
): { html: string; toc: TocItem[] } {
  // 本文中の h1 を h2 に落とす（ページの h1 は記事タイトルだけにする）
  let html = rawHtml
    .replace(/<h1(\s[^>]*)?>/g, (_m, attr) => `<h2${attr ?? ''}>`)
    .replace(/<\/h1>/g, '</h2>')

  html = rewriteImages(html, imageSizes)

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
