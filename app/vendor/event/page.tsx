import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '../../components/SiteHeader'
import BackButton from '../../components/BackButton'
import SiteFooter from '../../components/SiteFooter'
import MeetingRequestForm from '../../components/MeetingRequestForm'
import JsonLd from '../../components/JsonLd'
import { SITE_URL, breadcrumbJsonLd } from '../../lib/seo'
import { EVENT_FAQ, VENDOR_FAQ, faqJsonLd } from '../../lib/faq'

// イベント・マルシェ・お祭りにフード出店を手配したい方向けのページ。
// 「イベント キッチンカー 手配」「フード出店 手配」「マルシェ 出店者 募集」
// などで検索した主催者が着く想定。

export const metadata: Metadata = {
  title: { absolute: 'イベントのフード出店を手配｜マルシェ・お祭りのキッチンカー募集なら出店コネクトナビ' },
  description:
    'イベントでの出店にお困りの方へ。マルシェ、地元のお祭り、商店街や自治会の催し、社内イベントへのフード出店・キッチンカーを手配します。1台からご相談可能、ご相談は無料です。',
  alternates: { canonical: '/vendor/event' },
  openGraph: {
    title: 'イベントのフード出店を手配｜マルシェ・お祭りのキッチンカー募集',
    description: 'マルシェ、地元のお祭り、社内イベントへのフード出店・キッチンカーを手配します。1台からご相談可能。',
    url: '/vendor/event',
    type: 'website',
  },
}

const SCENES = [
  { t: '小さなマルシェ', d: '手づくり市や朝市に、飲食の出店を数台だけ入れたい。会場の広さに合う台数をご提案します。' },
  { t: '地元のお祭り・盆踊り', d: '自治会や町内会の催しに屋台・キッチンカーを呼びたい。地域の方が食べやすいメニューで揃えます。' },
  { t: '商店街のイベント', d: '通行量を増やしたい、空き店舗前を活用したい。商店街の既存店と競合しないメニューで組みます。' },
  { t: '学校行事・学園祭', d: '学園祭、体育祭、オープンキャンパスなど。学生向けの価格帯に合わせた出店者を選びます。' },
  { t: '社内イベント・社員向け', d: '周年イベント、社員感謝デー、オフィスでの昼食提供など。' },
  { t: 'スポーツ大会・地域の催し', d: '運動会、マラソン大会、防災訓練、公園でのイベントなど。' },
]

const TROUBLES = [
  { t: '出店者の探し方が分からない', d: '知り合いのつてに頼るしかなく、毎回同じ顔ぶれになってしまう。登録している事業者からお探しします。' },
  { t: '声をかけても集まらない', d: '条件が伝わっていないと出店者は判断できません。設備・搬入・売上見込みを揃えた形で募集します。' },
  { t: '個別のやり取りが大変', d: '出店者ごとに連絡すると手間がかかります。運営が窓口になり、まとめて調整します。' },
  { t: 'メニューが偏ってしまう', d: '同じような食べ物ばかりにならないよう、募集の段階で組み合わせを調整します。' },
  { t: '何を決めればいいか分からない', d: '電源、水道、ゴミ、搬入時間など、必要な項目をこちらから順にお聞きします。' },
  { t: '直前になって決まっていない', d: '空いている出店者が見つかれば直前でも手配できる場合があります。まずはご相談ください。' },
]

