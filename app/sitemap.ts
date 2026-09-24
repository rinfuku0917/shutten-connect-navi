import type { MetadataRoute } from 'next'
import { isExcludedShop } from './lib/excludedShops'
import { createClient } from '@supabase/supabase-js'
import { isMergedAway } from './lib/mergedPosts'
import { visiblePostsFilter } from './lib/postSchedule'
import { sellerHasContent } from './lib/sellerListing'
import { corporateNameOrEmpty } from './lib/sellerNames'
import { SITE_URL } from './lib/seo'
import { SEGMENTS } from './places/segments'
import { loadSegmentStamps } from './places/segmentData'

// Google に「このサイトにはどのページがあるか」を伝える一覧。
//
// 案件の詳細ページ（/places/[id]）は、一覧ページからのリンクが
// JavaScript の実行後にしか出てこない。そのため、ここに載せないと
// 300件以上ある案件ページが Google に見つけてもらえない。
//
// 1時間ごとに作り直す。案件が増えても自動で載る。

export const revalidate = 3600

// Supabase の1回の取得は既定で1000件までなので、それを超える分は分けて取る
const CHUNK = 1000

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// 日付として使えないものは undefined にして、lastModified を省く
function when(...vals: unknown[]): Date | undefined {
  for (const v of vals) {
    if (typeof v !== 'string' || !v) continue
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }
  return undefined
}

