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
const REDIRECTS = [
  {
    // 「出店場所の探し方」で3本が競合していたため、
    // 内容を kitchen-car-location-guide にまとめた（2026-09-02）
    source: '/blog/how-to-find-food-truck-spots',
    destination: '/blog/kitchen-car-location-guide',
    permanent: true,
  },
  // 自動投稿が「auto-」＋時刻＋乱数でURLを作っていた記事（2026-09-02 に改名）。
  // 中身の分かるURLに変えたので、古いURLからは新しいURLへ送る。
  {
    // 駐車場を貸す記事は2本できていたので、統合先へまとめて送る
    source: '/blog/auto-mtarczbg-37pazo',
    destination: '/blog/renting-parking-space',
    permanent: true,
  },
  {
    source: '/blog/auto-mtgh64lh-jwwkxe',
    destination: '/blog/renting-parking-space',
    permanent: true,
  },
  {
    source: '/blog/auto-mta8z1w9-vazfy1',
    destination: '/blog/regular-event-schedule',
    permanent: true,
  },
]

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
    ],
  },
  async redirects() {
    return REDIRECTS
  },
};

export default nextConfig;
