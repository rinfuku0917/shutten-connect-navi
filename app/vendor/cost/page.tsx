import type { Metadata } from 'next'
import Link from 'next/link'
import SiteHeader from '../../components/SiteHeader'
import BackButton from '../../components/BackButton'
import SiteFooter from '../../components/SiteFooter'
import MeetingRequestForm from '../../components/MeetingRequestForm'
import JsonLd from '../../components/JsonLd'
import { SITE_URL, breadcrumbJsonLd } from '../../lib/seo'
import { COST_FAQ, faqJsonLd } from '../../lib/faq'
import { AREAS } from '../area/areas'

// 「キッチンカー 呼ぶ 費用」「キッチンカー 呼びたい 費用」「キッチンカー 手配 料金」
// などで検索した主催者・施設担当者が着く想定のページ。
//
// この語で調べる人は、まず「いくらかかるのか」だけを知りたい。
// なので結論（3つの形と金額）を最初に置き、そのあとにケース別の例を並べる。
// 金額は /vendor/event の3プランと必ず一致させること（食い違うと信用を失う）。

export const metadata: Metadata = {
  title: { absolute: 'キッチンカーを呼ぶ費用はいくら？料金の相場と決まり方｜出店コネクトナビ' },
  description:
    'キッチンカーを呼びたい方へ、費用の相場をまとめました。主催者の負担が0円になる条件、売上保証や商品買取の金額の目安、1台あたりいくらか、出張費やキャンセルの考え方まで。ご相談・お見積りは無料です。',
  alternates: { canonical: '/vendor/cost' },
  openGraph: {
    title: 'キッチンカーを呼ぶ費用はいくら？料金の相場と決まり方',
    description:
      '主催者の負担が0円になる条件、売上保証・商品買取の金額の目安、1台あたりの相場をまとめました。ご相談は無料です。',
    url: '/vendor/cost',
    type: 'website',
  },
}

// 3つの費用の形。金額は /vendor/event の PLANS と同じ数字を使う。
const FORMS: {
  tag: string
  tone: string
  bg: string
  name: string
  who: string
  cost: string
  rows: [string, string][]
  example: string
}[] = [
  {
    tag: '形A',
    tone: '#2E7D32',
    bg: '#F1F8F2',
    name: '通常出店',
    who: 'マルシェ、お祭り、商店街の催し、学園祭など、来場者が自分で買うイベント',
    cost: '主催者のご負担 0円〜（出店料を受け取る側になります）',
    rows: [
      ['出店料の目安（1台1日）', '小規模なフリマ・地域の催し 1,000円〜10,000円 ／ 中規模のマルシェ 10,000円〜50,000円'],
      ['売上に対する割合で決める場合', '売上の 10%〜20%'],
      ['主催者の持ち出し', '集客が見込めれば 0円'],
    ],
    example:
      '町内会の夏祭り（来場者500名程度）にキッチンカー3台。出店料を1台5,000円に設定 → 主催者側の受け取り 15,000円、ご負担は0円。',
  },
  {
    tag: '形B',
    tone: '#1565C0',
    bg: '#F0F6FC',
    name: '売上保証',
    who: '社員向け、会員向け、学校行事など、来場者数がある程度読めて売上が限られるイベント',
    cost: '保証額を決めて、売上が届かなかった差額のみご負担',
    rows: [
      ['保証額の目安（1台1日）', '20,000円〜80,000円'],
      ['大規模なイベントの場合', '100,000円程度になることもあります'],
      ['売上が保証額を超えたら', 'ご負担は0円'],
    ],
    example:
      '保証額を1台50,000円に設定。当日の売上が38,000円だった場合、差額の12,000円をご負担。売上が55,000円なら、ご負担は0円。',
  },
  {
    tag: '形C',
    tone: '#B45309',
    bg: '#FEF8EE',
    name: '商品買取',
    who: '来場者に無料で配る社内イベント、周年行事、お客様感謝デーなど',
    cost: 'メニュー単価 × 食数 ＋ 出張費・諸経費',
    rows: [
      ['メニュー単価の目安', '食事・丼もの 700円〜1,000円 ／ 軽食 400円〜600円 ／ スイーツ 500円〜800円 ／ ドリンク 300円〜500円'],
      ['出張費・諸経費の目安', '30,000円〜50,000円程度（距離により変わります）'],
      ['最低食数', '100食程度からのご相談が一般的です'],
    ],
    example:
      '社員100名に1食1,000円のカレーを配る場合：1,000円 × 100食 ＝ 100,000円 ＋ 出張費・諸経費 30,000円 ＝ 合計 130,000円程度（税別）。',
  },
]

