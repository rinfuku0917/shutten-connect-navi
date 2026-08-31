import type { Metadata } from 'next'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
  description:
    '出店コネクトナビにおける個人情報の取り扱いについて定めたものです。',
  alternates: { canonical: '/privacy' },
  robots: { index: false, follow: true },
}

const sections: { title: string; body: string[] }[] = [
  { title: '1. 個人情報の定義', body: [
    '本プライバシーポリシーにおいて「個人情報」とは、個人情報保護法に定める個人情報、すなわち生存する個人に関する情報であって、氏名、生年月日、メールアドレスその他の記述等により特定の個人を識別することができる情報を指します。',
  ] },
  { title: '2. 個人情報の取得', body: [
    '当社は、利用者が本サービスの利用登録を行う際、またはお問い合わせを行う際に、氏名、メールアドレス、電話番号、事業に関する情報等を取得することがあります。',
    'これらの情報は、利用者ご本人による任意の入力に基づいて取得します。',
  ] },
  { title: '3. 個人情報の利用目的', body: [
    '当社は、取得した個人情報を以下の目的で利用します。',
    '本サービスの提供・運営のため、出店者と募集者のマッチングを行うため、利用者からのお問い合わせに対応するため、本サービスに関するご案内やお知らせをお送りするため、利用規約に違反する行為への対応のため、本サービスの改善・新サービスの開発に役立てるため。',
  ] },
  { title: '4. 個人情報の第三者提供', body: [
    '当社は、次に掲げる場合を除き、あらかじめ利用者の同意を得ることなく、第三者に個人情報を提供することはありません。',
    '法令に基づく場合、人の生命・身体または財産の保護のために必要がある場合、本サービスの運営に必要な範囲で業務委託先に提供する場合（この場合、委託先に対して適切な監督を行います）。',
    'なお、本サービスの性質上、出店者と募集者がマッチングする際には、相互の連絡に必要な範囲で登録情報の一部が相手方に開示されることがあります。',
  ] },
  { title: '5. 個人情報の管理', body: [
    '当社は、個人情報の漏洩、滅失またはき損を防止するため、適切な安全管理措置を講じます。',
    '当社は、個人情報の保管にあたり、信頼性の高い外部サービス（クラウドサービス等）を利用する場合があります。',
  ] },
  { title: '6. 個人情報の開示・訂正・削除', body: [
    '利用者は、当社に対して、自己の個人情報の開示、訂正、追加、削除、利用停止を求めることができます。',
    'これらのご請求については、下記のお問い合わせ窓口までご連絡ください。ご本人であることを確認のうえ、合理的な範囲で速やかに対応いたします。',
  ] },
  { title: '7. Cookie（クッキー）について', body: [
    '本サービスでは、利用者の利便性向上やサービス改善のため、Cookieおよび類似の技術を使用することがあります。',
    '利用者は、ブラウザの設定によりCookieを無効にすることができますが、その場合、本サービスの一部機能がご利用いただけないことがあります。',
  ] },
  { title: '8. アクセス解析ツールおよび情報の外部送信について', body: [
    '本サービスでは、サービスの利用状況を把握し改善に役立てるため、Google LLC が提供するアクセス解析ツール「Google アナリティクス」を使用しています。',
    'このツールは Cookie を利用して、閲覧されたページ、滞在時間、参照元、利用された端末やブラウザの種類、おおよその地域などの情報を収集します。これらの情報は Google LLC に送信され、同社のプライバシーポリシーに基づいて管理されます。氏名・住所・メールアドレスなど、個人を直接特定できる情報は送信していません。',
    '収集された情報は、統計的な分析およびサービスの改善のみに利用し、それ以外の目的では利用いたしません。',
    'Google アナリティクスによる情報収集を望まれない場合は、ブラウザの設定で Cookie を無効にするか、Google が提供する「Google アナリティクス オプトアウト アドオン」をご利用いただくことで停止できます。',
    'Google アナリティクスの利用規約およびプライバシーポリシーについては、Google LLC のウェブサイトをご確認ください。',
  ] },
  { title: '9. プライバシーポリシーの変更', body: [
    '当社は、法令の変更やサービス内容の変更等に伴い、本プライバシーポリシーを変更することがあります。変更後のプライバシーポリシーは、本サービス上に掲載した時点から効力を生じるものとします。',
  ] },
  { title: '10. お問い合わせ窓口', body: [
    '本プライバシーポリシーに関するお問い合わせ、個人情報の取扱いに関するご請求等は、以下までご連絡ください。',
    '株式会社nav',
    'メール: info@connect-navi.com',
    'お問い合わせフォーム: 当サイトのお問い合わせページをご利用ください。',
  ] },
]

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/' />
      </div>

      <div style={{ background: 'linear-gradient(rgba(245,166,35,0.78), rgba(232,130,12,0.88)), url(/hero-top.png) center/cover no-repeat', padding: '72px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>プライバシーポリシー</h1>
        <p style={{ fontSize: '14px', color: '#fff', marginTop: '10px', opacity: 0.95, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>個人情報の取扱いについて</p>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '32px 28px' }}>
          <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.9, marginBottom: '24px' }}>株式会社nav（以下「当社」といいます）は、当社が提供するサービス「出店コネクトナビ」における利用者の個人情報の取扱いについて、以下のとおりプライバシーポリシーを定めます。</p>
          {sections.map((sec) => (
            <div key={sec.title} style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#92400E', marginBottom: '10px' }}>{sec.title}</h2>
              {sec.body.map((p, i) => (
                <p key={i} style={{ fontSize: '14px', color: '#333', lineHeight: 1.9, marginBottom: '8px' }}>{p}</p>
              ))}
            </div>
          ))}
          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>制定日: 2026年6月24日</p>
        </div>

        <div style={{ textAlign: 'center', marginTop: '32px' }}>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
