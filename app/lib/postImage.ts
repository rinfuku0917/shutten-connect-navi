// 記事の本文から、最初の画像を取り出す。
//
// 記事にはサムネイル用のカラムが無く、本文の先頭に置いた画像を
// 一覧のサムネイルとして使っている。トップページの「最新記事」と
// ブログ一覧で同じ画像が出るよう、取り出し方をここにまとめる。
//
// 本文はマークダウンで、画像は ![説明](https://...) の形で入っている。

// 一覧のサムネイル用に、小さく変換したURLを返す。
//
// 記事一覧もトップページも、96px角のサムネイルに元画像をそのまま使っていた。
// 元は2688pxで1枚1〜3MB。一覧を1回開くだけで15MB以上を読み込んでいた。
// Next の画像変換を通すと、この大きさなら1枚10KB前後で済む。
//
// 許可しているのは next.config.ts の images に書いたホストだけなので、
// それ以外のURLはそのまま返す（変換に出すと400になるため）。
export function thumbnailUrl(src: string, width = 256): string {
  if (!src.includes('.supabase.co/storage/v1/object/public/')) return src
  return `/_next/image?url=${encodeURIComponent(src)}&w=${width}&q=70`
}

export function firstImage(content: string | null | undefined): string | null {
  if (!content) return null
  const md = content.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/)
  if (md) return md[1]
  // 念のため、HTMLの img タグで書かれている場合も拾う
  const html = content.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/)
  return html ? html[1] : null
}
