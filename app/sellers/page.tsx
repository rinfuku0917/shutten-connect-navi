import type { Metadata } from 'next'
import { isExcludedShop } from '../lib/excludedShops'
import { createClient } from '@supabase/supabase-js'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import Link from 'next/link'
import SellersBrowser, { type Seller } from './SellersBrowser'
import { sortForListing } from './sellerName'
import { sellerHasContent } from '../lib/sellerListing'
import { corporateNameOrEmpty } from '../lib/sellerNames'

// 隠す屋号は app/lib/excludedShops.ts が唯一の正

export const revalidate = 600

export const metadata: Metadata = {
  title: 'キッチンカー・出店者一覧｜業態・エリアから探す',
  description:
    '出店コネクトナビに登録しているキッチンカー・出店事業者の一覧です。食事・スイーツ・ドリンク・物販など業態と出店エリアで絞り込めます。イベントや施設へ呼びたい方はこちらからお探しください。',
  alternates: { canonical: '/sellers' },
}

async function fetchSellers(): Promise<Seller[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Supabase の環境変数が設定されていません')

  // 読み先は public_sellers（公開してよい項目だけを出すビュー）。
  //
  // 以前は profiles を直接読んでいたが、2026-09-02 に profiles の閲覧を
  // 「自分の行と管理者だけ」に絞ったため、サービスロールキーが無い環境では
  // 一覧が丸ごと落ちるようになっていた。
  // public_sellers ならどちらの鍵でも読めるので、鍵が変わっても止まらない。

  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const CHUNK = 1000
  const all: Seller[] = []
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await supabase
      .from('public_sellers')
      .select('id, shop_name, genre, areas, photos, bio')
      .eq('role', 'seller')
      .eq('approval_status', 'approved')
      .order('shop_name', { ascending: true, nullsFirst: false })
      .range(from, from + CHUNK - 1)

    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as Seller[]))
    if (data.length < CHUNK) break
  }
  return all
}

// 屋号（shop_name）が空の出店者の「氏名の欄に入っている会社名」を引く。
//
// 公開ビュー public_sellers は本名の列を持たない（2026-09-19 に外した）。
// そこでサーバー側でだけ profiles を読み、会社名と判断できるものだけを返す。
// 本名はここから外へ出さない（返すのは corporateNameOrEmpty を通した値だけ）。
// サービスロールキーが無い環境（手元）では空の Map を返し、これまでどおり
// 「（店名未登録）」と出る。
async function fetchCorpNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key || ids.length === 0) return out
  try {
    const db = createClient(url, key, { auth: { persistSession: false } })
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      const { data, error } = await db
        .from('profiles')
        .select('id, name')
        .in('id', ids.slice(i, i + CHUNK))
      if (error) return out
      for (const p of data ?? []) {
        const corp = corporateNameOrEmpty(p.name as string | null)
        if (corp) out.set(String(p.id), corp)
      }
    }
    return out
  } catch {
    return out
  }
}

// 「すべての出店者」を活動エリアごとにまとめる。
//
// areas は複数の都道府県が入ることがあるので、先頭のエリアで1回だけ並べる
// （同じ出店者を県ごとに何度も出すと、同じページへのリンクが重複する）。
// エリアが空の人は最後の「エリア未設定」に入れる。
// 並びは店舗数の多いエリアから（東京・神奈川のように多い順に見せる）
function groupByArea(
  list: { id: string; shopName: string; areas: string[] }[],
): { area: string; items: { id: string; shopName: string }[] }[] {
  const byArea = new Map<string, { id: string; shopName: string }[]>()
  for (const s of list) {
    const area = s.areas[0] || 'エリア未設定'
    const arr = byArea.get(area)
    if (arr) arr.push({ id: s.id, shopName: s.shopName })
    else byArea.set(area, [{ id: s.id, shopName: s.shopName }])
  }
  return Array.from(byArea.entries())
    .map(([area, items]) => ({ area, items }))
    .sort((a, b) => (
      // 「エリア未設定」は最後に置く
      a.area === 'エリア未設定' ? 1 : b.area === 'エリア未設定' ? -1 : b.items.length - a.items.length
    ))
}

// メニューを1件でも登録している出店者。
// 「すべての出店者」に入れるかの判定（app/lib/sellerListing.ts）に使う。
// 読めなかったら null を返し、絞り込みをやめる（サイトマップと同じ扱い）
async function fetchMenuSellerIds(): Promise<Set<string> | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  try {
    const db = createClient(url, key, { auth: { persistSession: false } })
    const out = new Set<string>()
    const CHUNK = 1000
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await db.from('menus').select('seller_id').range(from, from + CHUNK - 1)
      if (error) return null
      if (!data || data.length === 0) break
      for (const m of data) if (m.seller_id) out.add(String(m.seller_id))
      if (data.length < CHUNK) break
    }
    return out
  } catch {
    return null
  }
}

