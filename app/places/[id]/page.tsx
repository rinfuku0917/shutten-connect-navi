import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import PlaceDetailClient, { type Place } from './PlaceDetailClient'
import JsonLd from '../../components/JsonLd'
import RelatedPlaces, { type RelatedPlace } from '../../components/RelatedPlaces'
import PlaceSegmentLinks from '../PlaceSegmentLinks'
import { segmentForFilter } from '../segments'
import { SITE_URL, breadcrumbJsonLd } from '../../lib/seo'

// 案件の詳細。
//
// 以前はブラウザ側でデータを取っていたため、検索エンジンには
// 「読み込み中...」しか見えず、300件以上の案件ページが1つも
// 検索結果に出ていなかった。ここでサーバー側で読み込んでから渡す。
//
// 出店料・出店条件・備考のログイン制限は変えていない。
// 制限はブラウザ側の判定（canSeeFee）で行っていて、
// サーバーでは常にログイン前なので、HTMLにも出ない。

export const revalidate = 600

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// サーバー側では公開中の案件だけを読む。
// ここはサービスキーを使うため、status で絞らないと
// 下書きや非公開の案件まで誰にでも見えてしまう。
// 非公開の案件を募集者本人が見る場合は、ブラウザ側で読み直す。
async function fetchPlace(id: string): Promise<Place | null> {
  const client = db()
  if (!client) return null
  const { data } = await client
    .from('places')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()
  return (data as Place) ?? null
}

// 案件の行そのものがあるか（公開状態は問わない）。
//
// なぜ要るか:
//   公開中でない案件は、募集者本人がブラウザ側で見られるように 404 にしていない。
//   ところがその作りのせいで、存在しないIDでも200で「見つかりません」を返していた。
//   Search Console はこれを「ソフト404」として数え、クロールの無駄になる。
//   行が本当に無いときだけ404を返す。中身は返さないので、非公開の案件の情報は漏れない。
//
// 読めなかったとき（鍵が無い・通信の失敗）は「ある」とみなす。
// 本物のページを404にしてしまうほうが害が大きい。
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
async function placeExists(id: string): Promise<boolean> {
  // IDの形になっていないものは、案件ではない
  if (!UUID.test(id)) return false
  const client = db()
  if (!client) return true
  const { data, error } = await client.from('places').select('id').eq('id', id).maybeSingle()
  if (error) return true
  return !!data
}

// 募集終了した案件のページに出す、同じ都道府県で募集中の案件（最大4件）。
//
// 終了した案件も実績として検索に出すので、検索から来た人が
// 「応募できない」で行き止まりにならないよう、いま応募できる案件へつなぐ。
// 記事の関連案件（fetchRelatedPlaces）は足りない分をほかの県で埋めるが、
// ここは「同じ県で探している人」への案内なので、ほかの県では埋めない。
// 0件なら空で返し、画面側は一覧（/places）への案内だけにする。
async function fetchOpenPlacesInPrefecture(prefecture: string | null): Promise<RelatedPlace[]> {
  if (!prefecture) return []
  const client = db()
  if (!client) return []
  try {
    const { data, error } = await client
      .from('places')
      .select('id, title, prefecture, image_url')
      .eq('status', 'published')
      .eq('closed', false)
      .eq('prefecture', prefecture)
      // 並びは案件一覧と同じ（ピン留め→掲載日の新しい順）
      .order('pinned', { ascending: false })
      .order('posted_at', { ascending: false })
      .limit(4)
    if (error) return []
    return (data as RelatedPlace[] | null) ?? []
  } catch {
    // 読めなくても案件ページ自体は出す
    return []
  }
}

// ── 構造化データ（Event）────────────────────────────
//
// 運営が「一般の人が来場できる催し」と印を付けた案件（places.public_event = true）で、
// 日程（schedule）に日付があるものだけ Event として出す。それ以外は Place のまま。
//
// place_type='event' だけでは Event にしない。
// 実データ（2026-09 時点）で event 型かつ日付のある10件のうち、少なくとも5件は
// 社内イベント（日産 YY祭り）・社員家族向け（レゾナック FamilyDay）・参加登録の要る学会・
// 学内の営業日（東京保育専門学校）・オープンキャンパスだった。
// Google の Event の決まりでは、一般の人が参加できない催し（会員・招待が要るもの）、
// 営業日、学校内で主に未成年が参加する催しは対象外で、取り違えるとサイト全体の
// リッチリザルトが止められることがある。一般公開かどうかは place_type や説明文からは
// 機械的に決められないので、運営が案件ごとに印を付ける。
//
// public_event の列は 2026-09-16 時点で DB にまだ無い。無い間は全案件が Place になる。
// 列を足したら（select('*') で読んでいるので）ここは書き換えずに Event が出始める。
// 印を付けるときは、日程が案件名の日付と食い違っていないかも確かめること
// （例: 案件名「ノースフェスティバル2024年８月４日」に 2026-07-28〜30 の日程が入っている）。
//
// 常設（regular）は印があっても Event にしない。
// 日付のある案件28件のうち18件が常設で、中身はスーパーの駐車場に毎日30日分・
// 専門学校の構内に毎週、といった「営業日の一覧」だったため。
//
// 値は画面に出しているものだけを使う（日程・住所・写真・案件名・説明）。
//
// organizer は付けない。organizer は「催しを主催している人・団体」で、
// 主催は案件ごとに別の会社・学校（案件名や説明に出ている団体）。運営会社（株式会社nav）を
// 入れると事実と違う値になる。主催者を表す列は DB に無い（host_id も全件 null）。
//
// offers は付けない。出店料は出店者が払う額で、来場者向けの入場料や価格ではない。
// Event の offers に入れると「このイベントは○円」と読まれ、検索結果で誤解を生む。
//
// eventStatus は常に予定どおり（EventScheduled）。closed は「出店者の募集を締め切った」
// という意味で、催し自体の中止ではない。中止を表す値は DB に無いので作らない。

