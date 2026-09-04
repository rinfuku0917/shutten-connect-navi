import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import MeetingRequestForm from '../components/MeetingRequestForm'
import JsonLd from '../components/JsonLd'
import { SITE_URL, OG_DEFAULT_IMAGE } from '../lib/seo'
import { VENDOR_FAQ, faqJsonLd } from '../lib/faq'
import FaqList from '../components/FaqList'

// キッチンカーを呼びたい側（施設・イベント運営・企業・自治体）向けのページ。
// 「キッチンカー 手配」「キッチンカー 派遣」などで検索した方が最初に着く想定。

export const revalidate = 3600

export const metadata: Metadata = {
  title: { absolute: 'キッチンカーの手配・派遣 - 出店コネクトナビ' },
  description:
    'イベント・商業施設・オフィス・自治体の催しへ、キッチンカーの手配・派遣をご相談いただけます。出店者の募集から条件の調整、当日の運営までまとめてサポート。ご相談は無料、会員登録も不要です。',
  alternates: { canonical: '/vendor' },
  openGraph: {
    title: 'キッチンカーの手配・派遣なら出店コネクトナビ',
    description: 'イベント・施設へキッチンカーを呼びたい方へ。募集から当日の調整までまとめてサポートします。',
    url: '/vendor',
    type: 'website',
    images: [OG_DEFAULT_IMAGE],
  },
}

const CASES: { t: string; d: string; href?: string }[] = [
  { t: 'イベントに呼びたい', d: 'お祭り、マルシェ、スポーツ大会、学園祭など。来場者数と会場の広さに合わせて台数と業態を組みます。', href: '/vendor/event' },
  { t: '商業施設の空きスペースを活用したい', d: 'スーパーやホームセンターの駐車場、店舗前スペースなど。曜日を決めた定期出店にも対応できます。' },
  { t: '社内イベント・社員向けに手配したい', d: 'オフィスの昼食提供、社員感謝デー、周年イベントなど。社内向けの単発利用でもご相談いただけます。' },
  { t: '自治体・公共施設の催しに呼びたい', d: '市民まつり、防災訓練、公園イベントなど。必要な許可や書類の確認も含めてサポートします。' },
  { t: 'マンション・団地の住民向けに呼びたい', d: '住民向けの催しや、買い物が不便な地域での定期販売など。' },
  { t: '毎週・毎月決まった曜日に来てほしい', d: '単発ではなく継続的な出店をご希望の場合も、曜日と条件を決めて募集できます。' },
]

const CAN_DO = [
  { t: '目的に合う出店者を探せる', d: '登録している事業者から、業態・メニュー・車両サイズ・対応エリアで絞り込んでお探しします。' },
  { t: '募集から当日までまとめて', d: '出店者の募集、条件の調整、当日の連絡まで運営が窓口になります。個別のやり取りは不要です。' },
  { t: '条件を揃えて募集できる', d: '電源や水道の有無、搬入時間、NGメニューなどを先に決めた形で募集するので、話が食い違いません。' },
  { t: 'ご相談は無料', d: '会員登録も不要です。まだ日程が固まっていない段階からご相談いただけます。' },
]

const STEPS = [
  { t: 'ご相談（無料・登録不要）', d: '開催予定日・場所・想定人数をお知らせください。決まっていない項目があっても構いません。' },
  { t: '条件の整理とご提案', d: '会場の設備や搬入経路をうかがい、必要な台数と業態の組み合わせをご提案します。' },
  { t: '出店者の募集・選定', d: '条件を明記した募集を出し、応募のあった事業者から会場に合う出店者を選びます。' },
  { t: '当日の運営', d: '搬入時間や配置の連絡、当日の対応まで運営がサポートします。' },
]

// 募集を出すときに決めていただく項目。管理画面の入力項目と同じ並び。
const SETSUBI = [
  ['搬入・搬出時間', '会場に入れる時間と、片づけを終える時間'],
  ['電源', '使えるか、使える場合の容量。無い場合は発電機を持つ出店者を探します'],
  ['ガス機器', '会場で使用してよいか'],
  ['水道設備', '使えるか。無い場合は給排水タンクを備えた出店者を探します'],
  ['飲食スペース', '来場者が座って食べられる場所があるか'],
  ['ゴミの処理', '会場で引き取るか、出店者が持ち帰るか'],
  ['屋内・屋外／屋根', '屋根の有無。雨天時の対応に関わります'],
  ['高さ制限', '立体駐車場や軒下など、車両の高さに制限があるか'],
  ['雨天時の対応', '決行・中止・順延のいずれか'],
  ['希望メニュー・NGメニュー', '出してほしいもの、避けてほしいもの'],
]