export default async function SellersPage() {
  let sellers: Seller[] = []
  let errorMessage: string | null = null

  // 「すべての出店者」に並べる人（サイトマップに入れている人と同じ条件）
  let directory: { id: string; shopName: string; areas: string[] }[] = []

  try {
    const [allRaw, menuIds] = await Promise.all([fetchSellers(), fetchMenuSellerIds()])
    // 屋号が空の人だけ、氏名の欄に入っている会社名を引いて足す
    const noShop = allRaw.filter(s => !String(s.shop_name ?? '').trim()).map(s => String(s.id))
    const corpNames = await fetchCorpNames(noShop)
    const all = allRaw.map(s => (corpNames.has(String(s.id))
      ? { ...s, corpName: corpNames.get(String(s.id)) as string }
      : s))
    // 写真と店名がそろっているものを前に、どちらも無いものを後ろに並べる。
    // 一覧は画像の並びなので、絵も名前も無いカードが混ざると空いて見える。
    sellers = sortForListing(
      all.filter((s) => !isExcludedShop(s.shop_name)),
    )
    // ページ送りが button（クローラーがたどれない）なので、
    // HTMLには先頭30店舗ぶんしかリンクが出ていなかった。
    // サイトマップには583店舗が入っており、残りは内部リンクの無い孤立ページだった
    // （AGENTS.md「サイトマップにしか無い孤立ページにしない」）。
    // 一覧の下に、条件を満たす出店者すべてへのリンクを置く
    directory = sellers
      .filter((s) => sellerHasContent({
        // 屋号が空でも会社名が出せる人は「名前がある」として扱う
        shopName: String(s.shop_name ?? '').trim() || (s as { corpName?: string }).corpName || '',
        photos: s.photos,
        bio: (s as { bio?: string | null }).bio,
        hasMenu: menuIds ? menuIds.has(String(s.id)) : false,
        menusOk: menuIds !== null,
      }))
      .map((s) => ({
        id: String(s.id),
        shopName: String(s.shop_name ?? '').trim() || String((s as { corpName?: string }).corpName ?? '').trim(),
        areas: Array.isArray(s.areas) ? s.areas.filter(Boolean).map(String) : [],
      }))
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : '不明なエラーが発生しました'
  }

  return (
    <div style={{ background: '#FBF7F1', minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/' />
      </div>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-10 flex flex-row items-center justify-center gap-3 text-center sm:gap-4">
          <div>
          <div className="flex items-center justify-center gap-2 text-amber-600">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
              <circle cx="7" cy="18" r="1.6" />
              <circle cx="17" cy="18" r="1.6" />
            </svg>
            <span className="text-sm font-semibold tracking-wide">出店者ディレクトリ</span>
          </div>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">出店者一覧</h1>
          <p className="mt-2 text-stone-500">
            {errorMessage ? '読み込みに失敗しました' : `全 ${sellers.length.toLocaleString()} 店舗から探す`}
          </p>
          </div>
          {/* globals.css の img{height:auto} がレイヤー外でTailwindのh-*を上書きするため、サイズは専用クラスで指定する */}
          <img src="/ic2-truck.webp" alt="" className="sellers-hero-icon shrink-0 object-contain" />
        </header>

        {errorMessage ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800">
            <p className="font-semibold">データを読み込めませんでした</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
          </div>
        ) : (
          <>
            <SellersBrowser initialSellers={sellers} />

            {/* すべての出店者への入り口。
                ページ送りは button なのでクローラーがたどれず、HTMLには先頭30店舗しか
                リンクが出ていなかった。サイトマップには583店舗が入っているので、
                残りは内部リンクの無い孤立ページになっていた（2026-09-24 に発見）。
                ここは素のHTMLだけで作る（開閉は details の標準の動きで、JSを足さない）。
                並びは都道府県ごと。屋号だけの一覧なので、1,000店舗でも数十KBに収まる */}
            {directory.length > 0 && (
              <details className="mt-10 rounded-2xl border border-stone-200 bg-white p-5">
                <summary className="cursor-pointer text-sm font-semibold text-stone-800">
                  すべての出店者を見る（{directory.length.toLocaleString()}店舗）
                </summary>
                <p className="mt-2 text-xs text-stone-500">
                  写真・メニュー・紹介文のいずれかを登録している出店者を、活動エリアごとに並べています。
                </p>
                <nav aria-label="すべての出店者" className="mt-4 flex flex-col gap-5">
                  {groupByArea(directory).map((g) => (
                    <div key={g.area}>
                      <h2 className="text-sm font-bold text-stone-900">{g.area}<span className="ml-2 text-xs font-medium text-stone-500">{g.items.length}店舗</span></h2>
                      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                        {g.items.map((s) => (
                          <li key={s.id} className="text-[13px] leading-6">
                            <Link href={`/sellers/${s.id}`} className="text-stone-700 underline-offset-2 hover:text-amber-700 hover:underline">
                              {s.shopName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </nav>
              </details>
            )}
          </>
        )}
      </div>

      <SiteFooter />
    </div>
  )
}
