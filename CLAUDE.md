# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

---

# 出店コネクトナビ

キッチンカー出店者と募集者（会場・イベント主催）のマッチングプラットフォーム。
本番：https://app.connect-navi.com

## 技術スタック

- **Next.js 16**（App Router）／ React 19 / TypeScript / Tailwind CSS v4
- **Supabase**（DB / Auth / Storage）— project ref: `mieflxcdthcpyrysfahs`
- **Vercel**（Pro・connect-navi チーム）— `git push` で自動ビルド・本番デプロイ
- **Resend**（通知メール）— FROM = `noreply@mail.connect-navi.com`
  ※ `mail.` サブドメインのみ Verified。ルートドメインは未設定なので FROM を変えない
- **Leaflet / react-leaflet**（`PlacesMap`）、**marked**（ブログ本文の Markdown 描画）

## コマンド

```bash
npm run dev              # ローカル開発（http://localhost:3000）
npx tsc --noEmit         # 型チェック（変更後は必ず実行）
npm run lint             # eslint（eslint-config-next）
npm run build            # 本番相当ビルド
```

テストフレームワークは未導入。検証は型チェック＋ビルド＋実画面で行う。

---

## アーキテクチャ

### 画面はほぼ全部クライアントコンポーネント

各ページが `'use client'` で、`app/lib/supabase.ts` のシングルトン anon クライアントを直接 import して DB を叩く。
サーバー側でのデータ取得はほとんど無く、**アクセス制御の実体は RLS ポリシー**にある（後述の落とし穴を参照）。

Supabase クライアントが2系統ある点に注意：

| ファイル | 用途 |
|---|---|
| `app/lib/supabase.ts` | 全画面が使うシングルトン。`@supabase/supabase-js` + ANON_KEY |
| `lib/supabase/client.ts` | `@supabase/ssr` の `createBrowserClient` + PUBLISHABLE_KEY。**現状ほぼ未使用** |

新規コードは既存に合わせて `app/lib/supabase.ts` を使う。移行するなら全画面まとめて。

### 巨大な2画面が機能の大半を持つ

- `app/admin/page.tsx`（約1,650行）— `tab` state 1つで dashboard / places / sellers / csv / place-edit / docs / sales / messages / reviews / imported / publish / blog / applications を出し分ける。選択タブは localStorage に保存。
- `app/dashboard/seller/page.tsx`（約1,270行）— home / applies / calendar / messages / docs / sales / profile。タブは `?tab=` クエリで初期化。

機能追加は原則この中のタブに足す。ファイル分割は指示があるまでしない。

### ルーティングと役割

- `/dashboard` は role を見て `/dashboard/host` か `/dashboard/seller` へクライアントリダイレクトするだけ。
- 募集者側のみ `app/dashboard/host/layout.tsx` でサイドバー付きシェルを持つ。出店者/admin はページ内で自前のサイドバーを描画。
- 募集者ログインで seller が弾かれるのは**正常挙動**。

### API ルート（`app/api/**`）

サービスロールキー（`SUPABASE_SERVICE_ROLE_KEY`）で RLS を迂回する必要がある処理だけがここにある。

- `notify/*` … `new-message` / `new-application` / `application-status` / `new-seller` / `document-rejected`
- `posts`（ブログ CRUD）、`admin/delete-seller`、`upload-image`（blog-images へ）
- `contact`、`line/webhook`、`line/test-push`

**サービスロールを使う API の作法（既存に必ず合わせる）**

1. `createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })`
2. 管理者操作は `requesterId` を受け取り `profiles.role === 'admin'` を DB で照合（`verifyAdmin`）。クライアントの申告を信用しない。
3. 通知系はモジュールスコープの `Map` による冪等ガード（dedupeKey ＋ 10秒）を必ず入れる。
4. 通知系は「DB 上の status とリクエストが一致する時だけ送信」ガードを入れる（不一致は 409）。呼び出し順は **DB 更新 → notify fetch**。

### Storage バケット

`place-images` / `seller-photos` / `seller-documents` / `message-attachments` / `blog-images`

---

## データ構造

ロールは `seller`（出店者）／`host`（募集者）／`admin` の3種、`profiles.role` で判定。

| テーブル | 内容 |
|---|---|
| `places` | 案件本体（282件）。一覧は `.order('pinned', desc).order('posted_at', desc)`。**`created_at` は移行分が全件ほぼ同時刻のため並び替えに使えない** |
| `applications` | 応募。`status` は pending → approved / rejected。**`apply_date` が出店日**（`created_at` ではない） |
| `sales` | 売上。実際に適用した税基準を `tax_basis` / `tax_rate` に保存 |
| `messages` | **`created_at` カラムが存在しない**（`read_at` はある）。並び替え・新着取得には使えない |
| `profiles` / `seller_documents` / `menus` / `sns_links` / `reviews` / `posts` / `case_files` | 各機能 |

