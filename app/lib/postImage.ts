// 記事の本文から、最初の画像を取り出す。
//
// 記事にはサムネイル用のカラムが無く、本文の先頭に置いた画像を
// 一覧のサムネイルとして使っている。トップページの「最新記事」と
// ブログ一覧で同じ画像が出るよう、取り出し方をここにまとめる。
//
// 本文はマークダウンで、画像は ![説明](https://...) の形で入っている。

import { OWN_HOSTS } from './seo'

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

export function firstImage(content: string | null | undefined): string | null {
  if (!content) return null
  const md = content.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/)
  if (md) return md[1]
  // 念のため、HTMLの img タグで書かれている場合も拾う
  const html = content.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/)
  return html ? html[1] : null
}