// 一般公開の催しの印。列がまだ無いので、Place の型には入れずここで読む
type PlaceRow = Place & { public_event?: boolean | null }

function isPublicEvent(p: PlaceRow): boolean {
  return p.place_type === 'event' && p.public_event === true
}

const DATE = /^\d{4}-\d{2}-\d{2}$/
// 日程の時刻には、フォームの初期値「選択してください」がそのまま入っている行がある。
// 時刻として読めるものだけを使い、読めなければ日付だけにする
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/

type ScheduleDay = { date: string; start: string; end: string }

function toTime(raw: string | undefined): string | null {
  const m = TIME.exec((raw ?? '').trim())
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null
}

// 日付の差（日数）。日本時間・UTC のどちらで数えても同じになるよう、日付だけで比べる
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}

// 日程を「連続した日のまとまり」に分ける。
//
// 2日連続の週末イベントは1つの Event（開始日〜終了日）でよいが、
// 毎週火曜のように飛び飛びの日程を最初の日〜最後の日の1件にすると、
// 間の日も開催しているように読めてしまう。そこで途切れるたびに別の Event にする
// （Google も、別々の日に開く催しは1回ずつ書くよう案内している）。
function scheduleRuns(schedule: Place['schedule']): { start: string; end: string }[] {
  const days: ScheduleDay[] = (Array.isArray(schedule) ? schedule : [])
    .filter((d): d is ScheduleDay => !!d && typeof d.date === 'string' && DATE.test(d.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
  const runs: { start: string; end: string }[] = []
  let first: ScheduleDay | null = null
  let last: ScheduleDay | null = null
  const flush = () => {
    if (!first || !last) return
    const st = toTime(first.start)
    const et = toTime(last.end)
    // 時刻が片方でも読めない、または同じ日で終わりが始まり以前（日をまたぐ入力など）なら、
    // 時刻を付けずに日付だけにする。誤った時刻を出すより、日付だけのほうが正しい
    const sameDayBad = first.date === last.date && !!st && !!et && et <= st
    if (st && et && !sameDayBad) {
      // 日程の時刻は日本時間で入力されている
      runs.push({ start: `${first.date}T${st}:00+09:00`, end: `${last.date}T${et}:00+09:00` })
    } else {
      runs.push({ start: first.date, end: last.date })
    }
  }
  for (const d of days) {
    // 同じ日付が2行ある、または前の日の翌日なら、同じまとまりに入れる
    if (last && dayDiff(last.date, d.date) <= 1) {
      last = d
      continue
    }
    flush()
    first = d
    last = d
  }
  flush()
  return runs
}

// 住所（PostalAddress）。画面の「アクセス」と同じ値を使う
function postalAddress(p: Place) {
  if (!p.address && !p.prefecture) return null
  return {
    '@type': 'PostalAddress',
    addressCountry: 'JP',
    ...(p.prefecture ? { addressRegion: p.prefecture } : {}),
    ...(p.address ? { streetAddress: p.address } : {}),
  }
}

function geo(p: Place) {
  return p.latitude != null && p.longitude != null
    ? { geo: { '@type': 'GeoCoordinates', latitude: p.latitude, longitude: p.longitude } }
    : {}
}

function placeJsonLd(p: PlaceRow, image: string | null) {
  // 運営が一般公開の催しと印を付けた event 型の案件だけ、日程を Event にする（上の説明）
  const runs = isPublicEvent(p) ? scheduleRuns(p.schedule) : []
  const address = postalAddress(p)
  const url = `${SITE_URL}/places/${p.id}`

  // Event は開催場所の住所が必須。住所が無い案件は日程があっても Place にしておく
  if (runs.length > 0 && address) {
    const events = runs.map(r => ({
      '@context': 'https://schema.org',
      '@type': 'Event',
      name: p.title,
      description: summarize(p),
      url,
      startDate: r.start,
      endDate: r.end,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
      // 施設名は案件名と別に持っていないので、場所は住所だけで表す（名前を作らない）
      location: { '@type': 'Place', address, ...geo(p) },
      ...(image ? { image: [image] } : {}),
    }))
    return events.length === 1 ? events[0] : events
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Place',
    name: p.title,
    description: summarize(p),
    url,
    ...(image ? { image } : {}),
    ...(p.address && address ? { address } : {}),
    ...geo(p),
  }
}

// 検索結果に出す説明文。案件の説明が無い場合は場所と募集内容から作る。
function summarize(p: Place): string {
  const parts: string[] = []
  // address に都道府県から入っていることが多いので、二重に出さない
  const addr = (p.address || '').trim()
  const where = p.prefecture && addr.startsWith(p.prefecture) ? addr : [p.prefecture, addr].filter(Boolean).join(' ')
  if (where) parts.push(where)
  if (p.recruit) parts.push('募集：' + p.recruit)
  const desc = (p.description || '').replace(/\s+/g, ' ').trim()
  if (desc) parts.push(desc)
  const text = parts.join('｜')
  return text.length > 120 ? text.slice(0, 119) + '…' : text || '出店者を募集しています。'
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const place = await fetchPlace(id)
  if (!place) return { title: '案件が見つかりません', robots: { index: false, follow: true } }
  // 募集終了した案件も noindex にしない（2026-09 に運営が決定）。
  // 以前は「応募できないページに検索から人を送らない」ため外していたが、
  // 施設名・写真・日程は出店実績として検索で見つけてもらう価値があり、
  // 外すと公開中306件のうち197件（2026-09-15 時点）のページを検索から捨てることになる。
  // 応募できないことはページ上部で知らせ、同じ県の募集中の案件へつなぐ（PlaceDetailClient）。

  // AGENTS.md のSEOルールの形式：{案件名}｜{都道府県}のキッチンカー出店場所 - 出店コネクトナビ
  const area = place.prefecture ? `｜${place.prefecture}のキッチンカー出店場所` : ''
  const title = `${place.title}${area}`
  const description = summarize(place)
  const image = place.image_url || (Array.isArray(place.images) ? place.images[0] : null)

  return {
    title: { absolute: `${title} - 出店コネクトナビ` },
    description,
    alternates: { canonical: `/places/${place.id}` },
    openGraph: {
      title,
      description,
      url: `/places/${place.id}`,
      type: 'article',
      images: image ? [image] : undefined,
    },
  }
}

export default async function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const place = await fetchPlace(id)

  // 公開中でない案件は、募集者本人なら見られる可能性があるので
  // ここでは 404 にせず、ブラウザ側の読み込みに任せる。
  // ただし、行そのものが無いIDは404にする（ソフト404を出さない）。
  if (!place) {
    if (!(await placeExists(id))) notFound()
    return <PlaceDetailClient id={id} initialPlace={null} />
  }

  const image = place.image_url || (Array.isArray(place.images) ? place.images[0] : null)
  // 募集中の案件には出さないので、終了した案件のときだけ読む
  const openNearby = place.closed ? await fetchOpenPlacesInPrefecture(place.prefecture) : []

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'ホーム', path: '/' },
          { name: '出店場所を探す', path: '/places' },
          { name: place.title, path: `/places/${place.id}` },
        ])}
      />
      <JsonLd data={placeJsonLd(place, image)} />
      <PlaceDetailClient
        id={id}
        initialPlace={place}
        openNearbyCount={openNearby.length}
        // 一覧はサーバーで描いて渡す。ブラウザ側で読み込むと、
        // 検索エンジンが見る HTML に募集中の案件へのリンクが出ない
        openNearby={
          openNearby.length > 0 ? (
            <RelatedPlaces
              places={openNearby}
              prefecture={place.prefecture}
              heading={`${place.prefecture}で募集中の出店場所`}
              lead={`この案件の募集は終了しましたが、${place.prefecture}ではほかにも出店者を募集している場所があります。`}
            />
          ) : null
        }
        // この案件が属するエリア別・カテゴリ別ページへの導線。
        // 募集終了の案件からも出す（終了案件は実績としてリンクしてよい）
        segmentLinks={<PlaceSegmentLinks prefecture={place.prefecture} genres={place.genres} />}
        // 「◯◯で募集中の案件を見る」の行き先。固有ページ（/places/area/{県}）が
        // ある県はそちらへ。判定は segments.ts が唯一の正で、参照はここ（サーバー）で済ませる。
        // PlaceDetailClient は 'use client' なので、あちらから import すると
        // 11セグメントぶんの表が案件詳細のクライアントJSに載ってしまう
        areaListHref={place.prefecture ? (segmentForFilter(place.prefecture, '')?.path ?? null) : null}
      />
    </>
  )
}
