import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import SiteHeader from '../../../components/SiteHeader'
import BackButton from '../../../components/BackButton'
import SiteFooter from '../../../components/SiteFooter'
import MeetingRequestForm from '../../../components/MeetingRequestForm'
import JsonLd from '../../../components/JsonLd'
import { SITE_URL, OG_DEFAULT_IMAGE, breadcrumbJsonLd } from '../../../lib/seo'
import { COST_FAQ, faqJsonLd } from '../../../lib/faq'
import FaqList from '../../../components/FaqList'
import { AREAS, findArea, type Area } from '../areas'

// 「キッチンカー 呼びたい 費用 東京」のように、地名を足して調べる人向けのページ。
//
// 都県の名前だけ差し替えた同じページを並べても検索エンジンには評価されないので、
// ・そのエリアに登録している出店者の数
// ・そのエリアでいま募集中の案件
// という実際の数字を必ず載せる。文章側の違いは areas.ts に置いている。

export const revalidate = 3600

export function generateStaticParams() {
  return AREAS.map(a => ({ pref: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ pref: string }> }): Promise<Metadata> {
  const { pref } = await params
  const area = findArea(pref)
  if (!area) return {}
  return {
    title: { absolute: `${area.name}のキッチンカー手配・派遣 - 出店コネクトナビ` },
    description: `${area.name}でキッチンカーを呼びたい方へ。費用の相場、主催者の負担が0円になる条件、${area.name}に対応している出店者の数と募集中の案件をまとめています。1台からご相談可能、お見積りは無料です。`,
    alternates: { canonical: `/vendor/area/${area.slug}` },
    openGraph: {
      title: `${area.name}でキッチンカーを呼ぶ費用と手配の方法`,
      description: `${area.name}のイベント・施設へキッチンカーを手配します。費用の相場と、対応できる出店者の数をご覧いただけます。`,
      url: `/vendor/area/${area.slug}`,
      type: 'website',
      images: [OG_DEFAULT_IMAGE],
    },
  }
}

type Place = { id: string; title: string; prefecture: string | null; place_type: string | null }

async function fetchAreaData(area: Area): Promise<{ sellers: number; open: number; places: Place[] }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return { sellers: 0, open: 0, places: [] }
  const db = createClient(url, key, { auth: { persistSession: false } })

  // このエリアに対応している出店者の数。areas は配列なので、まとめて取って数える。
  let sellers = 0
  const CHUNK = 1000
  for (let from = 0; ; from += CHUNK) {
    const { data, error } = await db
      .from('profiles')
      .select('areas')
      .eq('role', 'seller')
      .eq('approval_status', 'approved')
      .range(from, from + CHUNK - 1)
    if (error || !data || data.length === 0) break
    for (const p of data) {
      const a = (p as { areas?: unknown }).areas
      const list = Array.isArray(a) ? a : typeof a === 'string' ? [a] : []
      if (list.some(x => String(x).includes(area.sellerKey))) sellers++
    }
    if (data.length < CHUNK) break
  }

  // 募集中の案件。公開中かつ終了していないものだけを出す。
  const { data: rows } = await db
    .from('places')
    .select('id, title, prefecture, place_type')
    .eq('status', 'published')
    .eq('closed', false)
    .eq('prefecture', area.dbPref)
    .order('created_at', { ascending: false })
    .limit(60)

  const places = (rows ?? []) as Place[]
  return { sellers, open: places.length, places: places.slice(0, 8) }
}