### 料金設定（コードだけでは読み取れない業務ロジック）

案件ごとに admin の「料金設定」モーダルで入力する。

- `price_fixed` / `price_share_pct` / `place_fixed_unit` ＝ **取引先の取り分**
- `company_fixed_amount` / `company_fixed_unit` / `company_share_pct` ＝ **弊社の利益**
- `share_tax_basis`（`as_entered` / `tax_excluded`）と `share_tax_rate`（8 or 10）＝ 歩合の計算元
- 端数処理は**切り捨て**に統一

出店者側の表示には**取引先分と弊社分の両方を含める**（過去に弊社分が抜けるバグがあった）。

マイグレーションは `supabase/migrations/`（RLS ハードニング。`public.is_admin()` は SECURITY DEFINER で再帰回避）。

---

## 必ず事前に確認を取ること

以下は勝手に実行せず、**内容と影響範囲を提示して承認を得てから**行う。

1. **本番 Supabase への DELETE / DROP / UPDATE**
   実行前に必ず同条件の `SELECT count(*)` で対象件数を確認し、その数字を提示する。
2. **`git push`**（＝そのまま本番デプロイになる）
3. **環境変数の変更**（変更後は Redeploy が必要。Redeploy まで本番に反映されない）
4. **スキーマ変更**（カラム追加・削除、RLS ポリシーの変更）
5. **通知メールの実送信テスト**
   テストは**自分自身の応募 UUID** を使う。他の出店者に誤送信しない。

## 反映タイミング

- コード変更 → `git push` → Vercel ビルド
- 環境変数の変更 → **Redeploy しないと反映されない**
- DB のデータ変更（画像URL・`posted_at` 等）→ デプロイ不要で即時反映

---

## 実装ルール

- **原因が確定するまで修正コードを書かない。** まず調査（該当ファイル・該当 SQL）を行い、根拠を示してから直す。
- 変更は1つずつ。1回のコミットに複数の修正を混ぜない。
- 変更後は `npx tsc --noEmit` を通してから完了とする。
- 修正が seller / admin など複数画面にまたがる項目（例：`docTypes` と `docTypeLabels`）は**セットで直す**。
- デプロイ後の表示確認は、キャッシュ回避のため `?v=N` を付ける。
- スタイルは既存に合わせてインライン `style` を使う（Tailwind と混在しているが統一作業は指示があるまでしない）。

---

## 既知の落とし穴

- **「コードは正しいのに動かない」の第一容疑者は RLS ポリシーの不足。**
  過去の不具合はほぼ全部これだった（`places` の DELETE、`applications` の admin UPDATE など）。コードを疑う前にポリシーを確認する。

- **`messages` テーブルに `created_at` が無い**（`read_at` はある）。並び替え・新着取得には使えない。

- **notify 系 API は同一処理から複数箇所で叩かれると二重メールになる。** 冪等ガードを必ず入れる（上記 API 作法を参照）。

- **通知メール内のダッシュボード URL が `*.vercel.app` のままの箇所がある**（`app/api/notify/new-message/route.ts` 等）。本番ドメインに触るときは全 notify ルートを横断確認する。

- **try-catch で握りつぶされたエラーは curl で API を直叩きすると生メッセージが見える。**

- Supabase SQL Editor の結果は既定で100行上限。全件は Table Editor の CSV エクスポートか LIMIT / OFFSET で。

---

## 技術的負債・未解決

- **案件画像270件が旧 Xserver の公開URLに直接依存している。旧サーバー解約前に Supabase Storage への移行が必須。**（最優先）
- 出店者ダッシュボードのカレンダーはダミー実装（2026年6月固定・前後月ボタン無効）
- 誤パスのフォルダが残存：`app/login/login./`、`app/register/registre/`
- 旧サイトからの 301 リダイレクト設計が未着手
- DMARC は `p=none`。新ドメインのレピュテーション不足で迷惑メール判定あり。安定後 `p=quarantine` へ引き上げ予定
- 平安女学院の固定額（取引先5,000／弊社5,000）を残すか0にして歩合15%のみにするか未決
- 税の扱いを出店者自身が選べる仕様のため、最安（税抜10%）を選ぶ余地がある

---

## 出力スタイル

前置きを省き、**結論 → 手順**の順で短く。長い説明が必要なときは最後に3行でまとめる。