// ケース別の見積り例。実際に相談の多い4つ。
const CASES: { title: string; scene: string; form: string; calc: string[]; total: string; tone: string }[] = [
  {
    title: '町内会の夏祭り',
    scene: '来場者500名程度／キッチンカー3台／1日',
    form: '形A 通常出店',
    calc: ['来場者が自分で購入するため、主催者の持ち出しなし', '出店料を1台5,000円に設定 → 3台で15,000円を受け取り'],
    total: 'ご負担 0円（受け取り 15,000円）',
    tone: '#2E7D32',
  },
  {
    title: '社員向けの感謝デー',
    scene: '社員100名に無料で配る／キッチンカー1台／1日',
    form: '形C 商品買取',
    calc: ['1食1,000円のカレー × 100食 ＝ 100,000円', '出張費・諸経費 30,000円'],
    total: '合計 130,000円程度（税別）',
    tone: '#B45309',
  },
  {
    title: '学校のオープンキャンパス',
    scene: '来場者200名程度／キッチンカー2台／1日',
    form: '形B 売上保証',
    calc: ['保証額を1台40,000円に設定（2台で80,000円）', '当日の合計売上が62,000円だった場合、差額18,000円をご負担'],
    total: 'ご負担 0円〜80,000円（売上次第）',
    tone: '#1565C0',
  },
  {
    title: '商業施設の週末イベント',
    scene: '土日2日間／キッチンカー4台',
    form: '形A 通常出店',
    calc: ['土日で来場が見込めるため、出店料を受け取る形', '出店料を1台1日8,000円に設定 → 4台×2日で64,000円を受け取り'],
    total: 'ご負担 0円（受け取り 64,000円）',
    tone: '#2E7D32',
  },
]

// 金額が動く理由。見積り前に主催者が押さえておくべき点。
const FACTORS: [string, string][] = [
  ['イベントの形', '来場者が自分で買うのか、主催者が配るのか。ここで費用の考え方そのものが変わります。もっとも大きな要因です。'],
  ['想定来場者数', '売上が見込めるほど出店者は集まりやすく、主催者側の負担は下がります。逆に来場が読めない場合は、売上保証をお願いすることがあります。'],
  ['台数と日数', '台数が増えれば受け取る出店料も増えます。買取の場合は台数と食数に比例します。'],
  ['曜日と時間帯', '土日祝や昼の時間帯は売上が見込めるため、条件を抑えやすくなります。平日の夕方などは保証が必要になることがあります。'],
  ['会場までの距離', '遠方は出張費がかかります。目安は3,000円〜50,000円程度です。近隣の出店者から順にお声がけします。'],
  ['電源・水道の有無', 'ない場合は発電機や給排水タンクを持つ出店者に限られるため、選べる台数が減り、条件が変わることがあります。'],
]

const SAVE: [string, string][] = [
  [
    '来場者が自分で買う形にする',
    'もっとも効果が大きい方法です。集客が見込めるイベントなら、主催者側の持ち出しは0円になり、逆に出店料を受け取れます。',
  ],
  [
    '人が集まる曜日・時間帯に寄せる',
    '土日祝や昼どきに合わせるだけで、出店者にとっての売上見込みが変わります。結果として保証や買取が不要になることがあります。',
  ],
  [
    '早めに相談する',
    '出店者は材料の手配や先々の出店を決めています。直前になるほど対応できる先が限られ、条件も選びにくくなります。最低でも2週間前、できれば1か月以上前が安心です。',
  ],
]

