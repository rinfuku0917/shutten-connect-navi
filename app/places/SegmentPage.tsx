import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import JsonLd from '../components/JsonLd'
import { SITE_URL, OG_DEFAULT_IMAGE, breadcrumbJsonLd } from '../lib/seo'
import {
  AREA_SEGMENTS, CATEGORY_SEGMENTS, findAreaSegment, findCategorySegment, findCrossSegment,
  segmentBreadcrumb, type Segment,
} from './segments'
import { findCopy, SEGMENT_META_TAIL } from './segmentCopy'
import { loadSegment, type SegmentFacts as Facts, type SegmentSet } from './segmentData'
import PlaceListRows from './PlaceListRows'
import SegmentFactsView from './SegmentFacts'

// エリア別・カテゴリ別・県×カテゴリの3種が共有するページ本体（サーバーコンポーネント）。
//
// 見出しの階層:
//   h1 は1つ（ページの主題）。h2 は節、h3 は h2 の内側だけ。階層は飛ばさない。
//   FAQ の質問は見出しにしない（h2 の中に質問を並べると h3 が増えて意味が薄れる）。
//
// 構造化データ:
//   BreadcrumbList（画面のパンくずと1対1）＋ CollectionPage/ItemList（画面に並べた
//   募集中の案件と順序・件数まで一致）＋ 画面に出した質問だけの FAQPage。
//   Event は出さない（AGENTS.md の条件＝place_type='event' かつ public_event=true かつ
//   日程に日付、のうち public_event 列が未作成で、event 型には社内イベント・学会・
//   学内の営業日が混ざっている。Event の判断は /places/[id] の責任範囲）。
//   Service・Organization も出さない（前者は呼びたい側に売る役務で /vendor/area の役目、
//   後者はトップに1つだけ）。
//
// 出店料:
//   1円も出さない。segmentData.ts が金額の列を読んでいないので、ここに値が来ない。

// ---- 共通文（見出し・注記・CTAの文言）----
// **ここは600字以内に収める。** 固有（手書き原稿＋数字の入る算出文）が
// 1,000字以上あるので「固有 ≧ 共通×1.5」になる。
// app/vendor/area は共通約900字 対 県固有331〜403字（共通が2.3〜2.7倍）で、
// どの県のページも中身が同じに見えていた。その比を逆転させるための上限。
const CTA_LEAD = '会員登録をすると、掲載中の案件に応募できます。登録と応募は無料です。'
const FETCH_FAILED = 'ただいま案件の一覧を取得できませんでした。しばらくしてからお試しください。'
const CLOSED_NOTE = 'このブロックの案件は募集を終えています。応募はできませんが、どんな会場がキッチンカーを受け入れてきたかの記録として掲載しています。'

// 出店者向けの記事への導線。11枚で共通（共通文の枠に入る）。
// 募集者向けの記事へはカテゴリページからだけ1本（segments.ts の hostArticle）。
const SELLER_ARTICLES: { slug: string; label: string }[] = [
  { slug: 'kitchen-car-location-guide', label: '出店場所の探し方' },
  { slug: 'weekday-food-truck-spots', label: '平日の出店場所はどこにあるか' },
  { slug: 'food-truck-fee-guide', label: '出店料の相場と決まり方' },
  { slug: 'kitchen-car-required-documents', label: '応募に必要な書類' },
]

const H2: React.CSSProperties = { fontSize: 'clamp(18px,4.8vw,22px)', fontWeight: 900, color: '#111', margin: '0 0 10px' }
const SECTION: React.CSSProperties = { maxWidth: '860px', margin: '0 auto', padding: '34px 16px' }
const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #EEE', borderRadius: '12px', padding: '16px 18px' }
const BODY: React.CSSProperties = { fontSize: '14px', color: '#444', lineHeight: 2, margin: '0 0 14px' }

/** title / description。件数が取れなかったときは件数を含まない文にする（「0件」と書かない）。
 *  canonical は必ず自ページの固定パス。layout の alternates.canonical を継がせない
 *  （過去に1,404ページでトップを正規URLと申告した事故がある）。 */
