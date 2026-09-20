// 旧サイト（connect-navi.com の WordPress）の URL を、新サイトの近いページへ送る対応表。
//
// なぜ要るか:
//   connect-navi.com（ルート）の DNS を Vercel に向けると、旧 WordPress には誰も届かなくなる。
//   検索結果・ブックマーク・外部リンクに残る旧 URL を新サイトが受けて転送しないと、
//   すべて 404 になり、旧サイトが持っていた検索の評価も引き継げない。
//
// 旧 URL のパスは新サイトに存在しないので、ルートへ移る前（app.connect-navi.com のまま）から
// 転送を入れておいても、新サイトのページには影響しない。
//
// 対応表は 2026-09-15 に旧サイトのサイトマップ・REST API・HTML から棚卸ししたもの。
// 旧サイトは切り替えまで更新が続くので、DNS を切り替える直前に取り直すこと。
//
// 転送しないもの（新サイトに同じパスのページがあり、そのページが受ける）:
//   / /vendor /space /sell /company /contact /blog /sitemap.xml /robots.txt
//   ※旧 /vendor（出店したい方）と新 /vendor（呼びたい方）は意味が逆だが、
//     新サイト自身のページを壊すので転送しない（運営決定）。
//
// 置き場所の分け方:
//   ・パスだけで決まるもの        … OLD_SITE_REDIRECTS（next.config.ts の redirects() が使う）
//   ・.php（旧のフォームの送信先）  … OLD_SITE_PHP_REDIRECTS（proxy.ts が使う）
//   ・/?p=26 のようなクエリ        … OLD_SITE_QUERY_REDIRECTS（proxy.ts が使う）
//   ・旧案件の個別ページ           … app/lib/oldEventRedirects.json（proxy.ts が使う）
//
// 一度ここに書いた行は消さないこと。消すと転送が切れて404になる。

type PathRedirect = { from: string; to: string }

