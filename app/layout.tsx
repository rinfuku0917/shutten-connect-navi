import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { GoogleAnalytics } from "@next/third-parties/google";
import HashScroll from "./components/HashScroll";
import { SITE_NAME, SITE_URL } from "./lib/seo";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // 相対パスの canonical・OG画像を絶対URLに直すための基準
  metadataBase: new URL(SITE_URL),
  title: {
    // 子ページが title を指定しなかったときに使う見出し
    default: "キッチンカーの手配・派遣と出店場所探し｜出店コネクトナビ",
    // 子ページの title の後ろに付ける
    template: `%s｜${SITE_NAME}`,
  },
  description:
    "イベント・商業施設・オフィスへのキッチンカーの手配と、キッチンカー事業者の出店場所探しをつなぐマッチングサービス。ご相談は無料です。",
  // canonical はページごとに指定する。ここに置くと、指定していないページが
  // すべて「正規URLはトップ」と申告してしまう（過去に1,404ページで発生）。
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ja_JP",
    url: SITE_URL,
    // SNSで共有したときに出る画像。ページ側で上書きできる。
    // 無いとカードが文字だけになるので、既定を必ず持たせておく。
    images: [{ url: "/og-default.jpg", width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: { card: "summary_large_image" },
  // Google Search Console の所有権確認タグ。
  // 消すと所有者確認が外れるので残しておくこと。
  // 別のコードに差し替えたいときは、Vercel の環境変数
  // GOOGLE_SITE_VERIFICATION を設定すればそちらが使われる。
  verification: {
    google:
      process.env.GOOGLE_SITE_VERIFICATION ||
      "rIIXLOS5VjasmJlsGubBBt_j5FaZsva8jdrB9hltZcI",
  },
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Google アナリティクスの測定ID。Vercel の環境変数
  // NEXT_PUBLIC_GA_ID に「G-」で始まるIDを入れると計測が始まる。
  // 未設定のときは読み込まないので、サイトの動きは何も変わらない。
  const gaId = process.env.NEXT_PUBLIC_GA_ID;

  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <HashScroll />
        {children}
      </body>
      {gaId ? <GoogleAnalytics gaId={gaId} /> : null}
    </html>
  );
}
