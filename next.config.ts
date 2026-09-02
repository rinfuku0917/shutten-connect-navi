import type { NextConfig } from "next";

// 統合した記事の転送先。
//
// 同じ検索語を2本の記事で取り合っていたので、内容を1本にまとめた。
// まとめる前のURLは、外部から張られたリンクや検索結果に残るため、
// 消さずに統合先へ転送する（301＝恒久的な移動）。
// こうすると、これまでの評価がまとめ先に引き継がれる。
//
// AGENTS.md のSEOルール「既存の公開URLを変更しない。やむを得ず変えるときは
// 301リダイレクトを設定し sitemap も更新する」に沿った対応。
// 転送元の記事は下書きに戻すので、sitemap と記事一覧からは自動で消える。
//
// 一度ここに書いた行は消さないこと。消すと転送が切れて404になる。
import { MERGED_POSTS } from './app/lib/mergedPosts'

// 統合した記事の転送先。対応表は app/lib/mergedPosts.ts にまとめてある
// （サイトマップと記事一覧も同じ表を見るので、書く場所を1か所にしている）。
//
// まとめる前のURLは、外部から張られたリンクや検索結果に残るため、
// 消さずに統合先へ転送する（301＝恒久的な移動。Next は308を返すが、
// 検索エンジンの扱いは同じ）。こうすると、これまでの評価が引き継がれる。
const REDIRECTS = MERGED_POSTS.map(m => ({
  source: `/blog/${m.from}`,
  destination: `/blog/${m.to}`,
  permanent: true,
}))


const nextConfig: NextConfig = {
  // 記事の本文に入っている画像は、Supabase のストレージから元の大きさのまま
  // 配信されていた。1枚1〜3MB、公開記事ぶんで合わせて32MBある。
  // 表示は760pxの幅なのに、2688px の写真をそのまま送っていた。
  // ここでホストを許可すると、Next が幅に合わせて縮めて WebP で配信できる。
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'mieflxcdthcpyrysfahs.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      {
        // 記事の表紙（public/covers）。本文には絶対URLで書く必要があるため
        // （og:image と一覧のサムネイルが本文の1枚目の画像を使う）、
        // 自サイトのホストもここに書いておく
        protocol: 'https',
        hostname: 'app.connect-navi.com',
        pathname: '/covers/**',
      },
    ],
  },
  async redirects() {
    return REDIRECTS
  },
};

export default nextConfig;