// ───────────────────────────────────────────────
// パスだけで決まる転送（next.config.ts の redirects()）
// ───────────────────────────────────────────────
//
// from は日本語をデコードした形で書く。エンコードした形の source は下の関数で自動で足す。
// 旧 URL は末尾スラッシュ付き（/products/）だが、Next が先に末尾スラッシュを外す
// 308 を返してからこの転送に当たるので、ここには付けない形だけ書けば両方に当たる。
const PATHS: PathRedirect[] = [
  // 旧会員登録・マイページ。切り替えと同時に旧の登録・ログインは止めるので、新のものへ
  { from: '/new_user', to: '/register' },
  { from: '/new_user/complate', to: '/register' },
  { from: '/mypage', to: '/login' },
  { from: '/mypage/vendor', to: '/login' },
  { from: '/mypage/organizer', to: '/login' },
  { from: '/mypage/vendor/password_reminde', to: '/reset-password' },
  { from: '/mypage/organizer/password_reminde', to: '/reset-password' },

  // 固定ページ
  { from: '/privacy_policy', to: '/privacy' },
  { from: '/contact/thanks', to: '/contact' },
  // 旧「キッチンカーを制作したい」。新 /sell は車両の売却で用件が違う。
  // 制作のページは新に無いので、開業・出店したい人向けの /space へ
  { from: '/products', to: '/space' },
  { from: '/pt_product', to: '/space' },
  { from: '/pt_product/feed', to: '/space' },
  // 旧は403だった /search の入口。配下の .php は proxy.ts で扱う
  { from: '/search', to: '/places' },

  // 記事（日本語スラッグ）。/feed は記事のコメントRSS、長いものは記事の添付画像のページ
  // 本文が旧会員向けのログイン案内なので、記事一覧よりログインへ
  { from: '/新サイトへ移行しました｜ログイン方法のご案内', to: '/login' },
  { from: '/新サイトへ移行しました｜ログイン方法のご案内/feed', to: '/login' },
  // 本文が会員登録の注意書きで、新に対応する記事が無いので会員登録へ
  { from: '/会員登録に関する際のご注意', to: '/register' },
  { from: '/会員登録に関する際のご注意/feed', to: '/register' },
  { from: '/会員登録に関する際のご注意/u8932747662_a_clean_modern_illustration_of_a_food_truck_parke_e09c6558-4d65-4eaf-a220-38525de8706b_3', to: '/register' },
  // 主題が出店場所の探し方で、新の同じテーマの記事がある
  { from: '/これからキッチンカー、フードトラックを始める', to: '/blog/kitchen-car-location-guide' },
  { from: '/これからキッチンカー、フードトラックを始める/feed', to: '/blog/kitchen-car-location-guide' },
  { from: '/これからキッチンカー、フードトラックを始める/水色　ベージュ　シンプル　ブログ　アイキャッ', to: '/blog/kitchen-car-location-guide' },

  // お知らせ。2件とも本文が「新サイトへ移行しました｜ログイン方法のご案内」に差し替わっている
  { from: '/pt_news/「出店コネクトナビ」のhpを公開しました', to: '/login' },
  { from: '/pt_news/新サイトへ移行しました｜ログイン方法のご案内', to: '/login' },
  // お知らせの表示区分。新にお知らせのページは無いのでトップへ
  { from: '/news_display/news_home', to: '/' },
  { from: '/news_display/news_home/feed', to: '/' },
  { from: '/news_display/news_mypage', to: '/' },
  { from: '/news_display/news_mypage/feed', to: '/' },

  // よくある質問。区分ごとに、同じ用件の新ページへ
  //   出店者向け → トップ（トップの「よくある質問」が出店者向け）
  //   呼びたい方向け → /vendor（イベントの手配の1問だけ /vendor/event）
  //   車両の売却 → /sell、キッチンカー制作 → /space（/products と同じ理由）
  { from: '/pt_faq/どんなキッチンカーが良いですか？', to: '/space' },
  { from: '/pt_faq/物販のみの移動販売車を製作したいです。可能で', to: '/space' },
  { from: '/pt_faq/普通免許で乗れますか？', to: '/space' },
  { from: '/pt_faq/ベースの車両選定はどうしたらいいですか？', to: '/space' },
  { from: '/pt_faq/出店場所はどのように見つければいいですか？', to: '/space' },
  { from: '/pt_faq/アルコールの提供は可能ですか？', to: '/' },
  { from: '/pt_faq/地方在住で保健所の申請に行くのが大変です。', to: '/' },
  { from: '/pt_faq/遠方なのですが出店可能ですか？', to: '/' },
  { from: '/pt_faq/自分で出店場所を探すと出店料がどこも高くて困', to: '/' },
  { from: '/pt_faq/どんな商品が売れるか教えてもらえますか？', to: '/' },
  { from: '/pt_faq/出店が初めてなのですが、出店前でも事前相談な', to: '/' },
  { from: '/pt_faq/出店登録にお金はかかりますか？', to: '/' },
  { from: '/pt_faq/出店場所に応募したいです。どうすれば良いでし', to: '/' },
  { from: '/pt_faq/時間はかかりますか？', to: '/sell' },
  { from: '/pt_faq/査定後に売却をキャンセルすることは可能ですか', to: '/sell' },
  { from: '/pt_faq/買い取りの際、厨房設備は外しても大丈夫ですか', to: '/sell' },
  { from: '/pt_faq/査定額はどのように決まりますか？', to: '/sell' },
  { from: '/pt_faq/イベントにおける出店者の手配及び保健所の申請', to: '/vendor/event' },
  { from: '/pt_faq/ホームセンターや展示場に呼びたいのですが可能', to: '/vendor' },
  // スラッグに全角数字が入っている。半角に揃えると旧 URL と一致しなくなるので、このまま書く
  { from: '/pt_faq/１台だけでも手配可能ですか？', to: '/vendor' },
  { from: '/pt_faq/今週末に急遽出店可能な方を探してます。可能で', to: '/vendor' },
  { from: '/pt_faq/提供場所は汚れないですか？', to: '/vendor' },
  { from: '/pt_faq/どんな場所でもキッチンカーを呼ぶことはできま', to: '/vendor' },
  { from: '/faq_category/faq_vendor', to: '/' },
  { from: '/faq_category/faq_vendor/feed', to: '/' },
  { from: '/faq_category/faq_eventer', to: '/vendor' },
  { from: '/faq_category/faq_eventer/feed', to: '/vendor' },
  { from: '/faq_category/faq_sell', to: '/sell' },
  { from: '/faq_category/faq_sell/feed', to: '/sell' },
  { from: '/faq_category/faq_products', to: '/space' },
  { from: '/faq_category/faq_products/feed', to: '/space' },

  // RSS。記事一覧へ
  { from: '/feed', to: '/blog' },
  { from: '/comments/feed', to: '/blog' },
  // 新では /blog/[slug] に slug=feed として当たり404になるので、ここで受ける
  { from: '/blog/feed', to: '/blog' },

  // 旧のサイトマップ。Search Console に登録されたままの可能性があるので、新のものへ
  { from: '/sitemap.rss', to: '/sitemap.xml' },
  { from: '/sitemap_index.xml', to: '/sitemap.xml' },
  { from: '/post-sitemap.xml', to: '/sitemap.xml' },
  { from: '/page-sitemap.xml', to: '/sitemap.xml' },
  { from: '/pt_news-sitemap.xml', to: '/sitemap.xml' },
  { from: '/pt_faq-sitemap.xml', to: '/sitemap.xml' },
  { from: '/post-archive-sitemap.xml', to: '/sitemap.xml' },
  { from: '/category-sitemap.xml', to: '/sitemap.xml' },
  { from: '/post_tag-sitemap.xml', to: '/sitemap.xml' },
  { from: '/faq_category-sitemap.xml', to: '/sitemap.xml' },
  { from: '/news_display-sitemap.xml', to: '/sitemap.xml' },
]

