// 記事の本文から、最初の画像を取り出す。
//
// 記事にはサムネイル用のカラムが無く、本文の先頭に置いた画像を
// 一覧のサムネイルとして使っている。トップページの「最新記事」と
// ブログ一覧で同じ画像が出るよう、取り出し方をここにまとめる。
//
// 本文はマークダウンで、画像は ![説明](https://...) の形で入っている。

import { OWN_HOSTS, SITE_URL } from './seo'

// 一覧のサムネイル用に、小さく変換したURLを返す。
//
// 記事一覧もトップページも、96px角のサムネイルに元画像をそのまま使っていた。
// 元は2688pxで1枚1〜3MB。一覧を1回開くだけで15MB以上を読み込んでいた。
// Next の画像変換を通すと、この大きさなら1枚10KB前後で済む。
//
// 許可しているのは next.config.ts の images に書いたホストだけなので、
// それ以外のURLはそのまま返す（変換に出すと400になるため）。
//
// q（品質）は 75 のみ。Next 16 は設定した値以外を 400 で弾く。
// 既定は 75 だけなので、70 などにすると画像が出なくなる。
export function thumbnailUrl(src: string, width = 256): string {
  if (!isOptimizableImage(src)) return src
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=75`
}

// 自サイトの public/covers に置いた表紙かどうか。
//
// 記事本文には https://app.connect-navi.com/covers/... が入ったまま残り、
// ルートへ移った後の記事は https://connect-navi.com/covers/... になる。
// ホストの一覧は app/lib/seo.ts の OWN_HOSTS（next.config.ts の許可と同じ表）。
export function isOwnCover(src: string): boolean {
  try {
    const u = new URL(src)
    return u.protocol === 'https:' && OWN_HOSTS.includes(u.hostname) && u.pathname.startsWith('/covers/')
  } catch {
    return false
  }
}

// Next の画像変換に出してよいURLか。next.config.ts の images に許可したものだけ
export function isOptimizableImage(src: string): boolean {
  return src.includes('.supabase.co/storage/v1/object/public/') || isOwnCover(src)
}

// 自サイトの表紙画像のURLを、いまの正規ドメインにそろえる。
//
// なぜ要るか（2026-09-24）:
//   DB の記事本文には、ドメインを移す前に書いた記事の表紙が
//   https://app.connect-navi.com/covers/... の絶対URLで残っている。
//   そのまま出すと、公開ページのHTMLに旧ドメインが並び（記事15本＋一覧＋トップ）、
//   画像も旧ドメインの308を1回はさんでから届く。
//   /covers/ の中身はどちらのドメインでも同じファイルなので、付け替えて問題ない。
//   DB を書き換えないのは、記事の本文に触らずに済むため（元の記事の記録も残る）。
export function coverOnSiteUrl(src: string): string {
  if (!isOwnCover(src)) return src
  try {
    const u = new URL(src)
    if (u.origin === SITE_URL) return src
    return SITE_URL + u.pathname
  } catch {
    return src
  }
}

// 記事本文の中の表紙画像のURLも、いまの正規ドメインにそろえる。
// 本文をマークダウンから組み立てる前に通す
export function coverHostsOnSiteUrl(content: string): string {
  return content.replace(
    /https:\/\/([a-z0-9.-]+)\/covers\//g,
    (whole, host: string) => (OWN_HOSTS.includes(host) ? `${SITE_URL}/covers/` : whole),
  )
}

export function firstImage(content: string | null | undefined): string | null {
  if (!content) return null
  const md = content.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/)
  // 旧ドメインのままの表紙は、いまの正規ドメインにそろえて返す
  if (md) return coverOnSiteUrl(md[1])
  // 念のため、HTMLの img タグで書かれている場合も拾う
  const html = content.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/)
  return html ? coverOnSiteUrl(html[1]) : null
}
