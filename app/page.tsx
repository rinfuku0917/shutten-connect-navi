import Link from 'next/link'
import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import SiteHeader from './components/SiteHeader'
import SiteFooter from './components/SiteFooter'
import { Zen_Maru_Gothic, Zen_Kaku_Gothic_New } from 'next/font/google'
import { firstImage, thumbnailUrl } from './lib/postImage'
import { MERGED_SLUGS_FILTER } from './lib/mergedPosts'
import JsonLd from './components/JsonLd'
import { SITE_URL, SITE_NAME, ORG } from './lib/seo'
import CountUp from './components/CountUp'


// title と description は layout.tsx の既定をそのまま使う。
// canonical だけは、このページが正規であることを明示する。
export const metadata: Metadata = { alternates: { canonical: '/' } }

// デザイン見本(top-v3)指定フォント: 見出し=丸ゴシック / 本文=角ゴシック
const maru = Zen_Maru_Gothic({ weight: ['500', '700', '900'], subsets: ['latin'] })
const kaku = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700', '900'], subsets: ['latin'] })

// 見本のカラーパレット（黄色×ネイビー）
const C = {
  navy: '#1b3a5c',
  navyDeep: '#14293f',
  gold: '#f5a623',
  goldDeep: '#e08e0b',
  amber: '#f7b733',
  ink: '#2b2b2b',
  cream: '#fff8ec',
  cream2: '#fef2da',
  sky: '#eaf4fb',
  line: '#eee4d4',
  muted: '#7a7267',
  grayBg: '#f7f4ef',
}

type NewPlace = {
  id: string
  title: string
  prefecture: string | null
  image_url: string | null
  posted_at: string | null
  schedule: { date: string }[] | null
  open_days: string[] | null
  applications: { count: number }[]
  urgent: boolean | null
}
type WorkPlace = { id: string; title: string; image_url: string | null }
type BlogPost = { id: string; slug: string; title: string; category: string | null; cover_emoji: string | null; published_at: string | null; content: string | null }

// ヒーロー下2入口カード用の線画アイコン（見本デザイン準拠）
const TruckIcon = ({ color }: { color: string }) => (
  <svg viewBox='0 0 72 52' width='68' height='50' fill='none' stroke={color} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
    <path d='M8 12 h34' />
    <path d='M10 12 q2 5 5 0 q3 5 6 0 q3 5 6 0 q3 5 6 0 q3 5 5 0' strokeWidth='2.5' />
    <rect x='8' y='16' width='34' height='22' rx='3' />
    <rect x='14' y='22' width='13' height='8' rx='1.5' strokeWidth='2.5' />
    <path d='M42 20 h12 l8 8 v10 h-20' />
    <circle cx='20' cy='42' r='5' />
    <circle cx='54' cy='42' r='5' />
    <path d='M25 42 h24' strokeWidth='2.5' />
  </svg>
)
const BuildingIcon = ({ color }: { color: string }) => (
  <svg viewBox='0 0 64 52' width='60' height='50' fill='none' stroke={color} strokeWidth='3' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
    <rect x='12' y='6' width='26' height='40' rx='2' />
    <rect x='38' y='20' width='14' height='26' rx='2' />
    <path d='M18 14 h4 M28 14 h4 M18 22 h4 M28 22 h4 M18 30 h4 M28 30 h4' strokeWidth='2.5' />
    <path d='M42 27 h6 M42 34 h6' strokeWidth='2.5' />
    <path d='M22 46 v-7 h6 v7' strokeWidth='2.5' />
    <path d='M8 46 h48' />
  </svg>
)

const wrap: React.CSSProperties = { maxWidth: '1080px', margin: '0 auto', padding: '0 20px' }
const secHead: React.CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '26px', gap: '16px', flexWrap: 'wrap' }
const h2Style: React.CSSProperties = { fontSize: 'clamp(22px,3.2vw,29px)', fontWeight: 900, lineHeight: 1.3 }
const moreStyle: React.CSSProperties = { color: '#1b3a5c', textDecoration: 'none', fontWeight: 700, fontSize: '14px', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }

// 表示用の日程。schedule（構造化）が無ければ旧サイトから移行した
// open_days のテキストを使い、それも無ければ「日程調整中」。
function scheduleText(s: { date: string }[] | null, openDays?: string[] | null): string {
  const dates = (Array.isArray(s) ? s : []).map(d => d?.date).filter(Boolean).sort()
  if (dates.length > 0) {
    const fmt = (d: string) => d.replaceAll('-', '/')
    return dates.length === 1 ? fmt(dates[0]) : fmt(dates[0]) + ' ほか' + (dates.length - 1) + '日程'
  }
  const text = (openDays || []).map(x => (x || '').trim()).filter(Boolean)[0]
  return text || '日程調整中'
}

