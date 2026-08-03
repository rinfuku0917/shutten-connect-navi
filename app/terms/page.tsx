'use client'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'
import Link from 'next/link'

const sections: { title: string; body: string[] }[] = [
  { title: '第1条（適用）', body: [
    '本規約は、株式会社nav（以下「当社」といいます）が提供する出店場所・出店者のマッチングサービス「出店コネクトナビ」（以下「本サービス」といいます）の利用に関する条件を、本サービスを利用するすべての方（以下「利用者」といいます）と当社との間で定めるものです。',
    '利用者は、本規約に同意したうえで本サービスを利用するものとします。',
  ] },
  { title: '第2条（定義）', body: [
    '本規約において使用する用語の定義は、次のとおりとします。',
    '「出店者」とは、本サービスを通じて出店場所を探す利用者をいいます。',
    '「募集者」とは、本サービスを通じて出店場所を提供・募集する利用者をいいます。',
    '「コンテンツ」とは、本サービス上に掲載される文章、画像、その他の情報をいいます。',
  ] },
  { title: '第3条（利用登録）', body: [
    '本サービスの利用を希望する者は、本規約に同意のうえ、当社所定の方法により利用登録を申請するものとします。',
    '当社は、登録申請者が次の各号のいずれかに該当する場合、登録を承認しないことがあります。虚偽の事項を届け出た場合、過去に本規約に違反したことがある場合、その他当社が登録を不適当と判断した場合。',
  ] },
  { title: '第4条（アカウントの管理）', body: [
    '利用者は、自己の責任において、本サービスのアカウント情報を管理するものとします。',
    'アカウント情報の管理不十分による損害について、当社は一切の責任を負いません。',
  ] },
  { title: '第5条（マッチングについて）', body: [
    '本サービスは、出店者と募集者の間のマッチングの機会を提供するものであり、両者間で成立する個別の契約の当事者とはなりません。',
    '出店者と募集者の間で生じた取引、連絡、紛争等については、当事者間の責任において解決するものとし、当社は一切の責任を負いません。',
  ] },
  { title: '第6条（禁止事項）', body: [
    '利用者は、本サービスの利用にあたり、次の行為をしてはなりません。',
    '法令または公序良俗に違反する行為、犯罪行為に関連する行為、当社や第三者の権利を侵害する行為、虚偽の情報を登録・掲載する行為、本サービスの運営を妨害する行為、その他当社が不適切と判断する行為。',
  ] },
  { title: '第7条（本サービスの提供の停止等）', body: [
    '当社は、システムの保守点検、天災等の不可抗力、その他運営上または技術上やむを得ない事由が生じた場合、利用者に事前に通知することなく本サービスの全部または一部の提供を停止または中断することができます。',
    'これにより利用者に生じた損害について、当社は一切の責任を負いません。',
  ] },
  { title: '第8条（利用制限および登録抹消）', body: [
    '当社は、利用者が本規約に違反した場合、事前の通知なく、当該利用者に対して本サービスの利用を制限し、または登録を抹消することができます。',
  ] },
  { title: '第9条（免責事項）', body: [
    '当社は、本サービスに事実上または法律上の瑕疵がないことを明示的にも黙示的にも保証するものではありません。',
    '当社は、本サービスに起因して利用者に生じたあらゆる損害について、当社の故意または重過失による場合を除き、一切の責任を負いません。',
  ] },
  { title: '第10条（サービス内容の変更等）', body: [
    '当社は、利用者への事前の通知をもって、本サービスの内容を変更し、または本サービスの提供を終了することができます。これにより利用者に生じた損害について、当社は一切の責任を負いません。',
  ] },
  { title: '第11条（利用規約の変更）', body: [
    '当社は、必要と判断した場合には、利用者に通知することなくいつでも本規約を変更することができるものとします。変更後の規約は、本サービス上に掲載した時点から効力を生じるものとします。',
  ] },
  { title: '第12条（準拠法・裁判管轄）', body: [
    '本規約の解釈にあたっては、日本法を準拠法とします。',
    '本サービスに関して紛争が生じた場合には、当社の本店所在地を管轄する裁判所を専属的合意管轄とします。',
  ] },
]

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <SiteHeader />

      <div style={{ background: 'linear-gradient(rgba(245,166,35,0.78), rgba(232,130,12,0.88)), url(/hero-top.png) center/cover no-repeat', padding: '72px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>利用規約</h1>
        <p style={{ fontSize: '14px', color: '#fff', marginTop: '10px', opacity: 0.95, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>出店コネクトナビ ご利用にあたって</p>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '32px 28px' }}>
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
          <Link href="/" style={{ display: 'inline-block', padding: '12px 28px', borderRadius: '10px', background: '#F5A623', color: '#fff', fontSize: '14px', fontWeight: 700, textDecoration: 'none' }}>トップへ戻る</Link>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
