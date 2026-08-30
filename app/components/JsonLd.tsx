import { jsonLdString } from '../lib/seo'

// 構造化データ（JSON-LD）をページに埋め込む。
// 検索エンジンに「これは何のページか」を機械が読める形で伝えるためのもの。
// 画面には何も表示されない。

export default function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type='application/ld+json'
      dangerouslySetInnerHTML={{ __html: jsonLdString(data) }}
    />
  )
}
