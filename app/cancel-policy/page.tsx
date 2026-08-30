import type { Metadata } from 'next'
import SiteHeader from '../components/SiteHeader'
import BackButton from '../components/BackButton'
import SiteFooter from '../components/SiteFooter'

export const metadata: Metadata = {
  title: 'キャンセルポリシー',
  description:
    '出店コネクトナビにおけるキャンセルの取り扱いについてご案内します。',
  alternates: { canonical: '/cancel-policy' },
  robots: { index: false, follow: true },
}

// キャンセル料の有無・金額・条件は案件ごとに定める方針のため、
// このページには具体的な料率や金額を書かない。
// 個別の条件は案件の募集要項側に記載する。

const sections: { title: string; body: string[] }[] = [
  {
    title: 'はじめに',
    body: [
      '本ポリシーは基本的な考え方を示すものです。キャンセル料の有無・金額・適用条件は案件ごとに異なります。個別案件の募集要項または主催者・施設側の定めがある場合は、そちらの内容が優先されます。',
    ],
  },
  {
    title: '1. 出店者都合によるキャンセル',
    body: [
      '出店が確定（承認）した後は、理由・時期を問わず、いかなる場合もキャンセル料が発生します。金額は案件ごとに定め、応募時にご確認いただいた条件を適用します。',
      '出店が困難となった場合は、速やかに出店コネクトナビのメッセージ機能よりご連絡ください。',
    ],
  },
  {
    title: '2. 無断キャンセル',
    body: [
      '事前のご連絡なく出店されなかった場合は、キャンセル料に加え、以後の応募制限またはアカウント停止の対象となることがあります。',
    ],
  },
  {
    title: '3. 主催者・会場都合による中止',
    body: [
      '主催者側の都合で中止となった場合、出店者にキャンセル料は発生しません。ただし、それまでに出店者に生じた費用（仕入・移動費等）について、当社は補償いたしかねます。',
    ],
  },
  {
    title: '4. 荒天・天災等の不可抗力',
    body: [
      '天候・災害等により主催者が開催中止を決定した場合、キャンセル料は発生しません。開催可否の判断は主催者に帰属し、開催される場合の出店者側の不参加は第1項（出店者都合）の扱いとなります。',
    ],
  },
  {
    title: '5. キャンセルのご連絡',
    body: [
      'キャンセルのご連絡は、必ず出店コネクトナビのメッセージ機能を通じて行ってください。',
    ],
  },
  {
    title: '6. その他',
    body: [
      '当社はマッチングの場を提供するものであり、当事者間で生じたトラブルについて責任を負いません。本ポリシーは標準的な取り扱いを示すものであり、実際の条件は案件ごとに定めます。',
    ],
  },
]

export default function CancelPolicyPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/' />
      </div>

      <div style={{ background: 'linear-gradient(rgba(245,166,35,0.78), rgba(232,130,12,0.88)), url(/hero-top.png) center/cover no-repeat', padding: '72px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>キャンセルポリシー</h1>
        <p style={{ fontSize: '14px', color: '#fff', marginTop: '10px', opacity: 0.95, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>出店確定後のキャンセルについて</p>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '32px 28px' }}>
          {sections.map((sec) => (
            <div key={sec.title} style={{ marginBottom: '28px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 800, color: '#92400E', marginBottom: '10px' }}>{sec.title}</h2>
              {sec.body.map((t, i) => (
                <p key={i} style={{ fontSize: '14px', color: '#333', lineHeight: 1.9, marginBottom: '8px' }}>{t}</p>
              ))}
            </div>
          ))}
          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>制定日：2026年8月23日</p>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
