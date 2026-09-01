// 検索エンジン向けの共通設定。
//
// これまで全ページが app/layout.tsx の同じ title・description を使っていたため、
// Google から見るとどのページも同じ内容に見えていた。
// ページごとに固有の見出しを出せるよう、ここに共通の値を置く。

export const SITE_URL = 'https://app.connect-navi.com'
export const SITE_NAME = '出店コネクトナビ'

// 会社情報（app/company/page.tsx の表記に合わせる）
export const ORG = {
  name: '株式会社nav',
  serviceName: SITE_NAME,
  url: SITE_URL,
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
