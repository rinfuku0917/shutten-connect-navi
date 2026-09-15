import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { SITE_URL, SITE_HOST } from './app/lib/seo'
import {
  OLD_EVENT_DETAIL_PATHS,
  OLD_SITE_PHP_REDIRECTS,
  OLD_SITE_QUERY_REDIRECTS,
} from './app/lib/oldSiteRedirects'
import oldEventRedirects from './app/lib/oldEventRedirects.json'

// リクエストが画面を描く前に通る入口（Next 16 で middleware から proxy に改名された）。
//
// ここでやるのは転送だけ。ページごとの処理（ログイン確認など）は置かない。
// 転送の種類ごとに関数を分け、上から順に試して最初に当たったものを返す。
// 旧 WordPress の URL の転送のうち、パスだけで決まるものは next.config.ts の redirects() にあり、
// ここより先に処理される。ここで扱うのは、メソッド・本文・クエリを見ないと決まらないものだけ。

// ───────────────────────────────────────────────
// app.connect-navi.com → ルートドメインへの転送
// ───────────────────────────────────────────────
//
// なぜ要るか:
//   本番を app.connect-navi.com から connect-navi.com（ルート）へ移す。
//   検索結果・ブックマーク・送信済みメールには app. の URL が残るので、
//   同じパスのまま新しいドメインへ送り、評価も引き継ぐ（308＝恒久的な移動）。
//
// なぜ Vercel のドメイン設定の Redirect を使わないか:
//   あちらは /api 配下も含めて全部転送してしまう。LINE の webhook は
//   https://app.connect-navi.com/api/line/webhook に届いていて、LINE は転送を追わないので、
//   ドメインごと転送すると LINE からの通知が全部落ちる。ここなら /api を外せる。
//
// いつ動くか:
//   Vercel の環境変数 SITE_HOST_REDIRECT が '1' のときだけ。
//   未設定なら何もしない（切り替えの日までの本番の動きは変わらない）。
//   転送先は SITE_URL（NEXT_PUBLIC_SITE_URL）。切り替え当日に両方を設定して再デプロイする。
//   SITE_URL が app. のまま SITE_HOST_REDIRECT だけ '1' にしても、自分自身へ送り続けないよう
//   転送元と転送先が同じホストなら何もしない。

// 転送元にするホスト。ここに無いホスト（ルート本体、*.vercel.app のプレビューなど）は転送しない
const LEGACY_APP_HOSTS = ['app.connect-navi.com']

// Search Console の所有権確認ファイルの名前（google + 16進の英数字 + .html）
const GOOGLE_SITE_VERIFICATION_FILE = /^\/google[0-9a-f]+\.html$/

function redirectLegacyAppHost(request: NextRequest): NextResponse | null {
  if (process.env.SITE_HOST_REDIRECT !== '1') return null

  // ポート付きで来ることがあるので外して比べる。ホスト名は大文字小文字を区別しない
  const host = (request.headers.get('host') ?? '').toLowerCase().replace(/:\d+$/, '')
  if (!LEGACY_APP_HOSTS.includes(host)) return null
  if (host === SITE_HOST) return null

  const { pathname, search } = request.nextUrl
  // /api は転送しない。LINE の webhook など、転送を追わない相手が叩いているため。
  // matcher でも外しているが、matcher を書き換えたときに漏れないよう、ここでも確かめる
  if (pathname === '/api' || pathname.startsWith('/api/')) return null
  // Next の内部ファイル（JS・CSS・画像変換）は、開いたままの古いタブが読みに来る。
  // 別ドメインへ送ると読み込みに失敗して画面が壊れるので、そのまま返す
  if (pathname.startsWith('/_next/')) return null
  // Search Console の所有権確認ファイル（public/google<英数字>.html）は転送しない。
  // Google は確認を定期的にやり直し、HTML ファイルでの確認では別ドメインへの転送を追わない。
  // app. のプロパティの所有権が外れると、app. → ルートの「アドレス変更」を申請できなくなる
  // （旧・新両方のプロパティの所有者であることが条件）。トップの meta タグでの確認は
  // / を転送する以上残せないので、ファイルでの確認だけは app. 上でそのまま返す
  if (GOOGLE_SITE_VERIFICATION_FILE.test(pathname)) return null

  // パスとクエリはそのまま引き継ぐ（日本語のパスはエンコードされたまま渡る）
  const destination = new URL(pathname + search, SITE_URL)
  return NextResponse.redirect(destination, 308)
}