// 費用の3つの形。金額は業界の公開相場をもとにした目安で、
// ページにも「内容・プランによって変わります」と明記している。
const PLANS: { tag: string; tone: string; name: string; when: string; cost: string; notes: string[]; example?: string }[] = [
  {
    tag: '形A',
    tone: '#2E7D32',
    name: '通常出店（来場者が自分で購入する）',
    when: 'マルシェ、地元のお祭り、商店街のイベント、学園祭など、来場者が飲食を買うイベント。もっとも多い形です。',
    cost: '主催者のご負担なし〜（出店料を受け取る側になります）',
    notes: [
      '集客が見込めるイベントでは、主催者側の持ち出しはありません',
      '逆に、出店者から出店料を受け取ることができます',
      '出店料の目安（1台1日）：小規模なフリマ・地域の催しで 1,000円〜10,000円、中規模のマルシェで 10,000円〜50,000円',
      '売上に対する割合（歩合）で設定する場合の目安：売上の 10%〜20%',
      '来場者が少ないと見込まれる場合は、この形をお勧めしないことがあります',
    ],
    example:
      '町内会の夏祭り（来場者500名程度）にキッチンカー3台。出店料を1台5,000円で設定 → 主催者側の受け取り 15,000円、ご負担は0円。',
  },
  {
    tag: '形B',
    tone: '#1565C0',
    name: '売上保証（足りなかった分だけ負担する）',
    when: '社員向け、会員向け、学校行事など、来場者数がある程度読めて、売上が限られるイベント。出店者が赤字にならないよう、主催者側で下支えします。',
    cost: '1台1日 20,000円〜80,000円 の保証額を設定し、売上が届かなかった差額のみご負担',
    notes: [
      '当日の売上が保証額を上回れば、ご負担は0円です',
      '大規模なイベントでは保証額が 100,000円程度になることもあります',
      '出店者にとっては最低限の売上が見込めるため、集まりやすくなります',
    ],
    example:
      '保証額を1台 50,000円に設定。当日の売上が 38,000円だった場合、差額の 12,000円をご負担いただきます。売上が 55,000円なら、ご負担は0円です。',
  },
  {
    tag: '形C',
    tone: '#B45309',
    name: '商品買取（主催者が食数分を買い取る）',
    when: '来場者に無料で配りたい社内イベントや、周年行事・お客様感謝デーなど。売上が発生しないため、主催者側が食数分を買い取ります。',
    cost: 'メニュー単価 × 食数 ＋ 出張費・諸経費',
    notes: [
      'メニュー単価の目安：食事・丼もの 700円〜1,000円、軽食 400円〜600円、スイーツ 500円〜800円、ドリンク 300円〜500円',
      '出張費・諸経費の目安：30,000円〜50,000円程度（距離により変わります）',
      '100食程度からのご相談が一般的です',
    ],
    example:
      '社員100名に1食1,000円のカレーを配る場合：1,000円 × 100食 ＝ 100,000円 ＋ 出張費・諸経費 30,000円 ＝ 合計 130,000円程度（税別）。',
  },
]

const PREP = [
  ['開催日と時間', '複数日程の候補があればお知らせください'],
  ['場所（住所）', '会場名と、車両を停める場所の広さ。1台あたり軽トラック型で約3m×5m、1tトラック型で約3.5m×6mが目安です'],
  ['想定来場者数', 'おおよそで構いません。台数の目安になります'],
  ['電源の有無', '1台あたり1,500W程度を使う車両が一般的です。無い場合は発電機を持つ出店者を探します'],
  ['水道の有無', '無い場合は給排水タンクを備えた出店者を探します'],
  ['出店料の考え方', '出店者に払っていただくか、主催者側でご負担いただくか'],
  ['希望メニュー・NGメニュー', '近隣の飲食店と競合させたくない場合もお知らせください'],
  ['雨天時の対応', '決行・中止・順延のいずれか'],
]