// パターンで受ける転送。
// 旧のカテゴリ・タグ・投稿者のアーカイブは、中身（載っている記事）が新の記事と対応しないため
// すべて記事一覧へ送る。個別に並べるより、ページ送り（/tag/xx/page/2）や
// 棚卸しで見えなかった削除済みのタグまで取りこぼさない。
// 日付アーカイブ（/2024、/2024/05、/2024/05/16）も同じ。旧は記事が無い日付でも200を返していた。
// 新サイトに /category /tag /author や4桁の数字で始まるページは無いので、巻き込まない。
const PATTERNS: { source: string; destination: string }[] = [
  { source: '/category/:path*', destination: '/blog' },
  { source: '/tag/:path*', destination: '/blog' },
  { source: '/author/:path*', destination: '/blog' },
  // 旧マイページ・旧検索ページの下の階層。
  //
  // 個別指定（上の PATHS と proxy.ts の .php）に当たらなかったものを受ける。
  //   Vercel の基盤側の防御が .php を含むアドレスを転送より前に403で止める
  //   （パス単位では解除できず、解除はIPアドレス単位のみ）。
  //   .php の付かない形で来たものは、せめて行き先を示す。
  //   2026-09-20、運営から「旧マイページを開くと403の画面が出る」との指摘。
  // 新サイトに /mypage /search のページは無いので、巻き込む心配はない
  { source: '/mypage/:path*', destination: '/login' },
  { source: '/search/:path*', destination: '/places' },
  { source: '/:yyyy(\\d{4})/:mm(\\d{2})?/:dd(\\d{2})?', destination: '/blog' },
]

// path-to-regexp で意味を持つ文字を、ただの文字として扱わせる
function escapeSource(path: string): string {
  return path.replace(/[(){}:*+?\\]/g, '\\$&')
}

// 日本語を UTF-8 でパーセントエンコードした形（/pt_faq/%E6%99%82...）。
// 区切りの / はエンコードしない
function encodePath(path: string): string {
  return path.split('/').map(encodeURIComponent).join('/')
}

// next.config.ts の redirects() にそのまま渡す形。
//
// 日本語のスラッグはデコードした形とエンコードした形の両方を source にする。
// Next（next dev / next start）は届いたままのエンコードされたパスで source を照合するので、
// デコードした形だけでは当たらない。Vercel の転送層がどちらで照合するかは手元で確かめられないため、
// どちらで来ても当たるよう両方置く。
// WordPress は小文字（%e3）でリンクを出し、ブラウザは大文字（%E3）で送ることがあるが、
// source の照合は大文字小文字を区別しないので、大文字の形だけで両方に当たる。
export const OLD_SITE_REDIRECTS: { source: string; destination: string; permanent: true }[] = [
  ...PATHS.flatMap(({ from, to }) => {
    const sources = [escapeSource(from)]
    const encoded = encodePath(from)
    if (encoded !== from) sources.push(escapeSource(encoded))
    return sources.map(source => ({ source, destination: to, permanent: true as const }))
  }),
  ...PATTERNS.map(p => ({ ...p, permanent: true as const })),
]

