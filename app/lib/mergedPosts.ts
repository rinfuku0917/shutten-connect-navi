// 別の記事に統合した記事の一覧。
//
// 同じ検索語を取り合っていた記事を1本にまとめたときの、
// 「まとめる前のURL」と「まとめ先」の対応表。
//
// ここが1か所の正になっていて、次の3つが同じ表を見る。
//   1. next.config.ts … 古いURLから統合先へ301（実際は308）で転送する
//   2. app/sitemap.ts … 統合元を検索エンジンに申告しない
//   3. app/blog/page.tsx と app/page.tsx … 記事一覧に出さない
//
// なぜ status='draft' に頼らないか:
//   統合元は下書きに戻す運用にしていたが、2026-09-02 に
//   how-to-find-food-truck-spots と auto-mtgh64lh-jwwkxe の2本が
//   いつのまにか公開に戻っていた。管理画面で誰かが押したのか、
//   古いSQLを流し直したのかは分からない。
//   下書きかどうかに関係なく、この表に載っている記事は
//   一覧にもサイトマップにも出さないようにして、戻っても影響が出ないようにする。
//
// 一度ここに書いた行は消さないこと。消すと転送が切れて404になる。

export type MergedPost = { from: string; to: string; note: string }

export const MERGED_POSTS: MergedPost[] = [
  { from: 'how-to-find-food-truck-spots', to: 'kitchen-car-location-guide',
    note: '「出店場所の探し方」で3本が競合していたため統合（2026-09-02）' },
  { from: 'auto-mtarczbg-37pazo', to: 'renting-parking-space',
    note: '駐車場を貸す記事が2本あったため統合（2026-09-02）' },
  { from: 'auto-mtgh64lh-jwwkxe', to: 'renting-parking-space',
    note: '同上。自動生成で同じテーマが二度作られていた' },
  { from: 'auto-mta8z1w9-vazfy1', to: 'regular-event-schedule',
    note: '意味のあるURLに改名（2026-09-02）' },
  { from: 'choose-profitable-food-truck-location', to: 'kitchen-car-location-guide',
    note: '5つの視点のうち3つが新しい記事に入っていたため統合（2026-09-02）' },
  { from: 'host-fee-setting-guide2', to: 'renting-parking-space',
    note: '貸す側の料金設定は駐車場の記事が実データつきで扱う（2026-09-02）' },
  { from: 'event-food-truck-guide', to: 'how-to-invite-kitchen-car',
    note: 'イベントに呼ぶ話が2本あったため統合（2026-09-02）' },
]

/** 記事一覧やサイトマップから外すべき slug かどうか */
export function isMergedAway(slug: string | null | undefined): boolean {
  if (!slug) return false
  return MERGED_POSTS.some(m => m.from === slug)
}

/** PostgREST の not-in に渡す形。記事一覧の件数もこれで正しくなる */
export const MERGED_SLUGS_FILTER = `(${MERGED_POSTS.map(m => m.from).join(',')})`
