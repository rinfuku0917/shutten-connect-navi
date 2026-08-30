// 記事の本文から、最初の画像を取り出す。
//
// 記事にはサムネイル用のカラムが無く、本文の先頭に置いた画像を
// 一覧のサムネイルとして使っている。トップページの「最新記事」と
// ブログ一覧で同じ画像が出るよう、取り出し方をここにまとめる。
//
// 本文はマークダウンで、画像は ![説明](https://...) の形で入っている。

export function firstImage(content: string | null | undefined): string | null {
  if (!content) return null
  const md = content.match(/!\[[^\]]*\]\((https:\/\/[^)\s]+)\)/)
  if (md) return md[1]
  // 念のため、HTMLの img タグで書かれている場合も拾う
  const html = content.match(/<img[^>]+src=["'](https:\/\/[^"']+)["']/)
  return html ? html[1] : null
}
