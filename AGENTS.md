<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SEO実装ルール

このプロジェクトはSEO集客を重視する。公開ページを新規作成・改修するときは必ず守ること。
キーワードの設計図は `docs/seo-keywords.md`。記事やカテゴリページを作る前に必ず読む。

## メタデータ（必須）
- 全公開ページに Metadata API で title / description を設定する。設定漏れのページを作らない
- 動的ページ（places/[id]、ブログ記事、sellers/[id]）は generateMetadata で動的生成する
- title の形式
  - 案件詳細：`{案件名}｜{都道府県}のキッチンカー出店場所 - 出店コネクトナビ`
  - ブログ記事：`{記事タイトル} - 出店コネクトナビ`
  - その他：`{ページ名} - 出店コネクトナビ`
- title は `{ absolute: ... }` で指定する。layout の template と二重に付くのを避けるため
- description は120文字前後。動的ページはDBの description から切り出す
- 既存ページの title / description を改修時に削除・上書きしない
- **canonical は必ず自ページを指定する。** layout の `alternates.canonical` を継承すると
  全ページがトップを正規URLと申告してしまう（過去に1,404ページで発生）

## URL設計
- インデックスさせたいページは固有のURLパスを持たせる。クエリパラメータだけの出し分けは不可
- URLは英数字の小文字・ハイフン区切り。日本語URL・アンダースコアは使わない
- 既存の公開URLを変更しない。やむを得ず変えるときは301リダイレクトを設定し sitemap も更新する

## sitemap / robots
- `app/sitemap.ts` は公開ページを網羅する。新しい公開ページ種別を足したらここにも足す
- 募集終了（closed=true）の案件はサイトマップに入れない
- admin / dashboard / api 配下の Disallow を維持する。公開側を誤って Disallow しない

## 構造化データ（JSON-LD）
- places/[id]：Place（または Event）＋ BreadcrumbList
- ブログ記事：Article ＋ BreadcrumbList
- トップ：Organization ＋ WebSite
- 入れる値はDBの実データのみ。レビュー数・評価など存在しない値を創作しない
- 画面に出していない内容を構造化データにだけ書かない（FAQなど）

## 見出し・HTML構造
- h1 は1ページに1つ。ページの主題（案件名・記事タイトル）にする
- 見出し階層を飛ばさない（h2 の中に h3。h1 の直下に h3 を置かない）
- 画像には alt を設定する。案件画像は案件名、装飾画像は `alt=""`

## 内部リンク
- ブログ記事の下部に「関連する出店場所」への内部リンク枠を維持する
- 都道府県での絞り込み一覧から案件詳細への回遊導線を保つ
- 削除・終了した案件へのリンクを残さない

## パフォーマンス
- 画像は next/image を使い width / height を必ず指定する（CLS防止）
- ファーストビュー外は遅延読み込み（next/image の既定に任せる）
- 公開ページに不要なクライアントJSを足さない。`use client` の乱用を避ける

## 禁止
- 公開ページへの noindex 追加（明示の指示がある場合を除く）
- メタデータ・構造化データへのキーワード詰め込み
- 隠しテキスト、自動生成の重複コンテンツなどスパムポリシーに触れる実装