// ───────────────────────────────────────────────
// .php の転送（proxy.ts）
// ───────────────────────────────────────────────
//
// 旧サイトの案件一覧・ログインは、フォームから .php へ POST していた（ページ送りも POST）。
// next.config の redirects は 308 を返し、ブラウザは POST のまま転送先へ送り直すので、
// 新のページに不要な POST が届き、再読み込みで「再送信しますか」が出る。
// proxy なら POST には 303（GET に切り替えて開き直す）を返せるので、.php はそちらで扱う。
// キーは小文字。proxy 側でパスを小文字にしてから引く。
//
// /search/single-space.php と single-event.php（旧の案件詳細）は、
// eventId ごとの転送先を oldEventRedirects.json から引き、無ければここの /places に落ちる。
export const OLD_SITE_PHP_REDIRECTS: Record<string, string> = {
  '/mypage/vendor/login.php': '/login',
  '/mypage/organizer/login.php': '/login',
  '/mypage/vendor/offer-projects/single.php': '/login',
  '/search/index.php': '/places',
  '/search/archive-space.php': '/places',
  '/search/archive-event.php': '/places',
  '/search/single-space.php': '/places',
  '/search/single-event.php': '/places',
  // 旧の出店者一覧・詳細。旧の出店者と新の出店者の対応は作れていないので一覧へ
  '/search/archive-vendor.php': '/sellers',
  '/search/single-vendor.php': '/sellers',
}

// 旧の案件詳細。POST の本文か、クエリの eventId で案件を特定する
export const OLD_EVENT_DETAIL_PATHS = ['/search/single-space.php', '/search/single-event.php']

// ───────────────────────────────────────────────
// トップのクエリで決まる転送（proxy.ts）
// ───────────────────────────────────────────────
//
// WordPress の短縮 URL（/?p=26、/?page_id=88 など）。旧は 301 で記事や固定ページへ飛ばしていた。
// next.config の redirects でも has で書けるが、あちらは元のクエリを転送先に引き継ぐので
// /vendor?p=26 のような URL になる。proxy でクエリを落として送る。
// ここに無いクエリ（/?s= の旧サイト内検索など）は、そのままトップが受ける。
export const OLD_SITE_QUERY_REDIRECTS: Record<string, Record<string, string>> = {
  // 固定ページ・よくある質問（旧 FAQ の投稿 ID）
  p: {
    // 呼びたい方向けの FAQ
    '26': '/vendor', '27': '/vendor', '28': '/vendor', '29': '/vendor', '30': '/vendor',
    '31': '/vendor/event',
    // 車両の売却の FAQ
    '32': '/sell', '33': '/sell', '34': '/sell', '36': '/sell',
    // 出店者向けの FAQ
    '37': '/', '38': '/', '39': '/', '40': '/', '41': '/', '42': '/', '43': '/', '44': '/',
    // キッチンカー制作の FAQ
    '45': '/space', '46': '/space', '47': '/space', '48': '/space', '49': '/space',
    // 記事・お知らせ（パスで書いた転送と同じ行き先）
    '98': '/login',
    '109': '/blog/kitchen-car-location-guide',
    '129': '/register',
    '139': '/login',
    '142': '/login',
  },
  page_id: {
    '56': '/contact',
    '58': '/contact',
    '79': '/company',
    '81': '/privacy',
    '83': '/space',
    '86': '/sell',
    // 旧「出店したい」→ 新の出店したい方のページ、旧「お店を呼びたい」→ 新の呼びたい方のページ。
    // パス（/vendor /space）ではなくトップのクエリなので、意味で振り分ける
    '88': '/space',
    '90': '/vendor',
    '92': '/register',
    '94': '/register',
  },
  cat: { '1': '/blog', '14': '/blog', '15': '/blog', '16': '/blog', '29': '/blog' },
  author: { '1': '/blog' },
}