export default function VendorPage() {
  // スマホでの文字の大きさを 24px → 21px に落とす。
  // 24px だと1行に13文字しか入らず、「出店コネクトナビでできること」が
  // 「出店コネクトナ / ビでできること」と割れていた。21px なら15文字入る。
  const H2: React.CSSProperties = { fontSize: 'clamp(20px,5.6vw,26px)', fontWeight: 900, textAlign: 'center', marginBottom: '10px', color: '#111' }
  const LEAD: React.CSSProperties = { fontSize: '14px', color: '#555', textAlign: 'center', lineHeight: 1.9, marginBottom: '32px' }
  const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #EEE', borderRadius: '14px', padding: '20px 18px' }

  return (
    <div>
      <SiteHeader />
      <JsonLd data={faqJsonLd(VENDOR_FAQ)} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'キッチンカーの手配・派遣',
          serviceType: 'キッチンカーの手配・派遣',
          description:
            'イベント・商業施設・オフィス・自治体の催しへキッチンカーを手配するサービス。出店者の募集から条件の調整、当日の運営までを代行します。',
          provider: { '@type': 'Organization', name: '株式会社nav', url: SITE_URL },
          areaServed: { '@type': 'Country', name: '日本' },
          url: `${SITE_URL}/vendor`,
        }}
      />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/' />
      </div>

      {/* ヒーロー */}
      <div style={{ background: 'linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url(/hero-bg.webp) center/cover no-repeat', padding: '56px 24px', textAlign: 'center' }}>
        {/* 背景写真が明るいので、文字の下に暗い面を敷いて読めるようにする */}
        <div style={{ maxWidth: '720px', margin: '0 auto 26px', background: 'rgba(0,0,0,0.55)', borderRadius: '18px', padding: '30px clamp(14px,4vw,26px)' }}>
          <h1 className='jp-head' style={{ fontSize: 'clamp(19px,5.1vw,30px)', fontWeight: 900, color: '#fff', marginBottom: '16px', lineHeight: 1.45 }}>
            <span className='u'>キッチンカーの手配・派遣</span>
            <br />
            <span className='u'>イベント・施設に呼ぶなら</span>
          </h1>
          <p className='jp-text' style={{ fontSize: '15px', color: '#fff', marginBottom: '10px', lineHeight: 1.9 }}>
            キッチンカーを呼びたい、出店を依頼したい、出張販売を手配したい。
            <br />
            施設運営者・イベント運営会社・企業・自治体のご担当者からのご相談を承ります。
          </p>
          <p className='jp-text' style={{ fontSize: '14px', color: '#FFE0A0', fontWeight: 700, margin: 0 }}>
            ご相談は無料、会員登録も不要です。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href='#soudan' style={{ background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '16px', padding: '14px 36px', borderRadius: '999px', textDecoration: 'none', boxShadow: '0 4px 15px rgba(245,166,35,0.4)' }}>まずは相談する</a>
          <Link href='/sellers' style={{ background: '#fff', color: '#111', fontWeight: 900, fontSize: '16px', padding: '14px 36px', borderRadius: '999px', textDecoration: 'none' }}>登録キッチンカーを見る</Link>
          <Link href='/register' style={{ background: 'rgba(255,255,255,0.16)', color: '#fff', fontWeight: 900, fontSize: '16px', border: '2px solid #fff', padding: '12px 34px', borderRadius: '999px', textDecoration: 'none' }}>無料会員登録</Link>
        </div>
      </div>

      {/* こんなときに */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>こんなときにご相談ください</h2>
          <p className='jp-text' style={LEAD}>キッチンカーを呼びたい理由は会場ごとに違います。まずは状況をお聞かせください。</p>
          <div className='grid-3' style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '16px' }}>
            {CASES.map(c => (
              <div key={c.t} style={CARD}>
                <div className='jp-head' style={{ fontWeight: 900, fontSize: '15px', color: '#111', marginBottom: '8px' }}>{c.t}</div>
                <div className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.8 }}>{c.d}</div>
                {c.href && (
                  <Link href={c.href} style={{ display: 'inline-block', marginTop: '10px', fontSize: '13px', fontWeight: 700, color: '#B45309', textDecoration: 'none' }}>
                    イベントの手配について詳しく →
                  </Link>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* できること */}
      <div style={{ background: '#FAFAFA', padding: '52px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>出店コネクトナビでできること</h2>
          <p className='jp-text' style={LEAD}>
            キッチンカー事業者と、出店場所をお持ちの施設・主催者をつなぐサービスです。
            現在 3,521 店舗の出店者が登録しています。
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '16px' }}>
            {CAN_DO.map(c => (
              <div key={c.t} style={CARD}>
                <div className='jp-head' style={{ fontWeight: 900, fontSize: '15px', color: '#111', marginBottom: '8px' }}>{c.t}</div>
                <div className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.8 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 流れ */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '900px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>ご相談から当日までの流れ</h2>
          <p className='jp-text' style={LEAD}>会員登録の前でもご相談いただけます。</p>
          <div className='grid-4' style={{ gap: '20px' }}>
            {STEPS.map((s, i) => (
              <div key={s.t} style={{ textAlign: 'center', padding: '16px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>{i + 1}</div>
                <div className='jp-head' style={{ fontWeight: 900, fontSize: '15px', marginBottom: '8px', color: '#111' }}>{s.t}</div>
                <div style={{ fontSize: '12px', color: '#111', lineHeight: 1.7 }}>{s.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 費用の考え方 */}
      <div id='cost' style={{ background: '#FAFAFA', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>掲載は無料です</h2>
          <p className='jp-text' style={LEAD}>
            募集の掲載に費用はかかりません。
            <br />
            どこまでを弊社にお任せいただくかで、2つの形からお選びいただけます。
          </p>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '16px', marginBottom: '18px' }}>
            {/* ご自身で運営する形 */}
            <div style={{ ...CARD, borderColor: '#CFE3D4' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{ background: '#2E7D32', color: '#fff', fontSize: '12px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>無料</span>
                <span className='jp-head' style={{ fontWeight: 900, fontSize: '17px', color: '#111' }}>ご自身で募集する</span>
              </div>
              <div style={{ background: '#FAFAFA', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#888', marginBottom: '4px' }}>費用</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#111' }}>0円</div>
              </div>
              <ul className='jp-text' style={{ fontSize: '13px', color: '#333', lineHeight: 2, paddingLeft: '20px', margin: 0 }}>
                <li>募集情報の掲載</li>
                <li>出店者からの応募の受付</li>
                <li>出店者とのやり取り、日程や条件の調整</li>
              </ul>
              <p className='jp-text' style={{ fontSize: '12.5px', color: '#666', lineHeight: 1.9, marginTop: '12px', marginBottom: 0 }}>
                掲載料・登録料・成約手数料はいただきません。出店者の選定や当日の段取りは、ご担当者さまで進めていただく形です。
              </p>
            </div>

            {/* 運営におまかせいただく形 */}
            <div style={{ ...CARD, borderColor: '#FFE0A0', background: '#FFFDF8' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '10px' }}>
                <span style={{ background: '#B45309', color: '#fff', fontSize: '12px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>おまかせ</span>
                <span className='jp-head' style={{ fontWeight: 900, fontSize: '17px', color: '#111' }}>運営をお任せいただく</span>
              </div>
              <div style={{ background: '#FFF8F0', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
                <div style={{ fontSize: '12px', fontWeight: 800, color: '#888', marginBottom: '4px' }}>費用</div>
                <div style={{ fontSize: '20px', fontWeight: 900, color: '#111' }}>
                  1台あたり 5,500円（税込）〜
                </div>
              </div>
              <ul className='jp-text' style={{ fontSize: '13px', color: '#333', lineHeight: 2, paddingLeft: '20px', margin: 0 }}>
                <li>会場に合う出店者への声かけと、候補のご提案</li>
                <li>条件のとりまとめと、出店者への周知</li>
                <li>当日の運営（搬入時間・配置の連絡、当日の対応）</li>
                <li>必要な書類（営業許可・保険など）の確認と、申請の代行</li>
              </ul>
              <p className='jp-text' style={{ fontSize: '12.5px', color: '#666', lineHeight: 1.9, marginTop: '12px', marginBottom: 0 }}>
                どの出店者に決めるかは、ご担当者さまで選んでいただくこともできます。
                現地での立ち会いも、イベントの規模や内容に応じてご相談いただけます。
                金額は台数・開催日数・会場の条件によって変わりますので、内容をうかがったうえでお見積りします。
              </p>
            </div>
          </div>

          <div style={{ ...CARD, fontSize: '14px', color: '#333', lineHeight: 2 }}>
            <div className='jp-head' style={{ fontWeight: 900, fontSize: '15px', color: '#111', marginBottom: '10px' }}>出店料の決まり方</div>
            <p className='jp-text' style={{ marginBottom: '14px' }}>
              出店者がお支払いする出店料は、次の2つを合わせた金額です。
            </p>
            <ul className='jp-text' style={{ paddingLeft: '20px', marginBottom: '14px' }}>
              <li>会場をご提供いただく施設・主催者へお渡しする分</li>
              <li>募集や調整にかかる弊社の運営分</li>
            </ul>
            <p className='jp-text' style={{ marginBottom: '14px' }}>
              固定額での設定のほか、売上に対する割合（歩合）での設定もできます。
              平日と土日祝で金額を分けることも可能です。
            </p>
            <p className='jp-text' style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>
              ご相談・お見積りは無料です。会員登録をされる場合も、初期費用や登録料はいただきません。
            </p>
            <Link
              href='/vendor/cost'
              style={{ display: 'inline-block', background: '#FFF8EC', border: '1px solid #F5D9A8', borderRadius: '10px', padding: '12px 18px', fontSize: '14px', fontWeight: 800, color: '#B45309', textDecoration: 'none' }}
            >
              キッチンカーを呼ぶ費用の相場とケース別の見積り例を見る →
            </Link>
          </div>
        </div>
      </div>

      {/* 設備・条件 */}
      <div id='setsubi' style={{ background: '#fff', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          {/* 17文字あり、スマホでは1行に入らない。
              「〜いただ / きたい設備・条件」と割れないよう、切る位置を指定する */}
          <h2 className='jp-head' style={H2}><span className='u'>事前にご確認いただきたい</span><wbr /><span className='u'>設備・条件</span></h2>
          <p className='jp-text' style={LEAD}>
            募集を出す前に、次の項目を決めていただきます。分からない項目はご相談の中で一緒に整理します。
          </p>
          <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
            {SETSUBI.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', gap: '16px', padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid #F0F0F0', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#111', minWidth: '170px' }}>{k}</div>
                <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.8, flex: 1 }}>{v}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.9, marginTop: '16px' }}>
            電源や水道がない会場でも、発電機や給排水タンクを備えたキッチンカーであれば出店できる場合があります。
            設備が揃っていないことを理由に諦めず、まずは会場の状況をお知らせください。
          </p>
        </div>
      </div>

      {/* 対応エリア */}
      <div style={{ background: '#FAFAFA', padding: '52px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          <h2 className='jp-head' style={H2}>対応エリア</h2>
          <p style={{ ...LEAD, marginBottom: '20px' }}>
            全国のイベント・施設に対応しています。
            現在掲載中の募集案件は「出店場所を探す」からご覧いただけます。
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href='/places' style={{ background: '#111', color: '#fff', fontWeight: 800, fontSize: '14px', padding: '12px 28px', borderRadius: '999px', textDecoration: 'none' }}>掲載中の募集案件を見る</Link>
            <Link href='/sellers' style={{ background: '#fff', color: '#111', fontWeight: 800, fontSize: '14px', border: '2px solid #111', padding: '10px 26px', borderRadius: '999px', textDecoration: 'none' }}>登録キッチンカーを見る</Link>
          </div>
        </div>
      </div>

      {/* よくあるご質問 */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>よくあるご質問</h2>
          <p className='jp-text' style={LEAD}>キッチンカーを呼びたい方からよくいただくご質問です。</p>
          <FaqList items={VENDOR_FAQ} />
        </div>
      </div>

      {/* 会員登録の前でも相談できる導線。掲載を迷っている段階の方向け */}
      <div id='soudan' style={{ background: '#FFF8F0', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>まずはご相談ください</h2>
          <p className='jp-text' style={LEAD}>
            会員登録は不要です。Zoomでも直接お伺いでも、ご都合の良い方法で承ります。
          </p>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #FFE0A0', padding: '28px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <MeetingRequestForm source='vendor' />
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