export default async function AreaPage({ params }: { params: Promise<{ pref: string }> }) {
  const { pref } = await params
  const area = findArea(pref)
  if (!area) notFound()

  let sellers = 0
  let open = 0
  let places: Place[] = []
  try {
    const d = await fetchAreaData(area)
    sellers = d.sellers
    open = d.open
    places = d.places
  } catch {
    // 数字が取れなくても、ページ自体は出す
  }

  const H2: React.CSSProperties = { fontSize: 'clamp(20px,5.6vw,25px)', fontWeight: 900, textAlign: 'center', marginBottom: '10px', color: '#111' }
  const LEAD: React.CSSProperties = { fontSize: '14px', color: '#555', textAlign: 'center', lineHeight: 1.9, marginBottom: '30px' }
  const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #EEE', borderRadius: '14px', padding: '20px 18px' }

  return (
    <div>
      <SiteHeader />
      <JsonLd data={faqJsonLd(COST_FAQ)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'ホーム', path: '/' },
          { name: 'キッチンカーを呼びたい方へ', path: '/vendor' },
          { name: '費用と料金の相場', path: '/vendor/cost' },
          { name: `${area.name}のキッチンカー手配`, path: `/vendor/area/${area.slug}` },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: `${area.name}のキッチンカー手配・派遣`,
          serviceType: 'キッチンカー手配',
          description: `${area.name}のイベント・商業施設・オフィス・学校へキッチンカーを手配するサービス。出店者の募集から条件の調整、当日の運営まで承ります。`,
          provider: { '@type': 'Organization', name: '株式会社nav', url: SITE_URL },
          areaServed: { '@type': 'AdministrativeArea', name: area.dbPref },
          url: `${SITE_URL}/vendor/area/${area.slug}`,
        }}
      />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/vendor/cost' />
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '8px 16px 0', fontSize: '12px', color: '#888' }}>
        <Link href='/' style={{ color: '#888', textDecoration: 'none' }}>ホーム</Link>
        {' › '}
        <Link href='/vendor' style={{ color: '#888', textDecoration: 'none' }}>キッチンカーを呼びたい方へ</Link>
        {' › '}
        <Link href='/vendor/cost' style={{ color: '#888', textDecoration: 'none' }}>費用と料金の相場</Link>
        {` › ${area.name}`}
      </div>

      {/* ヒーロー */}
      <div style={{ background: 'linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)),url(/hero-bg.webp) center/cover no-repeat', padding: '50px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto 22px' }}>
          <h1 className='jp-head' style={{ fontSize: 'clamp(19px,5.1vw,30px)', fontWeight: 900, color: '#fff', marginBottom: '14px', lineHeight: 1.45 }}>
            <span className='u'>{area.name}で</span><wbr /><span className='u'>キッチンカーを呼ぶ費用</span>
            <br />
            <span className='u'>手配・派遣の</span><wbr /><span className='u'>ご相談を承ります</span>
          </h1>
          <p className='jp-text' style={{ fontSize: '15px', color: '#fff', marginBottom: '8px', lineHeight: 1.9 }}>
            イベント、商業施設、オフィス、学校行事まで。1台からご相談いただけます。
          </p>
          <p className='jp-text' style={{ fontSize: '14px', color: '#FFE0A0', fontWeight: 700, margin: 0 }}>
            ご相談・お見積りは無料。会員登録も不要です。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href='#soudan' style={{ background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '16px', padding: '14px 34px', borderRadius: '999px', textDecoration: 'none', boxShadow: '0 4px 15px rgba(245,166,35,0.4)' }}>無料で見積りを頼む</a>
          <Link href='/vendor/cost' style={{ background: '#fff', color: '#111', fontWeight: 900, fontSize: '16px', padding: '14px 34px', borderRadius: '999px', textDecoration: 'none' }}>費用の相場を見る</Link>
        </div>
      </div>

      {/* 実数 */}
      <div style={{ background: '#FFFDF8', padding: '40px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }} className='cost-case-grid'>
            <div style={{ ...CARD, textAlign: 'center', background: '#fff', borderColor: '#F5D9A8' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#888', marginBottom: '4px' }}>{area.name}に対応できる出店者</div>
              <div style={{ fontSize: 'clamp(28px,8vw,38px)', fontWeight: 900, color: '#B45309', lineHeight: 1.2 }}>
                {sellers > 0 ? sellers.toLocaleString() : '—'}
                <span style={{ fontSize: '16px', marginLeft: '2px' }}>店舗</span>
              </div>
            </div>
            <div style={{ ...CARD, textAlign: 'center', background: '#fff', borderColor: '#CDE8D2' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#888', marginBottom: '4px' }}>{area.name}でいま募集中の案件</div>
              <div style={{ fontSize: 'clamp(28px,8vw,38px)', fontWeight: 900, color: '#2E7D32', lineHeight: 1.2 }}>
                {open > 0 ? open.toLocaleString() : '—'}
                <span style={{ fontSize: '16px', marginLeft: '2px' }}>件</span>
              </div>
            </div>
          </div>
          <p className='jp-text' style={{ fontSize: '14px', color: '#444', lineHeight: 2, marginTop: '22px' }}>
            {area.intro}
          </p>
        </div>
      </div>

      {/* 費用の目安 */}
      <div style={{ background: '#fff', padding: '48px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}><span className='u'>{area.name}で</span><wbr /><span className='u'>キッチンカーを呼ぶ費用の目安</span></h2>
          <p className='jp-text' style={LEAD}>
            費用はイベントの形で決まります。地域によって大きく変わるのは、会場までの距離にかかる出張費です。
          </p>
          {/* スマホではこの表が画面の幅に収まらず、横に送って読むことになる。
              以前は右へ送った時点で1列目の「通常出店／売上保証／商品買取」が画面の外へ出てしまい、
              いま見ている金額がどの形のものか分からなくなっていたため、
              管理画面の表と同じ .admin-table-wrap を当てて1列目を固定する。
              あわせて、いちばん読ませたい「金額の目安」の列が送り切れば丸ごと見えるように、
              表に効いていた下限の幅（520px）を外し、この列だけ2行に折り返せるようにした。
              幅375pxでの実測で、表の幅は520px→452px、横に送る量は193px→125pxになり、
              送り切った状態で1列目と金額が同時に見える。
              パソコンでは表が親の幅いっぱい（860px）に広がるので下限の幅も折り返しも働かず、
              列の幅・行の高さは変更前と同じ値になることを確認済み。 */}
          <div className='admin-table-wrap' style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: 0, background: '#fff' }}>
              <thead>
                <tr style={{ background: '#FBF7F1' }}>
                  {/* 固定する1列目には .admin-table-wrap が管理画面用の背景色を敷くので、
                      この表の見出し行の色を要素側で指定して行の色をそろえる */}
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#666', borderBottom: '1px solid #EEE', background: '#FBF7F1' }}>イベントの形</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#666', borderBottom: '1px solid #EEE' }}>主催者のご負担</th>
                  <th style={{ textAlign: 'left', padding: '10px 12px', fontSize: '12px', color: '#666', borderBottom: '1px solid #EEE' }}>金額の目安</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4', fontWeight: 800, color: '#2E7D32' }}>通常出店</td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4' }}>0円（受け取る側）</td>
                  {/* 金額の列は「出店料 1台1日」と金額の2つに分け、まとまりの中では折り返さない。
                      .nowrap-unit だけだと、列が狭くなったときにまとまりの内側で
                      「1,0／00円」のように数字が割れてしまうため、まとまり側にも改行させない指定を置く */}
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4', lineHeight: 1.8, whiteSpace: 'normal' }}>
                    <span className='nowrap-unit' style={{ whiteSpace: 'nowrap' }}>出店料 1台1日</span>{' '}<span className='nowrap-unit' style={{ whiteSpace: 'nowrap' }}>1,000円〜50,000円を受け取り</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4', fontWeight: 800, color: '#1565C0' }}>売上保証</td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4' }}>差額のみ</td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4', lineHeight: 1.8, whiteSpace: 'normal' }}>
                    <span className='nowrap-unit' style={{ whiteSpace: 'nowrap' }}>保証額 1台1日</span>{' '}<span className='nowrap-unit' style={{ whiteSpace: 'nowrap' }}>20,000円〜80,000円</span>
                  </td>
                </tr>
                <tr>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4', fontWeight: 800, color: '#B45309' }}>商品買取</td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4' }}>全額</td>
                  <td style={{ padding: '11px 12px', borderBottom: '1px solid #F4F4F4', lineHeight: 1.8, whiteSpace: 'normal' }}>
                    <span className='nowrap-unit' style={{ whiteSpace: 'nowrap' }}>単価 × 食数 ＋</span>{' '}<span className='nowrap-unit' style={{ whiteSpace: 'nowrap' }}>出張費30,000円〜50,000円</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className='jp-text' style={{ fontSize: '13px', color: '#777', marginTop: '16px', lineHeight: 1.9, textAlign: 'center' }}>
            金額は目安です。内容・プランによって変わります。
            {' '}
            <Link href='/vendor/cost' style={{ color: '#B45309', fontWeight: 700 }}>費用の考え方をくわしく見る →</Link>
          </p>
        </div>
      </div>

      {/* 会場の例 */}
      <div style={{ background: '#FBF7F1', padding: '48px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>{area.name}で多いご依頼</h2>
          <p className='jp-text' style={LEAD}>実際にご相談の多い会場です。</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '26px' }}>
            {area.venues.map(v => (
              <span key={v} style={{ background: '#fff', border: '1px solid #E7DCC8', borderRadius: '999px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, color: '#444' }}>{v}</span>
            ))}
          </div>
          <div style={{ ...CARD }}>
            <div style={{ fontSize: '15px', fontWeight: 900, color: '#111', marginBottom: '10px' }}>{area.name}でご相談いただくときの注意点</div>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#444', lineHeight: 2 }}>
              {area.notes.map(n => <li key={n} style={{ marginBottom: '6px' }}>{n}</li>)}
            </ul>
          </div>
        </div>
      </div>

      {/* 募集中の案件 */}
      {places.length > 0 && (
        <div style={{ background: '#fff', padding: '48px 24px' }}>
          <div style={{ maxWidth: '860px', margin: '0 auto' }}>
            <h2 className='jp-head' style={H2}><span className='u'>{area.name}で</span><wbr /><span className='u'>いま募集中の出店場所</span></h2>
            <p className='jp-text' style={LEAD}>
              実際に掲載中の案件です。逆に「出店したい」方は、ここから応募いただけます。
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {places.map(p => (
                <Link
                  key={p.id}
                  href={`/places/${p.id}`}
                  style={{ ...CARD, padding: '14px 16px', display: 'block', textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 800, color: '#111', lineHeight: 1.7 }}>{p.title}</div>
                  <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>{p.prefecture}</div>
                </Link>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <Link href='/places' style={{ fontSize: '14px', fontWeight: 700, color: '#B45309' }}>掲載中の出店場所をすべて見る →</Link>
            </div>
          </div>
        </div>
      )}

      {/* 対応市区町村 */}
      <div style={{ background: '#FFFDF8', padding: '44px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>{area.name}の対応エリア</h2>
          <p className='jp-text' style={LEAD}>
            下記は一例です。{area.name}全域と、近隣の県からもお伺いできます。
          </p>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {area.cities.map(c => (
              <span key={c} style={{ background: '#fff', border: '1px solid #EEE', borderRadius: '6px', padding: '6px 12px', fontSize: '13px', color: '#555' }}>{c}</span>
            ))}
          </div>
        </div>
      </div>

      {/* ほかのエリア */}
      <div style={{ background: '#FBF7F1', padding: '40px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 800, color: '#666', marginBottom: '14px' }}>ほかのエリアをご覧になる場合</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {AREAS.filter(a => a.slug !== area.slug).map(a => (
              <Link
                key={a.slug}
                href={`/vendor/area/${a.slug}`}
                style={{ background: '#fff', border: '1px solid #E7DCC8', borderRadius: '999px', padding: '10px 20px', fontSize: '14px', fontWeight: 800, color: '#B45309', textDecoration: 'none' }}
              >
                {a.name}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: '#fff', padding: '48px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>費用についてよくある質問</h2>
          <p className='jp-text' style={LEAD}>ここに無いことも、お気軽にお尋ねください。</p>
          <FaqList items={COST_FAQ} />
        </div>
      </div>

      {/* 相談フォーム */}
      <div id='soudan' style={{ background: '#FFF8EC', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}><span className='u'>{area.name}での</span><wbr /><span className='u'>ご相談はこちらから</span></h2>
          <p className='jp-text' style={LEAD}>
            開催日・場所・想定来場者数の3つが分かれば、おおよその金額をお伝えできます。
            <br />
            まだ決まっていない項目があっても構いません。
          </p>
          <MeetingRequestForm />
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
