import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
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
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "ja_JP",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
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
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