export default function EventVendorPage() {
  const H2: React.CSSProperties = { fontSize: 'clamp(21px,6.4vw,26px)', fontWeight: 900, textAlign: 'center', marginBottom: '10px', color: '#111' }
  const LEAD: React.CSSProperties = { fontSize: '14px', color: '#555', textAlign: 'center', lineHeight: 1.9, marginBottom: '32px' }
  const CARD: React.CSSProperties = { background: '#fff', border: '1px solid #EEE', borderRadius: '14px', padding: '20px 18px' }
  const faqAll = [...EVENT_FAQ, ...VENDOR_FAQ]

  return (
    <div>
      <SiteHeader />
      <JsonLd data={faqJsonLd(faqAll)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'ホーム', path: '/' },
          { name: 'キッチンカーを呼びたい方へ', path: '/vendor' },
          { name: 'イベント・マルシェ・お祭り', path: '/vendor/event' },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'イベントへのフード出店・キッチンカー手配',
          serviceType: 'イベントのフード出店手配',
          description:
            'マルシェ、地元のお祭り、商店街の催し、学校行事、社内イベントなどへ、フード出店・キッチンカーを手配するサービス。出店者の募集から条件の調整、当日の運営までを代行します。',
          provider: { '@type': 'Organization', name: '株式会社nav', url: SITE_URL },
          areaServed: { '@type': 'Country', name: '日本' },
          url: `${SITE_URL}/vendor/event`,
        }}
      />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/vendor' />
      </div>

      {/* パンくず（構造化データと同じものを画面にも出す） */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '8px 16px 0', fontSize: '12px', color: '#888' }}>
        <Link href='/' style={{ color: '#888', textDecoration: 'none' }}>ホーム</Link>
        {' › '}
        <Link href='/vendor' style={{ color: '#888', textDecoration: 'none' }}>キッチンカーを呼びたい方へ</Link>
        {' › イベント・マルシェ・お祭り'}
      </div>

      {/* ヒーロー */}
      <div style={{ background: 'linear-gradient(rgba(0,0,0,0.5),rgba(0,0,0,0.5)),url(/hero-poster.webp) center/cover no-repeat', padding: '56px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto 26px', background: 'rgba(0,0,0,0.55)', borderRadius: '18px', padding: '30px clamp(14px,4vw,26px)' }}>
          <h1 className='jp-head' style={{ fontSize: 'clamp(20px,5.6vw,30px)', fontWeight: 900, color: '#fff', marginBottom: '16px', lineHeight: 1.45 }}>
            イベントでの出店にお困りの方へ
            <br />
            フード出店を手配します
          </h1>
          <p className='jp-text' style={{ fontSize: '15px', color: '#fff', marginBottom: '10px', lineHeight: 1.9 }}>
            小さなマルシェ、地元のお祭り、商店街や自治会の催し、学校行事、社内イベント。
            <br />
            キッチンカーや飲食の出店者が集まらずお困りでしたら、ご相談ください。
          </p>
          <p className='jp-text' style={{ fontSize: '14px', color: '#FFE0A0', fontWeight: 700, margin: 0 }}>
            1台からご相談いただけます。ご相談は無料、会員登録も不要です。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href='#soudan' style={{ background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '16px', padding: '14px 36px', borderRadius: '999px', textDecoration: 'none', boxShadow: '0 4px 15px rgba(245,166,35,0.4)' }}>まずは相談する</a>
          <a href='#cost' style={{ background: '#fff', color: '#111', fontWeight: 900, fontSize: '16px', padding: '14px 36px', borderRadius: '999px', textDecoration: 'none' }}>費用の目安を見る</a>
        </div>
      </div>

      {/* こんなイベントに */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>こんなイベントに手配しています</h2>
          <p className='jp-text' style={LEAD}>規模は問いません。数百人の地域の催しから、企業のイベントまでご相談いただけます。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '16px' }}>
            {SCENES.map(c => (
              <div key={c.t} style={CARD}>
                <div className='jp-head' style={{ fontWeight: 900, fontSize: '15px', color: '#111', marginBottom: '8px' }}>{c.t}</div>
                <div className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.8 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* お困りごと */}
      <div style={{ background: '#FAFAFA', padding: '52px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>イベントの出店でよくあるお困りごと</h2>
          <p className='jp-text' style={LEAD}>ひとつでも当てはまるものがあれば、お力になれます。</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: '16px' }}>
            {TROUBLES.map(c => (
              <div key={c.t} style={CARD}>
                <div className='jp-head' style={{ fontWeight: 900, fontSize: '15px', color: '#111', marginBottom: '8px' }}>{c.t}</div>
                <div className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.8 }}>{c.d}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* いつまでに */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>いつまでにご相談いただくとよいか</h2>
          <p className='jp-text' style={LEAD}>開催日の2週間前までを目安にご相談ください。</p>
          <div style={{ ...CARD, fontSize: '14px', color: '#333', lineHeight: 2 }}>
            <p style={{ marginBottom: '14px' }}>
              <strong>最低でも開催日の2週間前まで</strong>にご相談いただくのが目安です。
              直前のご相談でも、空いている出店者が見つかれば手配できる場合がありますので、
              日程が迫っている場合もまずはお問い合わせください。
            </p>
            <p style={{ marginBottom: '14px' }}>
              ただし、出店者は当日に向けて材料を手配します。また、先の出店予定を早い段階から
              押さえているため、直前だと空いている事業者が限られます。
              <strong>早めにご相談いただくほど、条件に合う出店者を集めやすくなります。</strong>
            </p>
            <p style={{ color: '#666', fontSize: '13px', margin: 0 }}>
              開催日と場所が決まった時点でご連絡いただくのが確実です。
              台数やメニューが固まっていない段階でも構いません。
            </p>
          </div>
        </div>
      </div>

      {/* 費用の目安（見積り例） */}
      <div id='cost' style={{ background: '#FAFAFA', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>費用の目安</h2>
          <p style={{ ...LEAD, marginBottom: '12px' }}>
            キッチンカーを呼ぶときの費用は、3つの形のどれかになります。
            <br />
            来場者が自分で購入するイベントか、主催者側が用意するイベントかで変わります。
          </p>
          <p style={{ fontSize: '13px', color: '#B45309', fontWeight: 700, textAlign: 'center', lineHeight: 1.9, marginBottom: '28px' }}>
            ※ 下記は一般的な相場をもとにした目安です。内容・プランによって変わりますので、個別にお見積りします。
          </p>

          <div style={{ display: 'grid', gap: '16px' }}>
            {PLANS.map(p => (
              <div key={p.name} style={CARD}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap', marginBottom: '10px' }}>
                  <span style={{ background: p.tone, color: '#fff', fontSize: '12px', fontWeight: 800, padding: '4px 10px', borderRadius: '999px' }}>{p.tag}</span>
                  <span style={{ fontWeight: 900, fontSize: '17px', color: '#111' }}>{p.name}</span>
                </div>
                <p style={{ fontSize: '13px', color: '#555', lineHeight: 1.9, marginBottom: '12px' }}>{p.when}</p>
                <div style={{ background: '#FAFAFA', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#888', marginBottom: '6px' }}>主催者のご負担</div>
                  <div style={{ fontSize: '18px', fontWeight: 900, color: '#111', lineHeight: 1.5 }}>{p.cost}</div>
                </div>
                <ul style={{ fontSize: '13px', color: '#333', lineHeight: 2, paddingLeft: '20px', margin: 0 }}>
                  {p.notes.map(n => <li key={n}>{n}</li>)}
                </ul>
                {p.example && (
                  <div style={{ marginTop: '12px', borderLeft: '3px solid #F5A623', paddingLeft: '12px', fontSize: '13px', color: '#444', lineHeight: 1.9 }}>
                    <strong>見積り例：</strong>{p.example}
                  </div>
                )}
              </div>
            ))}

            <div style={{ ...CARD, borderColor: '#CFE3D4' }}>
              <div className='jp-head' style={{ fontWeight: 900, fontSize: '16px', color: '#111', marginBottom: '10px' }}>
                募集の掲載は無料です
              </div>
              <p className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.9, margin: 0 }}>
                ご自身で募集を出し、応募のあった出店者とやり取りしていただく形であれば、掲載料・登録料・成約手数料はかかりません。
                出店者への声かけから当日の運営、書類の申請までお任せいただく場合のみ、上記とは別に
                <strong>1台あたり5,500円（税込）から</strong>の費用を申し受けます。
                台数や開催日数によって変わるため、ご相談のうえお見積りします。
              </p>
            </div>

            <div style={CARD}>
              <div className='jp-head' style={{ fontWeight: 900, fontSize: '16px', color: '#111', marginBottom: '10px' }}>
                金額が変わる主な要素
              </div>
              <ul style={{ fontSize: '13px', color: '#333', lineHeight: 2, paddingLeft: '20px', margin: 0 }}>
                <li>開催日（土日祝は平日の2倍程度になることがあります）と開催時間の長さ</li>
                <li>台数（1台あたりの目安 × 台数が基本です）</li>
                <li>会場までの距離（遠方は出張費がかかります。目安 3,000円〜50,000円程度）</li>
                <li>電源・水道の有無（発電機やタンクが必要な場合）</li>
                <li>メニューの指定や、特別な設営のご要望</li>
              </ul>
            </div>
          </div>

          <p style={{ fontSize: '13px', color: '#666', lineHeight: 1.9, marginTop: '20px', textAlign: 'center' }}>
            ご相談とお見積りは無料です。会場・開催日・想定人数をお知らせいただければ、
            <br />
            そのイベントに合った形と金額をご提案します。
          </p>
        </div>
      </div>

      {/* 準備いただくこと */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>ご相談時にお聞きすること</h2>
          <p className='jp-text' style={LEAD}>すべて決まっていなくても構いません。分かる範囲でお知らせください。</p>
          <div style={{ ...CARD, padding: 0, overflow: 'hidden' }}>
            {PREP.map(([k, v], i) => (
              <div key={k} style={{ display: 'flex', gap: '16px', padding: '14px 18px', borderTop: i === 0 ? 'none' : '1px solid #F0F0F0', flexWrap: 'wrap' }}>
                <div style={{ fontWeight: 800, fontSize: '14px', color: '#111', minWidth: '170px' }}>{k}</div>
                <div style={{ fontSize: '13px', color: '#555', lineHeight: 1.8, flex: 1 }}>{v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: '#FAFAFA', padding: '52px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>よくあるご質問</h2>
          <p className='jp-text' style={LEAD}>イベントの主催者からよくいただくご質問です。</p>
          <div>
            {faqAll.map((f, i) => (
              <div key={f.q} style={{ padding: '18px 0', borderTop: i === 0 ? 'none' : '1px solid #E8E8E8' }}>
                <h3 className='jp-head' style={{ fontWeight: 900, fontSize: '15px', color: '#111', marginBottom: '8px' }}>{f.q}</h3>
                <p className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.9 }}>{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 相談フォーム */}
      <div id='soudan' style={{ background: '#FFF8F0', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>まずはご相談ください</h2>
          <p className='jp-text' style={LEAD}>
            会員登録は不要です。開催日と場所が決まっていなくても構いません。
          </p>
          <div style={{ background: '#fff', borderRadius: '16px', border: '1px solid #FFE0A0', padding: '28px 24px', boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
            <MeetingRequestForm source='vendor-event' />
          </div>
          <p style={{ fontSize: '13px', color: '#666', textAlign: 'center', marginTop: '20px' }}>
            施設への常設出店や、定期的な出店については
            <Link href='/vendor' style={{ color: '#B45309', fontWeight: 700 }}>キッチンカーを呼びたい方へ</Link>
            をご覧ください。
          </p>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