export function segmentMetadata(seg: Segment, facts: Facts | null): Metadata {
  const tail = SEGMENT_META_TAIL[seg.slug] ?? ''
  let head: string
  if (!facts || facts.total === 0) {
    head = `${seg.metaNoun}を掲載しています。`
  } else if (seg.achievementMode) {
    // 募集中がごく少ないページ。掲載合計を主語にし、「0件」とは書かない
    head = facts.open > 0
      ? `${seg.metaNoun}を、これまでに${facts.total}件掲載しています。いま募集中は${facts.open}件です。`
      : `${seg.metaNoun}を、これまでに${facts.total}件掲載しています。現在、募集中の案件はありません。`
  } else {
    head = `${seg.metaNoun}を${facts.total}件掲載しています。いま募集中は${facts.open}件、募集を終えた出店実績は${facts.done}件です。`
  }
  const description = head + tail
  return {
    title: { absolute: seg.title },
    description,
    alternates: { canonical: seg.path },
    openGraph: {
      title: seg.h1,
      description,
      url: seg.path,
      type: 'website',
      images: [OG_DEFAULT_IMAGE],
    },
  }
}

/** ページ本体が使う集合。generateMetadata からも呼ぶが、
 *  fetchPublishedPlaces が React の cache() で包まれているので取得は1回で済む。 */
export async function loadSegmentPage(seg: Segment): Promise<SegmentSet> {
  return loadSegment(seg)
}

function NumberCards({ facts }: { facts: Facts }) {
  const cards = [
    { label: '掲載している案件', value: facts.total, tone: '#B45309' },
    { label: 'いま募集中', value: facts.open, tone: '#2E7D32' },
    { label: '募集を終えた出店実績', value: facts.done, tone: '#64748B' },
  ]
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', margin: '0 0 18px' }}>
      {cards.map(c => (
        <div key={c.label} style={{ ...CARD, padding: '13px 10px', textAlign: 'center' }}>
          <div style={{ fontSize: '11.5px', fontWeight: 800, color: '#888', lineHeight: 1.5, marginBottom: '3px' }}>{c.label}</div>
          <div style={{ fontSize: 'clamp(22px,6.5vw,30px)', fontWeight: 900, color: c.tone, lineHeight: 1.2 }}>
            {c.value}
            <span style={{ fontSize: '14px', marginLeft: '2px' }}>件</span>
          </div>
        </div>
      ))}
    </div>
  )
}

/** 掲載している案件を並べるブロック。実績モードでは実績を先に出す */
function ListBlock({
  id, heading, note, places, empty,
}: { id: string; heading: string; note?: string; places: SegmentSet['open']; empty: string }) {
  return (
    <section id={id} style={{ marginBottom: '30px' }}>
      <h2 className='jp-head' style={H2}>{heading}</h2>
      {note && <p className='jp-text' style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.9, margin: '0 0 14px' }}>{note}</p>}
      {places.length > 0
        ? <PlaceListRows places={places} />
        : <p className='jp-text' style={{ fontSize: '13.5px', color: '#777', lineHeight: 1.9, margin: 0 }}>{empty}</p>}
    </section>
  )
}