// ───────────────────────────────────────────────
// 旧 WordPress（connect-navi.com）の URL の転送
// ───────────────────────────────────────────────
//
// 対応表と、なぜ next.config ではなくここで扱うかは app/lib/oldSiteRedirects.ts を参照。
// ここで扱うのは次の2種類:
//   ・.php … 旧の案件一覧・詳細・ログインのフォームの送信先。POST で届く
//   ・/?p=26 などのトップのクエリ … WordPress の短縮 URL
//
// 転送先は届いたホストのまま（パスだけ差し替える）。ルートへ移る前は app.connect-navi.com 上で、
// 移った後は connect-navi.com 上で動く。app. からルートへの転送は上の関数が先にやる。
//
// 旧の案件詳細は、eventId（旧案件の8桁の番号）ごとに新の案件ページへ送る。
// 旧は POST の本文でしか中身を出さず、案件ごとの固有 URL は検索エンジンに無い見込み。
// 使われるのは開いたままの古いタブからの再送信などだが、送れるなら同じ案件へ送る。
// 対応表に無い eventId（新に移していない案件・新で消した案件）は案件一覧へ落とす。
const OLD_EVENT_PATHS = new Map<string, string>(Object.entries(oldEventRedirects))

// 旧のフォームの本文は eventId の数文字しかない。これより大きい本文はフォームの送信ではないので
// 読まずに一覧へ送る（proxy で大きな本文を解析して遅くしない）
const MAX_FORM_BODY_BYTES = 16 * 1024

// フォームで送られた項目を1つ読む。読めなければ null
async function readFormField(request: NextRequest, key: string): Promise<string | null> {
  if (request.method !== 'POST') return null
  const type = request.headers.get('content-type') ?? ''
  if (!type.startsWith('application/x-www-form-urlencoded') && !type.startsWith('multipart/form-data')) return null
  const length = Number(request.headers.get('content-length') ?? '0')
  if (!Number.isFinite(length) || length > MAX_FORM_BODY_BYTES) return null
  try {
    const value = (await request.formData()).get(key)
    return typeof value === 'string' ? value.trim() : null
  } catch {
    return null
  }
}

// 届いたホストのまま、クエリを落としてパスだけ差し替えた URL へ送る。
// POST には 303 を返す。301/308 だとブラウザが POST のまま送り直すことがあり、
// 新のページに不要な POST が届く（再読み込みで「再送信しますか」も出る）。
// 303 なら GET に切り替えて開き直す。GET・HEAD には恒久的な移動の 301 を返す
function redirectOnSameHost(request: NextRequest, path: string): NextResponse {
  const status = request.method === 'POST' ? 303 : 301
  return NextResponse.redirect(new URL(path, request.url), status)
}

async function redirectOldWordPress(request: NextRequest): Promise<NextResponse | null> {
  const { pathname, searchParams } = request.nextUrl

  // WordPress の短縮 URL（/?p=26 など）。トップ以外のパスやクエリの無いトップは素通り
  if (pathname === '/') {
    if (request.nextUrl.search === '') return null
    for (const [key, table] of Object.entries(OLD_SITE_QUERY_REDIRECTS)) {
      const value = searchParams.get(key)
      if (value !== null && Object.hasOwn(table, value)) {
        return redirectOnSameHost(request, table[value])
      }
    }
    return null
  }

  // .php。新サイトに .php のページは無いので、表に無ければ何もしない。
  // 旧は小文字の URL だったが、大文字で打たれても同じ所へ送る
  if (!/\.php$/i.test(pathname)) return null
  const path = pathname.toLowerCase()
  if (!Object.hasOwn(OLD_SITE_PHP_REDIRECTS, path)) return null
  const fallback = OLD_SITE_PHP_REDIRECTS[path]

  if (OLD_EVENT_DETAIL_PATHS.includes(path)) {
    // 旧のフォームは本文で送る。GET で ?eventId= を付けて開かれた場合もクエリから拾う
    const eventId = (await readFormField(request, 'eventId')) ?? searchParams.get('eventId')?.trim() ?? ''
    return redirectOnSameHost(request, OLD_EVENT_PATHS.get(eventId) ?? fallback)
  }
  return redirectOnSameHost(request, fallback)
}

export async function proxy(request: NextRequest) {
  return (
    redirectLegacyAppHost(request) ??
    (await redirectOldWordPress(request)) ??
    NextResponse.next()
  )
}

export const config = {
  matcher: [
    // 次のものは proxy を通さない（転送の対象にしない）:
    //   ・api              … LINE の webhook など。上の関数の説明を参照
    //   ・_next            … Next の内部ファイル（_next/static、_next/image）
    //   ・画像・フォント等  … 記事本文に https://app.connect-navi.com/covers/... の絶対URLが
    //                         残っていて、画像変換がそこを取りに行く。転送を挟まず返す
    //   ・favicon.ico
    // robots.txt と sitemap.xml は外していない。app. で開かれたらルートのものへ送る。
    // .php とトップ（/）も外していない。旧 WordPress の URL の転送が見るため。
    // 除外の拡張子に php を足すと、旧の案件一覧・詳細・ログインの転送が止まる。
    // 旧 WordPress の画像（/wp-content/uploads/*.jpg など）を転送したくなったら、
    // 拡張子の除外に引っかかるので、そのパスだけ別の行で足すこと。
    // この値は Next がビルド時に読むので、変数を使わず文字列で書く。
    '/((?!api(?:/|$)|_next/|favicon\\.ico$|.*\\.(?:png|jpe?g|gif|webp|avif|svg|ico|bmp|woff2?|ttf|otf|eot|mp4|webm|pdf)$).*)',
  ],
}