// 日付として使えるもののうち、いちばん新しいもの。
// 募集終了した案件は、ふつうは「終了にした日」（closed_at）が最後の変更になる。
// ただ掲載日（posted_at）は公開し直すたびに入り直す（app/api/admin/set-place-status）ので、
// 終了にした後で非公開→公開と戻すと終了日より新しくなる。書いた順ではなく新しいほうを選ぶ
function latest(...vals: unknown[]): Date | undefined {
  let best: Date | undefined
  for (const v of vals) {
    const d = when(v)
    if (d && (!best || d > best)) best = d
  }
  return best
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date()
  // 静的ページの更新日。毎回の生成時刻を入れると「毎時更新」と誤って伝わるので、
  // 実際に手を入れたときだけここを変える。
  const STATIC_UPDATED = new Date('2026-09-01T00:00:00Z')

  // ログインしなくても見られるページだけを載せる
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/vendor`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/vendor/event`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${SITE_URL}/vendor/cost`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.9 },
    // 呼びたい方向けの記事をまとめた入口。これまで分類の絞り込みは
    // /blog?category=募集者向け という形しかなく、検索の対象になっていなかった
    { url: `${SITE_URL}/blog/category/host`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/tokyo`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/saitama`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/kanagawa`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/chiba`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/ibaraki`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/vendor/area/osaka`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/vendor/area/gunma`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/vendor/area/tochigi`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/vendor/area/hyogo`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/vendor/area/aichi`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/places`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/sellers`, lastModified: STATIC_UPDATED, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/space`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/blog`, lastModified: STATIC_UPDATED, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/sell`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/company`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/contact`, lastModified: STATIC_UPDATED, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const db = client()
  // 環境変数が無いときでも静的ページだけは返す（ビルドを落とさない）
  if (!db) return staticPages

  const urls: MetadataRoute.Sitemap = []

  try {
    // エリア別・カテゴリ別の出店場所一覧（app/places/segments.ts の11枚）。
    //
    // URLの一覧は直書きしない。ページ・内部リンク・サイトマップ・
    // /places の canonical 対応表が同じ1ファイルを読むので、
    // 「ページはあるのにサイトマップに無い」「canonical が404を指す」が構造的に起きない。
    //
    // lastModified は STATIC_UPDATED の固定値ではなく、その集合に属する案件の
    // MAX(closed_at, posted_at, created_at)。取れなければ STATIC_UPDATED にする。
    //
    // 件数が取れなかったときは11URLを申告しない（件数もページ集合も分からない状態で
    // 申告するより黙るほうが害が小さい）。segments.ts はチェックイン済みなので、
    // ページ自体は 200 で見られる。
    {
      const stamps = await loadSegmentStamps(SEGMENTS)
      if (stamps) {
        for (const seg of SEGMENTS) {
          const stamp = stamps.get(seg.slug)
          // 掲載0件になった集合は申告しない（0件の一覧を申告すると doorway そのものになる）
          if (!stamp || stamp.total === 0) continue
          urls.push({
            url: `${SITE_URL}${seg.path}`,
            lastModified: stamp.lastModified ?? STATIC_UPDATED,
            changeFrequency: seg.changeFrequency,
            priority: seg.priority,
          })
        }
      }
    }

    // 公開中の案件（募集終了したものも含む）。
    //
    // 募集終了した案件も載せる（2026-09 に運営が決定）。
    // 施設名・写真・日程は出店実績として検索に出す価値があり、ページも noindex にしていない
    // （app/places/[id]/page.tsx）。ページ上部で終了を知らせ、同じ県の募集中の案件へつないでいる。
    // 下書き・非公開は今までどおり載せない（status で絞る）。
    //
    // 並び替えを付けないと、分けて取るときに行がずれて重複・欠落することがあるので id で固定する
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await db
        .from('places')
        .select('id, posted_at, created_at, closed, closed_at')
        .eq('status', 'published')
        .order('id', { ascending: true })
        .range(from, from + CHUNK - 1)
      if (error || !data || data.length === 0) break
      for (const p of data) {
        if (!p.id) continue
        if (p.closed) {
          // 終了した案件は、この先ほとんど中身が変わらない。
          // 募集中の案件より低くして、巡回を募集中のほうへ回してもらう
          urls.push({
            url: `${SITE_URL}/places/${p.id}`,
            lastModified: latest(p.closed_at, p.posted_at, p.created_at) ?? now,
            changeFrequency: 'yearly',
            priority: 0.3,
          })
        } else {
          urls.push({
            url: `${SITE_URL}/places/${p.id}`,
            lastModified: when(p.posted_at, p.created_at) ?? now,
            changeFrequency: 'weekly',
            priority: 0.7,
          })
        }
      }
      if (data.length < CHUNK) break
    }

    // 公開中の記事
    {
      const { data } = await db
        .from('posts')
        .select('slug, updated_at, published_at')
        .eq('status', 'published')
        // 公開日が未来の記事（予約中）は、公開日が来るまで申告しない（app/lib/postSchedule.ts）
        .or(visiblePostsFilter(now.toISOString()))
      for (const p of data || []) {
        if (!p.slug) continue
        // 別の記事に統合したものは、公開に戻っていても申告しない
        if (isMergedAway(p.slug)) continue
        urls.push({
          url: `${SITE_URL}/blog/${p.slug}`,
          // 新しいほうを使う。予約公開の記事は公開日より前に保存するので、
          // updated_at を先に取ると、公開日より前の日付を申告してしまう。
          // 上で公開日が今以前のものに絞っているので、未来の日付にはならない
          lastModified: latest(p.updated_at, p.published_at) ?? now,
          changeFrequency: 'monthly',
          priority: 0.6,
        })
      }
    }

    // 掲載を承認した出店者。
    //
    // **中身のあるページだけを申告する。**
    // 申告していた1,538URLのうち1,386件（90%）が出店者ページで、
    // そのうち641人は写真0枚・メニュー0件・紹介文なしだった。
    // 実際に見える固有の文字は名前と都道府県で15字ほどしかなく、
    // Googleは「クロール済み - インデックス未登録」に落とす。
    // その数を申告しているぶん、増やしたいページの巡回が後回しになる。
    //
    // 外すのはサイトマップからだけで、ページは今までどおり見られる
    // （公開ページへの noindex 追加は AGENTS.md で禁止している）。
    // 写真やメニューを登録すれば、次の更新で自動的に入る。

    // メニューを1件でも登録している出店者。先にまとめて引く
    // （1人ずつ確かめると人数ぶん往復する）
    //
    // ここが読めなかったときに絞り込みをかけてはいけない。
    // メニューだけを登録している出店者が全員こぼれ、
    // サイトマップが黙って縮む。読めなかったら絞らずに全員申告する
    // （これまでの動きに戻る）。
    const hasMenu = new Set<string>()
    let menusOk = true
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await db
        .from('menus').select('seller_id').range(from, from + CHUNK - 1)
      if (error) { menusOk = false; break }
      if (!data || data.length === 0) break
      for (const m of data) { if (m.seller_id) hasMenu.add(String(m.seller_id)) }
      if (data.length < CHUNK) break
    }

    // いったん全員ぶんを組み立てて、中身があるものだけを選ぶ。
    // 「選んだ結果がほとんど空になった」ときに気づけるようにするため、
    // 一度ためてから決める
    const sellerUrls: { id: string; created_at: string | null; worth: boolean }[] = []
    for (let from = 0; ; from += CHUNK) {
      const { data, error } = await db
        .from('profiles')
        // name は「氏名の欄の会社名」を屋号の代わりに使うため（個人名は使わない。
        // 判定は app/lib/sellerNames.ts の corporateNameOrEmpty）
        .select('id, created_at, name, shop_name, photos, bio')
        .eq('role', 'seller')
        .eq('approval_status', 'approved')
        .range(from, from + CHUNK - 1)
      if (error || !data || data.length === 0) break
      for (const s of data) {
        if (!s.id) continue
        // 運営用のアカウントは、一覧と同じく申告しない
        if (isExcludedShop(s.shop_name)) continue
        // 写真1枚以上・メニュー1件以上・紹介文30字以上のいずれかを満たすもの。
        // 判定は app/lib/sellerListing.ts（出店者一覧の「すべての出店者」と同じものを読む。
        // 食い違うと、リンクした先がサイトマップに無い状態ができる）
        const worth = sellerHasContent({
          shopName: String(s.shop_name ?? '').trim() || corporateNameOrEmpty(s.name as string | null),
          photos: s.photos,
          bio: s.bio,
          hasMenu: hasMenu.has(String(s.id)),
          menusOk,
        })
        sellerUrls.push({ id: String(s.id), created_at: s.created_at ?? null, worth })
      }
      if (data.length < CHUNK) break
    }

    // 歯止め。
    //   写真・メニュー・紹介文のどれかが読めなくなると（列名が変わった、
    //   列ごとの参照制限が入った）、全員が「中身なし」に見えて
    //   出店者ページがサイトマップから丸ごと消える。
    //   想定では半分ほどが残るので、9割以上が落ちるのは絞り込みではなく
    //   読み取りの異常。そのときは絞らずに全員申告する。
    const kept = sellerUrls.filter(x => x.worth).length
    const tooMany = sellerUrls.length >= 20 && kept < sellerUrls.length * 0.1
    for (const s of sellerUrls) {
      if (!tooMany && !s.worth) continue
      urls.push({
        url: `${SITE_URL}/sellers/${s.id}`,
        lastModified: when(s.created_at) ?? now,
        changeFrequency: 'monthly',
        priority: 0.5,
      })
    }
  } catch {
    // 取得に失敗しても、静的ページ分のサイトマップは返す
    return staticPages
  }

  return [...staticPages, ...urls]
}