export default function VendorCostPage() {
  const H2: React.CSSProperties = {
    fontSize: 'clamp(21px,6.4vw,26px)',
    fontWeight: 900,
    textAlign: 'center',
    marginBottom: '10px',
    color: '#111',
  }
  const LEAD: React.CSSProperties = {
    fontSize: '14px',
    color: '#555',
    textAlign: 'center',
    lineHeight: 1.9,
    marginBottom: '32px',
  }
  const CARD: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #EEE',
    borderRadius: '14px',
    padding: '20px 18px',
  }

  return (
    <div>
      <SiteHeader />
      <JsonLd data={faqJsonLd(COST_FAQ)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'ホーム', path: '/' },
          { name: 'キッチンカーを呼びたい方へ', path: '/vendor' },
          { name: '費用と料金の相場', path: '/vendor/cost' },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Service',
          name: 'キッチンカーの手配・派遣',
          serviceType: 'キッチンカー手配',
          description:
            'イベント・商業施設・オフィスへキッチンカーを手配するサービス。通常出店・売上保証・商品買取の3つの形から、イベントに合わせてご提案します。',
          provider: { '@type': 'Organization', name: '株式会社nav', url: SITE_URL },
          areaServed: { '@type': 'Country', name: '日本' },
          url: `${SITE_URL}/vendor/cost`,
          offers: {
            '@type': 'Offer',
            description: '出店者の選定・お声がけ・条件のとりまとめ・当日の運営・書類の確認と申請',
            priceCurrency: 'JPY',
            price: '5500',
            priceSpecification: {
              '@type': 'PriceSpecification',
              priceCurrency: 'JPY',
              minPrice: '5500',
              description: '1台あたり5,500円（税込）から。台数・日数・会場の条件により変わります。',
            },
          },
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
        {' › 費用と料金の相場'}
      </div>

      {/* ヒーロー */}
      <div style={{ background: 'linear-gradient(rgba(0,0,0,0.55),rgba(0,0,0,0.55)),url(/hero-bg.webp) center/cover no-repeat', padding: '52px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto 24px' }}>
          <h1 className='jp-head' style={{ fontSize: 'clamp(21px,5.6vw,31px)', fontWeight: 900, color: '#fff', marginBottom: '16px', lineHeight: 1.45 }}>
            キッチンカーを呼ぶ費用はいくら？
            <br />
            料金の相場と決まり方
          </h1>
          <p className='jp-text' style={{ fontSize: '15px', color: '#fff', marginBottom: '10px', lineHeight: 1.9 }}>
            イベントの形によって、主催者のご負担は0円にも十数万円にもなります。
            <br />
            まず、どの形になるかを見てください。
          </p>
          <p className='jp-text' style={{ fontSize: '14px', color: '#FFE0A0', fontWeight: 700, margin: 0 }}>
            ご相談・お見積りは無料。会員登録も不要です。
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href='#soudan' style={{ background: '#F5A623', color: '#fff', fontWeight: 900, fontSize: '16px', padding: '14px 34px', borderRadius: '999px', textDecoration: 'none', boxShadow: '0 4px 15px rgba(245,166,35,0.4)' }}>無料で見積りを頼む</a>
          <a href='#forms' style={{ background: '#fff', color: '#111', fontWeight: 900, fontSize: '16px', padding: '14px 34px', borderRadius: '999px', textDecoration: 'none' }}>費用の目安を見る</a>
        </div>
      </div>

      {/* 結論 */}
      <div style={{ background: '#FFFDF8', padding: '44px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>結論：費用は3つの形のどれかで決まります</h2>
          <p className='jp-text' style={LEAD}>
            「1台いくら」という決まった料金表はありません。
            <br />
            来場者が自分で買うのか、主催者が配るのかで、負担する側が入れ替わるためです。
          </p>
          <div style={{ ...CARD, background: '#fff', borderColor: '#F5D9A8' }}>
            <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px', color: '#333', lineHeight: 2.1 }}>
              <li><strong>来場者が自分で買うイベント</strong> → 主催者のご負担は<strong>0円</strong>。むしろ出店料を受け取る側になります。</li>
              <li><strong>来場者数が読めないイベント</strong> → 売上が届かなかった<strong>差額だけ</strong>ご負担。1台1日20,000円〜80,000円の保証額が目安です。</li>
              <li><strong>無料で配るイベント</strong> → <strong>単価 × 食数 ＋ 出張費</strong>。1台100食で10万円前後が目安です。</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 3つの形 */}
      <div id='forms' style={{ background: '#fff', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>3つの形と、それぞれの金額</h2>
          <p className='jp-text' style={LEAD}>
            どの形になるかは、イベントの内容をうかがえばこちらで判断できます。
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {FORMS.map(f => (
              <div key={f.tag} style={{ ...CARD, background: f.bg, borderColor: f.tone + '33' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span style={{ background: f.tone, color: '#fff', fontSize: '12px', fontWeight: 900, padding: '3px 10px', borderRadius: '999px' }}>{f.tag}</span>
                  <span style={{ fontSize: '17px', fontWeight: 900, color: '#111' }}>{f.name}</span>
                </div>
                <p className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.9, marginBottom: '12px' }}>{f.who}</p>
                <div style={{ background: '#fff', borderRadius: '10px', padding: '12px 14px', marginBottom: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 800, color: '#888', marginBottom: '3px' }}>主催者のご負担</div>
                  <div style={{ fontSize: '15px', fontWeight: 900, color: f.tone, lineHeight: 1.6 }}>{f.cost}</div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', minWidth: '360px' }}>
                    <tbody>
                      {f.rows.map(([k, v]) => (
                        <tr key={k}>
                          <th style={{ textAlign: 'left', verticalAlign: 'top', padding: '7px 10px 7px 0', color: '#666', fontWeight: 700, whiteSpace: 'nowrap' }}>{k}</th>
                          <td style={{ padding: '7px 0', color: '#333', lineHeight: 1.8 }}>{v}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '12px', background: '#fff', borderLeft: '3px solid ' + f.tone, borderRadius: '0 8px 8px 0', padding: '10px 12px', fontSize: '13px', color: '#444', lineHeight: 1.9 }}>
                  <strong style={{ color: f.tone }}>例：</strong>{f.example}
                </div>
              </div>
            ))}
          </div>
          <p className='jp-text' style={{ fontSize: '13px', color: '#777', textAlign: 'center', marginTop: '22px', lineHeight: 1.9 }}>
            金額は目安です。内容・プランによって変わりますので、実際の条件をうかがったうえでお見積りします。
          </p>
        </div>
      </div>

      {/* ケース別の見積り例 */}
      <div style={{ background: '#FBF7F1', padding: '52px 24px' }}>
        <div style={{ maxWidth: '960px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>ケース別の見積り例</h2>
          <p className='jp-text' style={LEAD}>ご相談の多い4つの例です。近いものを目安にしてください。</p>
          <div className='cost-case-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {CASES.map(c => (
              <div key={c.title} style={{ ...CARD, minWidth: 0 }}>
                <div style={{ fontSize: '16px', fontWeight: 900, color: '#111', marginBottom: '4px' }}>{c.title}</div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '10px', lineHeight: 1.8 }}>{c.scene}</div>
                <span style={{ display: 'inline-block', background: c.tone + '18', color: c.tone, fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px', marginBottom: '10px' }}>{c.form}</span>
                <ul style={{ margin: '0 0 12px', paddingLeft: '18px', fontSize: '13px', color: '#444', lineHeight: 1.9 }}>
                  {c.calc.map(x => <li key={x}>{x}</li>)}
                </ul>
                <div style={{ background: '#FFF8EC', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', fontWeight: 900, color: '#111' }}>{c.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 費用が変わる理由 */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>費用が変わる6つの要因</h2>
          <p className='jp-text' style={LEAD}>お問い合わせの前に、この6つが分かっているとお見積りが早くなります。</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {FACTORS.map(([k, v], i) => (
              <div key={k} style={{ ...CARD, display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '16px 18px' }}>
                <span style={{ flexShrink: 0, width: '26px', height: '26px', borderRadius: '50%', background: '#F5A623', color: '#fff', fontSize: '13px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: '#111', marginBottom: '4px' }}>{k}</div>
                  <p className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 1.9, margin: 0 }}>{v}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 費用を抑える方法 */}
      <div style={{ background: '#F1F8F2', padding: '52px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>費用を抑える3つの方法</h2>
          <p className='jp-text' style={LEAD}>同じイベントでも、条件の決め方でご負担は変わります。</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {SAVE.map(([k, v], i) => (
              <div key={k} style={{ ...CARD, borderColor: '#CDE8D2' }}>
                <div style={{ fontSize: '15px', fontWeight: 900, color: '#2E7D32', marginBottom: '5px' }}>{i + 1}. {k}</div>
                <p className='jp-text' style={{ fontSize: '13px', color: '#444', lineHeight: 1.9, margin: 0 }}>{v}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 手配を任せる場合 */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>手配をお任せいただく場合の費用</h2>
          <p className='jp-text' style={LEAD}>掲載とご相談は無料です。運営までお任せいただく場合のみ費用をいただきます。</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }} className='cost-case-grid'>
            <div style={{ ...CARD, background: '#F1F8F2', borderColor: '#CDE8D2' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#2E7D32', marginBottom: '6px' }}>掲載・ご相談</div>
              <div style={{ fontSize: '26px', fontWeight: 900, color: '#111', marginBottom: '8px' }}>0円</div>
              <p className='jp-text' style={{ fontSize: '13px', color: '#444', lineHeight: 1.9, margin: 0 }}>
                募集の掲載、出店者からの応募の受付、メッセージのやり取りまで無料です。初期費用も登録料もいただきません。
              </p>
            </div>
            <div style={{ ...CARD, background: '#FFF8EC', borderColor: '#F5D9A8' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#B45309', marginBottom: '6px' }}>運営までお任せ</div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#111', marginBottom: '8px', lineHeight: 1.4 }}>1台あたり<br />5,500円（税込）〜</div>
              <p className='jp-text' style={{ fontSize: '13px', color: '#444', lineHeight: 1.9, margin: 0 }}>
                出店者の選定、お声がけ、条件のとりまとめ、当日の運営、書類の確認と申請までを承ります。
              </p>
            </div>
          </div>
          <p className='jp-text' style={{ fontSize: '13px', color: '#777', textAlign: 'center', marginTop: '18px', lineHeight: 1.9 }}>
            金額は台数・開催日数・会場の条件によって変わります。当日の立ち会いが必要かどうかも案件によって変わりますので、内容をうかがったうえでお見積りします。
          </p>
        </div>
      </div>

      {/* エリア別 */}
      <div style={{ background: '#FBF7F1', padding: '48px 24px' }}>
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>エリアから調べる</h2>
          <p className='jp-text' style={LEAD}>
            エリアごとに、登録している出店者の数と、いま募集中の案件を掲載しています。
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {AREAS.map(a => (
              <Link
                key={a.slug}
                href={`/vendor/area/${a.slug}`}
                style={{ background: '#fff', border: '1px solid #E7DCC8', borderRadius: '999px', padding: '10px 20px', fontSize: '14px', fontWeight: 800, color: '#B45309', textDecoration: 'none' }}
              >
                {a.name}のキッチンカー手配
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div style={{ background: '#fff', padding: '52px 24px' }}>
        <div style={{ maxWidth: '820px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>費用についてよくある質問</h2>
          <p className='jp-text' style={LEAD}>ここに無いことも、お気軽にお尋ねください。</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {COST_FAQ.map(f => (
              <details key={f.q} className='top3-faq' style={{ background: '#FBF7F1', borderRadius: '12px', padding: '14px 18px' }}>
                <summary style={{ fontSize: '14px', fontWeight: 800, color: '#111', cursor: 'pointer', lineHeight: 1.7 }}>{f.q}</summary>
                <p className='jp-text' style={{ fontSize: '13px', color: '#555', lineHeight: 2, margin: '10px 0 0' }}>{f.a}</p>
              </details>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '24px' }}>
            <Link href='/vendor' style={{ fontSize: '14px', fontWeight: 700, color: '#B45309' }}>
              手配の流れやサービス全体については、キッチンカーを呼びたい方へ →
            </Link>
          </div>
        </div>
      </div>

      {/* 相談フォーム */}
      <div id='soudan' style={{ background: '#FFF8EC', padding: '52px 24px', scrollMarginTop: '80px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          <h2 className='jp-head' style={H2}>無料でお見積りします</h2>
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
