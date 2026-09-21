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
- 募集終了（closed=true）の案件も出店実績としてサイトマップに入れ、noindex にしない（2026-09 に変更）。
  ページ上部で終了を知らせ、同じ都道府県の募集中の案件（無ければ /places）へつなぐこと。
  優先度は募集中より低くする。下書き・非公開（status≠published）は入れない
- admin / dashboard / api 配下の Disallow を維持する。公開側を誤って Disallow しない

## 構造化データ（JSON-LD）
- places/[id]：Place ＋ BreadcrumbList。Event にするのは、出店形態がイベント（place_type='event'）で、
  運営が一般の人が来場できる催しと印を付け（places.public_event = true。2026-09 時点で列は未作成）、日程に日付がある案件だけ。
  place_type だけで Event にしない（社内イベント・参加登録の要る学会・学内の営業日・オープンキャンパスなど、
  Google の Event の対象外が event 型に混ざっているため）。
  常設は日付があっても Event にしない（毎日・毎週の営業日の一覧で、催しではないため）。
  Event に offers は付けない（出店料は出店者が払う額で、来場者向けの価格ではないため）。
  Event の organizer に運営会社（株式会社nav / organizationRef()）を入れない（主催は案件ごとの別の団体で、主催者の列は DB に無いため）
- ブログ記事：Article ＋ BreadcrumbList
- トップ：Organization ＋ WebSite ＋ FAQPage（画面の「よくある質問」と同じ一覧から作る）
- Organization の本体はトップにだけ出す。ほかのページで運営会社を指すとき（記事の author・publisher、Service の provider など）は
  `organizationRef()`（app/lib/seo.ts）を使い、Organization を直接書かない。layout に置いて全ページへ重複させない
- 入れる値はDBの実データのみ。レビュー数・評価など存在しない値を創作しない
- 画面に出していない内容を構造化データにだけ書かない（FAQなど）

## 見出し・HTML構造
- h1 は1ページに1つ。ページの主題（案件名・記事タイトル）にする
- 見出し階層を飛ばさない（h2 の中に h3。h1 の直下に h3 を置かない）
- 画像には alt を設定する。案件画像は案件名、装飾画像は `alt=""`

## 内部リンク
- ブログ記事の下部に「関連する出店場所」への内部リンク枠を維持する
- 都道府県での絞り込み一覧から案件詳細への回遊導線を保つ
- 削除した案件・非公開（status≠published）の案件へのリンクを残さない。
  募集終了（closed=true）の案件は実績として検索に出すので、案件一覧などからリンクしてよい（サイトマップにしか無い孤立ページにしない）。
  ただし記事の「関連する出店場所」枠と、終了案件ページの「募集中の出店場所」枠には出さない（応募先を探す人向けの枠のため）

## パフォーマンス
- 画像は next/image を使い width / height を必ず指定する（CLS防止）
- ファーストビュー外は遅延読み込み（next/image の既定に任せる）
- 公開ページに不要なクライアントJSを足さない。`use client` の乱用を避ける

## 禁止
- 公開ページへの noindex 追加（明示の指示がある場合を除く）
- メタデータ・構造化データへのキーワード詰め込み
- 隠しテキスト、自動生成の重複コンテンツなどスパムポリシーに触れる実装

# APIの権限判定ルール

同じ穴が4回見つかっているため、決まりとして残す（2026-09-21）。

- サービスロールキーを使うAPIは `app/lib/apiAuth.ts` の `requireAdmin` / `requireCaller` を通す。
  既存の入口の書き方を真似て、独自のコピーを増やさない
- 呼び出し元のIDを body・formData・クエリから受け取って権限判定に使わない。
  所有を証明できるのは `Authorization: Bearer` のアクセストークンだけ。
  UUIDは失効しないので、一度漏れると恒久的な裏口になる
- 権限の判定は引数の検査より先に行う。権限の無い相手に「slug は必須です」などと返すと、
  入力の当たり外れを教えることになる
- 運用鍵（CRON_SECRET）と併用する入口は、鍵の照合を先に行う。
  順を逆にすると、鍵の生の値がアクセストークンとして Supabase の認証ログに残る
- 役割（profiles.role）の読み取り自体が失敗したときは 403 ではなく 503 を返す。
  「権限が無い」と「いま確かめられない」を混ぜない
- 利用者の入力を `ilike` のパターンに直接渡さない（`%` `_` `*` がワイルドカードとして効く）。
  一致で判定するなら `eq`、`ilike` を使うなら `%` `*` `\` を弾いて `_` を逃がす