// バッジ: 急募(募集者が指定 または 開催7日以内) > 人気(応募5件以上) > 新着(掲載14日以内)
function badgeOf(p: NewPlace): { label: string; bg: string } | null {
  // フォームで「急募」にした案件は、開催日が先でも急募として出す
  if (p.urgent) return { label: '急募', bg: '#d13b3b' }
  const today = new Date().toISOString().slice(0, 10)
  const dates = (Array.isArray(p.schedule) ? p.schedule : []).map(d => d?.date).filter(Boolean).sort()
  const next = dates.find(d => d >= today)
  if (next) {
    const diff = (new Date(next).getTime() - new Date(today).getTime()) / 86400000
    if (diff <= 7) return { label: '急募', bg: '#d13b3b' }
  }
  const apps = p.applications?.[0]?.count || 0
  if (apps >= 5) return { label: '人気', bg: '#e0533d' }
  if (p.posted_at) {
    const age = (Date.now() - new Date(p.posted_at).getTime()) / 86400000
    if (age <= 14) return { label: '新着', bg: '#f5a623' }
  }
  return null
}

// トップに出す内容はサーバー側で読み込む。
// ブラウザ側で読み込んでいたころは、読み込み後にページが伸びるため
// 「実績紹介」「よくある質問」へのリンクが目的の場所からずれていた。
// あわせて、検索エンジンにも案件や記事が見えるようになる。
export const revalidate = 600

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

async function loadTop(): Promise<{ newPlaces: NewPlace[]; works: WorkPlace[]; posts: BlogPost[] }> {
  const empty = { newPlaces: [], works: [], posts: [] }
  const client = db()
  if (!client) return empty
  try {
    const [a, b, c] = await Promise.all([
      client.from('places')
        .select('id,title,prefecture,image_url,posted_at,schedule,open_days,urgent,applications(count)')
        .eq('status', 'published')
        .order('pinned', { ascending: false })
        .order('posted_at', { ascending: false })
        .limit(4),
      client.from('places')
        .select('id,title,image_url')
        .eq('status', 'published')
        .not('image_url', 'is', null)
        .order('pinned', { ascending: false })
        .order('posted_at', { ascending: false })
        .limit(6),
      client.from('posts')
        .select('id,slug,title,category,cover_emoji,published_at,content')
        .eq('status', 'published')
        // 別の記事に統合したものは出さない（app/lib/mergedPosts.ts）
        .not('slug', 'in', MERGED_SLUGS_FILTER)
        .order('published_at', { ascending: false })
        .limit(3),
    ])
    return {
      newPlaces: (a.data as NewPlace[] | null) ?? [],
      works: (b.data as WorkPlace[] | null) ?? [],
      posts: (c.data as BlogPost[] | null) ?? [],
    }
  } catch {
    // 読み込めなくてもトップは表示する
    return empty
  }
}

