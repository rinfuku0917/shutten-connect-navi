// 検索エンジン向けの共通設定。
//
// これまで全ページが app/layout.tsx の同じ title・description を使っていたため、
// Google から見るとどのページも同じ内容に見えていた。
// ページごとに固有の見出しを出せるよう、ここに共通の値を置く。

// サイトの正規URL（末尾スラッシュなし）。
//
// 本番は今 app.connect-navi.com だが、旧 WordPress の connect-navi.com（ルート）へ
// 移る予定がある。canonical・サイトマップ・メール本文のリンクなどが
// ドメインを直書きしていると、切り替え当日に何十か所も書き換えることになり、
// 漏れた所が古いドメインを指したまま残る。
// そこで Vercel の環境変数 NEXT_PUBLIC_SITE_URL の1か所から読む。
// 未設定なら今の本番の値にしておき、切り替えの日まで見た目も canonical も変えない。
//
// NEXT_PUBLIC_ を付けているのは、会員登録画面などブラウザ側のコードでも
// 同じ値を使うため。この値はビルド時に埋め込まれるので、変えたら再デプロイが要る。
// process.env.NEXT_PUBLIC_SITE_URL は変数に入れずにこの形で書く
// （別の書き方にすると Next がブラウザ向けに値を埋め込まない）。
const DEFAULT_SITE_URL = 'https://app.connect-navi.com'

function resolveSiteUrl(raw: string | undefined): string {
  const value = (raw ?? '').trim()
  if (!value) return DEFAULT_SITE_URL
  // 末尾のスラッシュは取り除く。`${SITE_URL}/places` が `//places` になるのを防ぐ
  const trimmed = value.replace(/\/+$/, '')
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error(`NEXT_PUBLIC_SITE_URL が URL として読めません: ${value}`)
  }
  // 手元での確認用に http://localhost だけは許す。それ以外は https でなければ
  // canonical が http を指してしまい、検索エンジンに別ページと見なされる
  const isLocal = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')
  if (url.protocol !== 'https:' && !isLocal) {
    throw new Error(`NEXT_PUBLIC_SITE_URL は https:// で始めてください: ${value}`)
  }
  // パス・クエリ付きで設定されると、全ページの URL がずれる。ドメインだけを受け付ける
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    throw new Error(`NEXT_PUBLIC_SITE_URL にはドメインまで（例: https://connect-navi.com）を書いてください: ${value}`)
  }
  // 誤った値のまま動かすより、ビルドを止めて気づけるほうがよい。
  // Vercel はビルドに失敗すると直前のデプロイを出し続けるので、サイトは止まらない
  return url.origin
}

export const SITE_URL = resolveSiteUrl(process.env.NEXT_PUBLIC_SITE_URL)
export const SITE_HOST = new URL(SITE_URL).host
export const SITE_NAME = '出店コネクトナビ'

// 自サイトとして扱うホスト。
//
// 記事本文（DB の posts.content）には、表紙画像が
// https://app.connect-navi.com/covers/... の絶対URLで入ったまま残る。
// ルートへ移った後に書く記事は https://connect-navi.com/covers/... になる。
// どちらも自サイトの画像として縮小配信の対象にするため、両方を並べておく。
// SITE_URL が別のドメインに設定されたときも受け付けるよう、そのホストも足す。
export const OWN_HOSTS: string[] = Array.from(new Set([
  'app.connect-navi.com',
  'connect-navi.com',
  new URL(SITE_URL).hostname,
]))

// 会社情報（app/company/page.tsx の表記に合わせる）
export const ORG = {
  name: '株式会社nav',
  serviceName: SITE_NAME,
  url: SITE_URL,
}

// 運営会社を構造化データの中で指すときの識別子。
//
// 会社の詳しい情報（ロゴ・説明）はトップページに1回だけ出し、
// ほかのページ（記事の author・publisher、呼びたい方向けページの provider など）は
// この @id で同じ会社だと示す。
// 案件の Event の organizer には使わない。organizer は催しの主催者で、運営会社ではないため。
// 全ページの layout に Organization を丸ごと置かないのは、Google が会社の情報を
// トップ（または会社概要）で読む前提で、全ページに同じ塊を出しても得がなく、
// トップでは二重に出てしまうため。
export const ORG_ID = `${SITE_URL}/#organization`

// 他の構造化データの中に入れる、運営会社への参照。
// @id だけだと、それ単体を検査するツールで名前が空と出るので、名前と URL も添える
export function organizationRef() {
  return { '@type': 'Organization', '@id': ORG_ID, name: ORG.name, url: SITE_URL }
}

// 構造化データ（JSON-LD）を安全に埋め込むための文字列化。
// タイトルなどに "</script>" が入っていてもタグが閉じないよう "<" を退避する。
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}

// パンくずの構造化データ。画面にもパンくずを出しているページでだけ使う。
export function breadcrumbJsonLd(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: SITE_URL + it.path,
    })),
  }
}

// SNSで共有したときに出る既定の画像。
// ページ側で openGraph を書くと layout の既定は引き継がれず置き換わるので、
// 画像を持たないページでは必ずこれを明示する。
export const OG_DEFAULT_IMAGE = '/og-default.jpg'