export default async function SegmentPage({ seg }: { seg: Segment }) {
  const copy = findCopy(seg.slug)
  // 原稿が無い slug は segments.ts に入れない約束なので、ここに来たら設計の前提が崩れている。
  // 数字だけのページを出すくらいなら何も出さない
  if (!copy) throw new Error(`手書き原稿がありません: ${seg.slug}（app/places/segmentCopy.ts）`)

  const set = await loadSegmentPage(seg)
  const { facts } = set
  const crumbs = segmentBreadcrumb(seg)
  const parentArea = seg.kind === 'cross' && seg.areaSlug ? findAreaSegment(seg.areaSlug) : undefined
  const parentCategory = seg.kind === 'cross' && seg.tagSlug ? findCategorySegment(seg.tagSlug) : undefined

  const openHeading = `${seg.shortName}でいま募集中の出店場所（${facts.open}件）`
  const doneHeading = `${seg.shortName}の出店実績（募集は終了しています）（${facts.done}件）`

  const openBlock = (
    <ListBlock
      id='open'
      heading={openHeading}
      places={set.open}
      empty={set.ok
        ? `現在、${seg.shortName}で募集中の案件はありません。下の出店実績と、ほかのエリア・場所の種類からお探しください。`
        : FETCH_FAILED}
    />
  )
  const doneBlock = facts.done > 0 || !set.ok ? (
    <ListBlock
      id='done'
      heading={doneHeading}
      note={CLOSED_NOTE}
      places={set.done}
      empty={set.ok ? `${seg.shortName}では、募集を終えた案件はまだありません。` : FETCH_FAILED}
    />
  ) : null

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh' }}>
      <SiteHeader />

      <JsonLd data={breadcrumbJsonLd(crumbs)} />
      {/* ItemList は画面の「募集中」ブロックに並べたものだけ。
          応募できない実績（closed）は一覧の実体として申告しない。
          offers・価格・評価は入れない（出店料は出店者が払う額で、個別の額は画面に出していない） */}
      {set.ok && set.open.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: seg.h1,
            url: SITE_URL + seg.path,
            description: (SEGMENT_META_TAIL[seg.slug] ?? '').slice(0, 300),
            mainEntity: {
              '@type': 'ItemList',
              numberOfItems: set.open.length,
              itemListElement: set.open.map((p, i) => ({
                '@type': 'ListItem',
                position: i + 1,
                name: p.title,
                url: `${SITE_URL}/places/${p.id}`,
              })),
            },
          }}
        />
      )}
      {/* 画面に出している質問と同じものだけ（AGENTS.md：画面に出していない内容を
          構造化データにだけ書かない）。質問が0問のページでは出さない */}
      {copy.faq.length > 0 && (
        <JsonLd
          data={{
            '@context': 'https://schema.org',
            '@type': 'FAQPage',
            mainEntity: copy.faq.map(f => ({
              '@type': 'Question',
              name: f.q,
              acceptedAnswer: { '@type': 'Answer', text: f.a },
            })),
          }}
        />
      )}

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/places' />
      </div>

      {/* 画面のパンくず。中間URLは実在するページだけ（索引ページを作っていないので入れない） */}
      <nav
        aria-label='パンくず'
        style={{ maxWidth: '860px', margin: '0 auto', padding: '8px 16px 0', fontSize: '12px', color: '#888' }}
      >
        {crumbs.map((c, i) => (
          <span key={c.path}>
            {i > 0 && ' › '}
            {i === crumbs.length - 1
              ? <span>{c.name}</span>
              : <Link href={c.path} style={{ color: '#888', textDecoration: 'none' }}>{c.name}</Link>}
          </span>
        ))}
      </nav>

      <div style={{ ...SECTION, paddingTop: '18px' }}>
        <h1 className='jp-head' style={{ fontSize: 'clamp(21px,5.6vw,30px)', fontWeight: 900, color: '#111', lineHeight: 1.45, margin: '0 0 16px' }}>
          {seg.h1}
        </h1>

        {set.ok && <NumberCards facts={facts} />}

        {/* 実績モードのページは、募集中が少ないことを先に伝える（行き止まりにしない） */}
        {seg.achievementMode && copy.note && (
          <p
            className='jp-text'
            style={{ ...CARD, background: '#FFF8EC', borderColor: '#F5D9A8', fontSize: '13.5px', color: '#7A4A06', lineHeight: 1.95, margin: '0 0 16px' }}
          >
            {copy.note}
          </p>
        )}

        <p className='jp-text' style={{ ...BODY, marginBottom: 0 }}>{copy.lead}</p>
      </div>

      {/* 案件の一覧。実績モードは実績を上に繰り上げる */}
      <div style={{ ...SECTION, paddingTop: 0 }}>
        {seg.achievementMode
          ? <>{doneBlock}{openBlock}</>
          : <>{openBlock}{doneBlock}</>}
      </div>

      {/* 内訳（集計） */}
      <div style={{ background: '#fff' }}>
        <div style={SECTION}>
          <h2 className='jp-head' style={H2}>{seg.shortName}の案件の内訳</h2>
          {set.ok
            ? <SegmentFactsView name={seg.shortName} facts={facts} />
            : <p className='jp-text' style={{ fontSize: '13.5px', color: '#777', lineHeight: 1.9 }}>{FETCH_FAILED}</p>}
        </div>
      </div>

      {/* 手書き原稿 */}
      <div style={SECTION}>
        <h2 className='jp-head' style={H2}>{seg.shortName}で出店するときに知っておきたいこと</h2>
        {copy.intro.map(p => (
          <p key={p.slice(0, 20)} className='jp-text' style={BODY}>{p}</p>
        ))}
        {copy.points.map(pt => (
          <div key={pt.h} style={{ ...CARD, marginBottom: '10px' }}>
            <h3 className='jp-head' style={{ fontSize: '14.5px', fontWeight: 900, color: '#111', lineHeight: 1.6, margin: '0 0 6px' }}>
              {pt.h}
            </h3>
            <p className='jp-text' style={{ fontSize: '13.5px', color: '#444', lineHeight: 1.95, margin: 0 }}>{pt.body}</p>
          </div>
        ))}
      </div>

      {/* このページの実データでしか答えられない質問だけ。
          公開済の記事とぶつかる問い（平日の出店場所・単発と常設・土日・実績の有無・
          学園祭の時期・電源と水道・メニューの指定）は置かない。上の記事リンクで受ける */}
      {copy.faq.length > 0 && (
        <div style={{ background: '#fff' }}>
          <div style={SECTION}>
            <h2 className='jp-head' style={H2}>{seg.shortName}の案件についてのご質問</h2>
            {copy.faq.map(f => (
              <div key={f.q} style={{ ...CARD, marginBottom: '10px' }}>
                <p className='jp-head' style={{ fontSize: '14px', fontWeight: 900, color: '#111', lineHeight: 1.7, margin: '0 0 6px' }}>{f.q}</p>
                <p className='jp-text' style={{ fontSize: '13.5px', color: '#444', lineHeight: 1.95, margin: 0 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 県ページ：カテゴリー別の内訳 ／ カテゴリページ：都道府県別の内訳 ／ cross：親2枚へ */}
      <div style={SECTION}>
        {seg.kind === 'cross' ? (
          <>
            <h2 className='jp-head' style={H2}>もっと広く見る</h2>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {parentArea && (
                <Link href={parentArea.path} style={{ ...CARD, textDecoration: 'none', color: '#B45309', fontWeight: 800, fontSize: '13.5px' }}>
                  {parentArea.shortName}の出店場所をすべて見る →
                </Link>
              )}
              {parentCategory && (
                <Link href={parentCategory.path} style={{ ...CARD, textDecoration: 'none', color: '#B45309', fontWeight: 800, fontSize: '13.5px' }}>
                  {parentCategory.shortName}を全国で見る →
                </Link>
              )}
            </div>
          </>
        ) : seg.kind === 'area' ? (
          <>
            <h2 className='jp-head' style={H2}>{seg.shortName}のカテゴリー別の内訳</h2>
            <p className='jp-text' style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.9, margin: '0 0 12px' }}>
              カテゴリーが登録されているのは、掲載{facts.total}件のうち{facts.genresFilled}件です。
              登録のない案件はこの内訳に入らないので、件数は{seg.shortName}の会場すべてではありません。
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {facts.byGenre.map(e => {
                // その県×そのカテゴリの掛け合わせページがあればそこへ（東京都×大学・学校）。
                // 無ければ全国のカテゴリページへ。どちらも無いカテゴリは件数だけ出す
                const cat = CATEGORY_SEGMENTS.find(s => s.genre === e.label)
                const cross = seg.areaSlug && cat?.tagSlug
                  ? findCrossSegment(seg.areaSlug, cat.tagSlug)
                  : undefined
                const to = cross ?? cat
                return (
                  <li key={e.label}>
                    {to ? (
                      <Link href={to.path} style={{ ...CARD, padding: '9px 14px', fontSize: '13px', fontWeight: 700, color: '#B45309', textDecoration: 'none', display: 'block' }}>
                        {e.label} {e.count}件
                        {cross && <span style={{ fontWeight: 400, color: '#888' }}>（{seg.shortName}のページへ）</span>}
                      </Link>
                    ) : (
                      <span style={{ ...CARD, padding: '9px 14px', fontSize: '13px', color: '#777', display: 'block' }}>
                        {e.label} {e.count}件
                      </span>
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        ) : (
          <>
            <h2 className='jp-head' style={H2}>{seg.shortName}の都道府県別の内訳</h2>
            <p className='jp-text' style={{ fontSize: '13px', color: '#64748B', lineHeight: 1.9, margin: '0 0 12px' }}>
              掲載{facts.total}件を都道府県で数えたものです。都道府県ごとのページがある県はそのページへ、
              無い県は絞り込んだ一覧へつないでいます。
            </p>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {facts.byPref.map(e => {
                const area = AREA_SEGMENTS.find(s => s.pref === e.label)
                return (
                  <li key={e.label}>
                    <Link
                      href={area ? area.path : `/places?pref=${encodeURIComponent(e.label)}`}
                      style={{ ...CARD, padding: '9px 14px', fontSize: '13px', fontWeight: area ? 700 : 400, color: area ? '#B45309' : '#64748B', textDecoration: 'none', display: 'block' }}
                    >
                      {e.label} {e.count}件
                    </Link>
                  </li>
                )
              })}
            </ul>
          </>
        )}
      </div>

      {/* 兄弟ページ。/places のリンク帯と同じ役目だが、ここは同じ種類の兄弟だけに絞る */}
      <div style={{ background: '#FBF7F1' }}>
        <div style={SECTION}>
          <h2 className='jp-head' style={H2}>ほかのエリア・場所の種類から探す</h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
            {[...AREA_SEGMENTS, ...CATEGORY_SEGMENTS]
              .filter(s => s.slug !== seg.slug)
              .map(s => (
                <Link
                  key={s.slug}
                  href={s.path}
                  style={{ background: '#fff', border: '1px solid #E7DCC8', borderRadius: '999px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, color: '#B45309', textDecoration: 'none' }}
                >
                  {s.shortName}
                </Link>
              ))}
            <Link
              href='/places'
              style={{ background: '#fff', border: '1px solid #E7DCC8', borderRadius: '999px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, color: '#B45309', textDecoration: 'none' }}
            >
              全国の出店場所を条件で探す
            </Link>
          </div>

          <h3 style={{ fontSize: '13px', fontWeight: 800, color: '#666', margin: '0 0 9px' }}>出店する前に読んでおきたい記事</h3>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {SELLER_ARTICLES.map(a => (
              <Link
                key={a.slug}
                href={`/blog/${a.slug}`}
                style={{ background: '#fff', border: '1px solid #EEE', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', color: '#64748B', textDecoration: 'none' }}
              >
                {a.label} →
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* CTA。会員登録へ。呼びたい方向けのフォームはここには置かない */}
      <div style={{ background: '#FFF8EC' }}>
        <div style={{ ...SECTION, textAlign: 'center' }}>
          <h2 className='jp-head' style={{ ...H2, textAlign: 'center' }}>{seg.shortName}で出店したい方へ</h2>
          <p className='jp-text' style={{ fontSize: '13.5px', color: '#7A4A06', lineHeight: 1.95, margin: '0 0 16px' }}>{CTA_LEAD}</p>
          <Link
            href='/register'
            style={{ display: 'inline-block', background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '15px', padding: '13px 32px', borderRadius: '999px', textDecoration: 'none' }}
          >
            無料で会員登録する
          </Link>
        </div>
      </div>

      {/* 相互リンクは各1本に絞る（増やすと「出したい／呼びたい」の意図が混ざる）。
          県ページからは同じ県の呼びたい方向けページへ、
          カテゴリページからはそのジャンルに呼びたい施設向けの記事へ。cross からは張らない */}
      {(seg.vendorAreaSlug || seg.hostArticle) && (
        <div style={{ borderTop: '1px solid #F0E6D6' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto', padding: '18px 16px', fontSize: '13px', color: '#888' }}>
            {seg.vendorAreaSlug && (
              <Link href={`/vendor/area/${seg.vendorAreaSlug}`} style={{ color: '#64748B' }}>
                {seg.shortName}でキッチンカーを呼びたい施設・主催者の方へ →
              </Link>
            )}
            {seg.hostArticle && (
              <Link href={`/blog/${seg.hostArticle.slug}`} style={{ color: '#64748B' }}>
                {seg.hostArticle.label} →
              </Link>
            )}
          </div>
        </div>
      )}

      <SiteFooter />
    </div>
  )
}