export default async function Home() {
  const { newPlaces, works, posts } = await loadTop()

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('ja-JP').replaceAll('/', '.') : ''

  return (
    <div className={kaku.className} style={{ background: '#fff', color: C.ink, lineHeight: 1.7, overflowX: 'hidden', minHeight: '100vh' }}>

      {/* HEADER */}
      <SiteHeader />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: ORG.name,
          alternateName: SITE_NAME,
          url: SITE_URL,
          logo: `${SITE_URL}/logo.svg`,
          description:
            'キッチンカー事業者と、出店場所をお持ちの施設・イベント主催者をつなぐマッチングサービスを運営しています。',
        }}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: SITE_NAME,
          url: SITE_URL,
          inLanguage: 'ja',
          publisher: { '@type': 'Organization', name: ORG.name, url: SITE_URL },
        }}
      />

      {/* HERO: イラスト画像1枚敷き（PC=横 / スマホ=縦を picture で出し分け） */}
      <header style={{ background: C.cream }}>
        <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '16px 16px 0' }}>
          {/* 幅と高さを書いておくと、写真が読み込まれる前から場所を確保できる。
              入れないと読み込み時にページが伸び、ページ内リンクの飛び先がずれる */}
          <picture>
            <source media='(max-width:640px)' srcSet='/hero-full-sp.webp' width='864' height='1821' />
            <img
              src='/hero-full.webp'
              alt='「どこへ行く？」が「ここに来る！」に。最高の人を最適な場所へナビゲート。キッチンカーと出店者、お客さんのイラスト'
              width='1774'
              height='887'
              style={{ width: '100%', height: 'auto', display: 'block', borderRadius: '18px' }}
            />
          </picture>
        </div>
        <div className='top3-gates2'>
          {([
            { key: 'seller', color: C.gold, deep: C.goldDeep, href: '/space', icon: <TruckIcon color={C.gold} />, t1: '出店場所を', t2: '探したい方', d1: 'キッチンカーとして', d2: '出店したい方はこちら' },
            { key: 'host', color: C.navy, deep: C.navy, href: '/vendor', icon: <BuildingIcon color={C.navy} />, t1: 'キッチンカーを', t2: '呼びたい方', d1: 'イベントや施設に', d2: '出店を呼びたい方はこちら' },
          ]).map(b => (
            <div key={b.key} className='top3-gate2' style={{ background: '#fff', borderRadius: '18px', border: '2px solid ' + b.color, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div style={{ padding: '22px 14px 0' }}>
                <div className='top3-gate2-head' style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', marginBottom: '12px' }}>
                  {b.icon}
                  <div className={maru.className + ' top3-gate2-title'} style={{ fontWeight: 900, color: b.deep, textAlign: 'left', lineHeight: 1.35 }}>{b.t1}<br />{b.t2}</div>
                </div>
                <div className='top3-gate2-desc' style={{ color: C.ink, lineHeight: 1.7, textAlign: 'center', marginBottom: '16px' }}>{b.d1}<br />{b.d2}</div>
              </div>
              <Link href={b.href} className={maru.className + ' top3-gate2-btn'} style={{ marginTop: 'auto', position: 'relative', display: 'block', textAlign: 'center', textDecoration: 'none', color: '#fff', fontWeight: 900, background: b.color, borderRadius: '14px 14px 15px 15px' }}>
                詳しく見る
                <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', width: '24px', height: '24px', borderRadius: '50%', background: '#fff', color: b.color, display: 'grid', placeItems: 'center', fontSize: '13px', fontWeight: 900 }}>→</span>
              </Link>
            </div>
          ))}
        </div>
      </header>

      {/* ページの主題。ヒーロー画像に文字が焼き込まれていて検索エンジンには
          読めないため、テキストとしても置いている。
          もとはヒーローの上にあったが、ファーストビューの見え方を優先して、
          メインビジュアルと2つの導線の下へ移した（2026-09-02）。
          h1 はページに1つだけ。位置を変えても検索での扱いは変わらない。 */}
      <div style={{ ...wrap, padding: '40px 20px 0' }}>
        <h1 className={maru.className + ' top3-lead'} style={{ ...h2Style, textAlign: 'center', margin: 0 }}>
          キッチンカーの手配・派遣と、出店場所探しをつなぐ「出店コネクトナビ」
        </h1>
      </div>

      {/* STATS */}
      <div style={{ ...wrap, padding: '28px 20px 36px' }}>
        <div className='top3-stats'>
          {([
            { img: '/ic-top-sellers.webp', value: 3521, label: '登録出店者' },
            { img: '/ic-top-places.webp', value: 301, suffix: '+', label: '出店場所' },
            { img: '/ic-top-line.webp', value: 2000, suffix: '+', label: 'LINE登録' },
            { img: '/ic-top-area.webp', text: '全国対応', label: '対応エリア拡大中', small: true },
          ] as { img: string; value?: number; suffix?: string; text?: string; label: string; small?: boolean }[]).map(s => (
            <div key={s.label} className='top3-stat'>
              <img src={s.img} alt='' style={{ height: '52px', width: '52px', objectFit: 'contain', display: 'block', margin: '0 auto 8px' }} />
              <div className={maru.className} style={{ fontSize: s.small ? 'clamp(20px,2.8vw,27px)' : 'clamp(26px,3.6vw,34px)', fontWeight: 900, color: C.navy, lineHeight: 1 }}>
                {s.value != null
                  ? <CountUp value={s.value} suffix={s.suffix} />
                  : s.text}
              </div>
              <div style={{ fontSize: '12.5px', color: C.muted, fontWeight: 700, marginTop: '6px' }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* NEW LISTINGS */}
      <section style={{ padding: '54px 0' }}>
        <div style={wrap}>
          <div style={secHead}>
            <h2 className={maru.className + ' top3-sechead-bar'} style={h2Style}>新着募集案件</h2>
            <Link href='/places' style={moreStyle}>すべての案件を見る <span style={{ color: C.gold }}>→</span></Link>
          </div>
          <div className='top3-cards'>
            {newPlaces.length === 0 && <div style={{ color: C.muted, fontSize: '14px' }}>読み込み中...</div>}
            {newPlaces.map(p => {
              const badge = badgeOf(p)
              return (
                <div key={p.id} className='top3-card' style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '14px', overflow: 'hidden' }}>
                  <div style={{ height: '100px', position: 'relative', background: p.image_url ? `url(${p.image_url}) center/cover no-repeat` : 'linear-gradient(135deg,#dfe8ef,#c9d6e2)', display: 'grid', placeItems: 'center' }}>
                    {!p.image_url && <span style={{ fontSize: '30px', opacity: .4 }}>🏬</span>}
                    {badge && <span style={{ position: 'absolute', top: '8px', left: '8px', fontSize: '11px', fontWeight: 900, color: '#fff', padding: '3px 10px', borderRadius: '6px', background: badge.bg }}>{badge.label}</span>}
                  </div>
                  <div style={{ padding: '12px 14px' }}>
                    <div className={maru.className} style={{ fontSize: '15px', fontWeight: 900, lineHeight: 1.4, marginBottom: '8px', minHeight: '42px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{p.title}</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginBottom: '3px' }}>📍 {p.prefecture || 'エリア未設定'}</div>
                    <div style={{ fontSize: '12px', color: C.muted, marginBottom: '12px' }}>{scheduleText(p.schedule, p.open_days)}</div>
                    <Link href={'/places/' + p.id} className='top3-cardbtn' style={{ display: 'block', textAlign: 'center', border: '1.5px solid ' + C.navy, color: C.navy, textDecoration: 'none', fontWeight: 700, fontSize: '13px', padding: '8px', borderRadius: '8px' }}>詳細を見る →</Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* WHICH ARE YOU */}
      <section style={{ padding: '54px 0', background: C.grayBg }}>
        <div style={wrap}>
          <h2 className={maru.className} style={{ ...h2Style, textAlign: 'center', marginBottom: '30px' }}>あなたはどちらですか？</h2>
          <div className='top3-which'>
            <div className='top3-wbox-seller' style={{ background: '#fff', borderRadius: '16px', padding: '28px 26px', border: '1px solid ' + C.line }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
                <img src='/ic-truck.webp' alt='' style={{ width: '80px', height: '80px', flexShrink: 0, objectFit: 'contain' }} />
                <div>
                  <div className={maru.className} style={{ fontSize: '20px', fontWeight: 900, marginBottom: '4px', color: C.goldDeep }}>出店場所を探したい方</div>
                  <div style={{ fontSize: '13px', color: C.muted }}>キッチンカーとして出店したい方はこちら</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0 }}>
                {['案件検索・応募', 'スケジュール管理', '売上レポート', '継続案件の紹介'].map(li => <li key={li} className='top3-wli'>{li}</li>)}
              </ul>
              <Link href='/space' className={maru.className} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: '15px', padding: '14px', borderRadius: '10px', background: C.gold }}>詳しく見る →</Link>
            </div>
            <div className='top3-wbox-host' style={{ background: '#fff', borderRadius: '16px', padding: '28px 26px', border: '1px solid ' + C.line }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '18px' }}>
                <img src='/ic-tent.webp' alt='' style={{ width: '80px', height: '80px', flexShrink: 0, objectFit: 'contain' }} />
                <div>
                  <div className={maru.className} style={{ fontSize: '20px', fontWeight: 900, marginBottom: '4px', color: C.navy }}>キッチンカーを呼びたい方</div>
                  <div style={{ fontSize: '13px', color: C.muted }}>イベントや施設に出店を呼びたい方はこちら</div>
                </div>
              </div>
              <ul style={{ listStyle: 'none', margin: '0 0 20px', padding: 0 }}>
                {['出店者募集', '応募者を比較・選定', 'メッセージ機能', '出店後のサポート'].map(li => <li key={li} className='top3-wli'>{li}</li>)}
              </ul>
              <Link href='/vendor' className={maru.className} style={{ display: 'block', textAlign: 'center', textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: '15px', padding: '14px', borderRadius: '10px', background: C.navy }}>詳しく見る →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FLOW */}
      <section style={{ padding: '54px 0' }}>
        <div style={wrap}>
          <h2 className={maru.className} style={{ ...h2Style, textAlign: 'center', marginBottom: '30px' }}>ご利用の流れ</h2>
          <div className='top3-flow'>
            {[
              { n: '1', img: '/ic-member.webp', h: '会員登録', p: '無料で簡単登録' },
              { n: '2', img: '/ic-search.webp', h: '案件を探す・応募', p: '条件を絞って検索' },
              { n: '3', img: '/ic-match.webp', h: 'マッチング・決定', p: '主催者と内容を調整' },
              { n: '4', img: '/ic-balloon.webp', h: '出店・開催', p: '当日は思いっきり営業！' },
            ].map(s => (
              <div key={s.n} className='top3-fstep'>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#fff', border: '2px solid ' + C.gold, color: C.goldDeep, fontWeight: 900, display: 'grid', placeItems: 'center', margin: '0 auto 12px', fontSize: '14px' }}>{s.n}</div>
                <img src={s.img} alt='' style={{ width: '70px', height: '70px', objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />
                <h3 className={maru.className} style={{ fontSize: '16px', fontWeight: 900, marginBottom: '6px', lineHeight: 1.3 }}>{s.h}</h3>
                <p style={{ fontSize: '12px', color: C.muted }}>{s.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKS */}
      <section id='works' style={{ padding: '54px 0', scrollMarginTop: '72px' }}>
        <div style={wrap}>
          <div style={secHead}>
            <h2 className={maru.className + ' top3-sechead-bar'} style={h2Style}>出店実績</h2>
            <Link href='/places' style={moreStyle}>すべての実績を見る <span style={{ color: C.gold }}>→</span></Link>
          </div>
          <div className='top3-works'>
            {works.length === 0 && <div style={{ color: C.muted, fontSize: '14px' }}>読み込み中...</div>}
            {works.map(w => (
              <Link key={w.id} href={'/places/' + w.id} className='top3-work' style={{ textDecoration: 'none', color: C.ink }}>
                <div style={{ height: '80px', background: w.image_url ? `url(${w.image_url}) center/cover no-repeat` : 'linear-gradient(135deg,#dfe8ef,#c9d6e2)', borderRadius: '10px' }}></div>
                <div style={{ padding: '7px 2px 0', fontSize: '12px', fontWeight: 700, textAlign: 'center', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{w.title}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ + BLOG */}
      <section id='faq' style={{ padding: '54px 0', background: C.cream, scrollMarginTop: '72px' }}>
        <div style={wrap}>
          <div className='top3-fb'>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
                <h2 className={maru.className + ' top3-sechead-bar'} style={{ fontSize: '22px', fontWeight: 900 }}>よくある質問</h2>
                <img src='/ic-mikan.webp' alt='' style={{ width: '58px', height: '58px', objectFit: 'contain', flexShrink: 0 }} />
              </div>
              {([
                { q: '登録に費用はかかりますか？', a: '会員登録・案件の閲覧・応募はすべて無料です。出店が決定した際の手数料については、案件ごとにご案内しています。', open: true },
                { q: '出店までの流れを教えてください', a: '会員登録 → 案件を探して応募 → 主催者とのマッチング・調整 → 出店当日、という流れです。詳しくは「ご利用の流れ」をご覧ください。' },
                { q: 'キッチンカーを呼びたいのですが、どうすればいいですか？', a: '施設や敷地の情報（場所・希望日・想定人数など）をお問い合わせフォームからお送りいただくだけでOKです。出店者の募集から選定・当日の調整まで、運営がまとめてサポートします。掲載やご相談は無料です。', cta: { href: '/vendor', label: 'キッチンカーを呼びたい方はこちら' } },
                { q: 'イベントを開催したいのですが、何から始めればいいですか？', a: '「まだ企画段階」という状態からでもご相談いただけます。開催日・場所・規模の目安をお知らせいただければ、キッチンカーの台数やジャンルの選定、募集スケジュールまで一緒に組み立てます。', cta: { href: '/contact', label: 'まずは相談してみる' } },
                { q: 'どのエリアに対応していますか？', a: '現在、全国のイベント・施設に対応しており、順次エリアを拡大しています。お近くの案件はサイト内で検索できます。' },
                { q: 'キャンセルは可能ですか？', a: 'やむを得ない事情でのキャンセルにも対応しています。詳細な条件は案件ごとにご確認いただけます。' },
              ] as { q: string; a: string; open?: boolean; cta?: { href: string; label: string } }[]).map(f => (
                <details key={f.q} className='top3-faq' open={f.open} style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '10px', marginBottom: '10px' }}>
                  <summary style={{ cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, fontSize: '14.5px' }}>
                    <span style={{ width: '24px', height: '24px', flexShrink: 0, borderRadius: '6px', background: C.gold, color: '#fff', fontWeight: 900, display: 'grid', placeItems: 'center', fontSize: '13px' }}>Q</span>
                    {f.q}
                    <span className='top3-pl' style={{ marginLeft: 'auto', fontSize: '20px', color: C.muted }}>+</span>
                  </summary>
                  <div style={{ padding: '0 16px 16px 52px', fontSize: '13.5px', color: C.muted }}>
                    {f.a}
                    {f.cta && (
                      <Link href={f.cta.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '10px', color: C.navy, fontWeight: 700, fontSize: '13px', textDecoration: 'none', borderBottom: '2px solid ' + C.gold, paddingBottom: '1px' }}>{f.cta.label} →</Link>
                    )}
                  </div>
                </details>
              ))}
              <Link href='/contact' style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: C.navy, textDecoration: 'none', fontWeight: 700, fontSize: '13.5px', marginTop: '6px' }}>その他のご質問はお問い合わせへ →</Link>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '20px' }}>
                <h2 className={maru.className + ' top3-sechead-bar'} style={{ fontSize: '22px', fontWeight: 900 }}>最新記事</h2>
                <img src='/ic-camera.webp' alt='' style={{ width: '58px', height: '58px', objectFit: 'contain', flexShrink: 0 }} />
              </div>
              {posts.length === 0 && <div style={{ color: C.muted, fontSize: '13px', padding: '8px 0' }}>記事は準備中です。</div>}
              {posts.map(b => (
                <Link key={b.id} href={'/blog/' + b.slug} className='top3-blogitem' style={{ display: 'block', background: '#fff', border: '1px solid ' + C.line, borderRadius: '10px', overflow: 'hidden', marginBottom: '12px', textDecoration: 'none', color: C.ink }}>
                  <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                    {/* 記事の本文にある画像をサムネイルに使う。ブログ一覧と同じ絵柄になる */}
                    {(() => {
                      const img = firstImage(b.content)
                      return img
                        ? <img src={thumbnailUrl(img)} alt='' width={96} height={64} loading='lazy' decoding='async' style={{ width: '96px', height: '64px', flexShrink: 0, objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '96px', height: '64px', flexShrink: 0, background: 'linear-gradient(135deg,#dfe8ef,#c9d6e2)', display: 'grid', placeItems: 'center', fontSize: '24px' }}>{b.cover_emoji || '📄'}</div>
                    })()}
                    <div style={{ padding: '8px 12px 8px 0', minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, lineHeight: 1.4, marginBottom: '5px', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.title}</div>
                      <div style={{ fontSize: '11px', color: C.muted, display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {b.category && <span style={{ fontSize: '10px', fontWeight: 700, color: C.goldDeep, background: C.cream2, padding: '2px 7px', borderRadius: '4px' }}>{b.category}</span>}
                        <span>{fmtDate(b.published_at)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
              <Link href='/blog' style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: C.navy, textDecoration: 'none', fontWeight: 700, fontSize: '13.5px' }}>すべての記事を見る →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* SIGNUP */}
      <div style={{ padding: '44px 0 56px' }}>
        <div style={wrap}>
          <div className='top3-signup' style={{ background: `linear-gradient(135deg,${C.cream2},#ffe9bd)`, borderRadius: '20px', padding: '28px 30px' }}>
            <div className='top3-signup-l'>
              <img src='/signup-banner.webp' alt='' className='top3-signup-img' style={{ borderRadius: '12px', display: 'block', flexShrink: 0 }} />
              <div>
                <h3 className={maru.className} style={{ fontSize: '22px', fontWeight: 900, marginBottom: '4px', lineHeight: 1.3 }}>まずは無料で会員登録</h3>
                <p style={{ fontSize: '13px', color: C.muted }}>案件の閲覧・応募には会員登録が必要です</p>
              </div>
            </div>
            <Link href='/register' className={maru.className + ' top3-cta'} style={{ background: C.gold, color: '#fff', textDecoration: 'none', fontWeight: 900, fontSize: '17px', padding: '16px 32px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', gap: '12px', whiteSpace: 'nowrap', flexShrink: 0 }}>
              無料で会員登録する
              <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'rgba(255,255,255,.25)', display: 'grid', placeItems: 'center', fontSize: '14px' }}>→</span>
            </Link>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <SiteFooter />
    </div>
  )
}
