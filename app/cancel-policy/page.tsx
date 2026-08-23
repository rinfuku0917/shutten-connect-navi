'use client'
import SiteHeader from '../components/SiteHeader'
import SiteFooter from '../components/SiteFooter'

// キャンセル料の性質は「損害賠償金（消費税の課税対象外）」として整理している。
// このため金額に「税込」表記は使わず、割合の基準は出店料（税抜）とする。
// 文面を変えるときは税務上の扱いが変わらないか注意すること。

const sellerRows: { period: string; fee: string; note?: string }[] = [
  { period: '出店確定後 〜 出店日の21日前（3週間前）まで', fee: '無料' },
  { period: '出店日の20日前 〜 8日前', fee: '出店料の30%' },
  { period: '出店日の7日前 〜 当日', fee: '出店料の100%', note: '連絡の有無を問いません' },
  { period: '無断キャンセル（連絡なし）', fee: '出店料の100%', note: 'あわせて3ヶ月間の利用停止' },
]

const freeReasons = [
  '地震・台風・大雪などの天災、および気象警報の発表により出店が困難な場合',
  '公共交通機関の運休・幹線道路の通行止め等により会場への到達が困難な場合',
  '出店者本人の入院を要する病気・けが',
  '出店車両の重大な故障（修理記録等の確認をお願いする場合があります）',
]

const notFreeReasons = [
  '売上の見込みが低いと判断したこと',
  '仕入れ・仕込み・人員などの準備不足',
  '寝坊・予定の失念・他の予定との重複（ダブルブッキング）',
  '通常予見できる範囲の天候の変化（各案件の「雨天時の対応」で開催とされている場合）',
]

const noShowCases = [
  '事前の連絡なく、出店開始時刻または募集者が指定した集合・搬入時刻を過ぎても会場に到着しない場合',
  '事前の連絡なく、当日の出店を行わない場合',
  '募集者または当社からの連絡に応答せず、出店の可否が確認できない場合',
]

export default function CancelPolicyPage() {
  const th: React.CSSProperties = { padding: '10px 14px', textAlign: 'left', fontSize: '12px', color: '#92400E', fontWeight: 800, borderBottom: '2px solid #FDE68A', background: '#FFFBEB', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '10px 14px', fontSize: '13px', color: '#333', borderBottom: '1px solid #F1F5F9', lineHeight: 1.7 }
  const h2: React.CSSProperties = { fontSize: '16px', fontWeight: 800, color: '#92400E', marginBottom: '10px' }
  const p: React.CSSProperties = { fontSize: '14px', color: '#333', lineHeight: 1.9, marginBottom: '8px' }
  const sec: React.CSSProperties = { marginBottom: '28px' }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6', width: '100%', maxWidth: '100vw', overflowX: 'hidden' }}>
      <SiteHeader />

      <div style={{ background: 'linear-gradient(rgba(245,166,35,0.78), rgba(232,130,12,0.88)), url(/hero-top.png) center/cover no-repeat', padding: '72px 16px', textAlign: 'center' }}>
        <h1 style={{ fontSize: 'clamp(24px,5vw,36px)', fontWeight: 900, color: '#fff', margin: 0, textShadow: '0 2px 8px rgba(0,0,0,0.4)' }}>キャンセルポリシー</h1>
        <p style={{ fontSize: '14px', color: '#fff', marginTop: '10px', opacity: 0.95, textShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>出店確定後のキャンセルについて</p>
      </div>

      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '40px 16px' }}>
        <div style={{ background: '#fff', borderRadius: '16px', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '32px 28px' }}>

          <div style={sec}>
            <h2 style={h2}>第1条（本ポリシーの適用）</h2>
            <p style={p}>本ポリシーは、株式会社nav（以下「当社」といいます）が提供する「出店コネクトナビ」（以下「本サービス」といいます）において、出店申込が承認され出店が確定した後のキャンセルについて適用されます。</p>
            <p style={p}>出店確定前（申込が審査中の間）の申込の取り下げは、無料でいつでも行えます。</p>
            <p style={p}>出店確定後のキャンセル、特に直前のキャンセルや無断キャンセルは、イベント運営や施設オーナーとの信頼関係に大きな損害を与えます。出店者・募集者双方が安心して本サービスをご利用いただくため、あらかじめ本ポリシーをご確認ください。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第2条（出店者都合によるキャンセル）</h2>
            <p style={p}>出店者の都合により出店をキャンセルする場合、キャンセルのご連絡をいただいた日に応じて、以下のキャンセル料を申し受けます。</p>
            <div style={{ overflowX: 'auto', margin: '12px 0' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '480px' }}>
                <thead><tr><th style={th}>キャンセルのご連絡日</th><th style={th}>キャンセル料</th></tr></thead>
                <tbody>
                  {sellerRows.map(r => (
                    <tr key={r.period}>
                      <td style={td}>{r.period}</td>
                      <td style={td}><strong>{r.fee}</strong>{r.note && <span style={{ color: r.note.includes('利用停止') ? '#DC2626' : '#64748B', fontWeight: 700 }}>（{r.note}）</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p style={p}>キャンセル料の割合は、当該案件の出店料（税抜・日額固定分）に対して適用します。上限は設けず、高額な案件であっても上記の割合に従います。</p>
            <p style={p}>算出額が1,000円に満たない場合は1,000円とします。ただし、出店料が1,000円に満たない案件については、出店料と同額を上限とします。</p>
            <p style={p}>キャンセルにあたっては、上記キャンセル料とは別に、キャンセル手続きに伴うシステム手数料として、キャンセル料の10%相当額（税込）を申し受けます。キャンセル料が発生しない場合、システム手数料はかかりません。</p>
            <p style={p}>キャンセルに至った事情によっては、キャンセル料の割合を、出店者・募集者・当社の協議のうえ別途定めることがあります。</p>
            <p style={p}>出店料が売上に対する歩合のみで定められている案件については、出店料を10,000円とみなして上記の割合を適用します。</p>
            <p style={p}>複数日程の出店をまとめてキャンセルする場合は、日程ごとに上記を適用します。</p>
            <p style={p}>日数は、出店日の前日を「1日前」として数えます。各期限はその日の23時59分までとし、キャンセル料の区分は、当社または募集者がキャンセルの連絡を確認できた日時で判定します。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第3条（出店確定後の変更）</h2>
            <p style={p}>出店確定後の出店日・出店内容の変更は、原則としてできません。日程の変更を希望する場合は、いったんキャンセルのうえ（前条のキャンセル料を適用）、改めてお申し込みください。</p>
            <p style={p}>出店者が出店日・販売内容など募集者が承認の前提とした重要な条件の変更を希望し、募集者がこれを承認しない場合は、出店者都合のキャンセルとして扱うことがあります。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第4条（キャンセル料が無料となる場合）</h2>
            <p style={p}>キャンセルのご連絡日にかかわらず、次の各号に該当する場合はキャンセル料をいただきません。該当することが確認できる資料のご提出をお願いする場合があります。</p>
            {freeReasons.map((r, i) => (
              <p key={i} style={{ ...p, marginBottom: '4px' }}>（{i + 1}）{r}</p>
            ))}
            <p style={{ ...p, marginTop: '10px' }}>次のような事情は、原則としてキャンセル料の免除対象にはなりません。</p>
            {notFreeReasons.map((r, i) => (
              <p key={i} style={{ ...p, marginBottom: '4px' }}>・{r}</p>
            ))}
            <p style={{ ...p, marginTop: '10px' }}>また、出店者が募集者の承認を得て、同等の営業許可・販売内容を持つ代わりの出店者を手配し、その出店者が実際に出店した場合は、キャンセル料はいただきません。</p>
            <p style={{ ...p, marginTop: '8px' }}>各号に該当するかどうかの判断は、状況を確認のうえ当社が行います。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第5条（募集者・当社都合による中止）</h2>
            <p style={p}>募集者または当社の都合により出店が中止となった場合、出店者へのキャンセル料の請求は行いません。すでにお支払いいただいた出店料がある場合は、返金します。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第6条（悪天候による中止）</h2>
            <p style={p}>雨天・強風等の悪天候による開催可否は、各案件に記載の「雨天時の対応」に従います。悪天候を理由として開催が中止となった場合は、出店者・募集者いずれにもキャンセル料は発生せず、お支払いいただいた出店料は全額返金します。</p>
            <p style={p}>開催可否の連絡時期・連絡方法は案件ごとに異なります。ご不明な場合は、出店前に募集者または当社までご確認ください。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第7条（キャンセルの方法）</h2>
            <p style={p}>キャンセルは、本サービスのマイページまたは当社へのご連絡により行ってください。キャンセル料の起算日は、当社または募集者がキャンセルの連絡を確認できた日とします。</p>
            <p style={p}>電話やメッセージでのご連絡のみで出店を取りやめた場合でも、内容が確認できればその連絡日を起算日とします。連絡が確認できない場合は無断キャンセルとして扱います。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第8条（キャンセル料の性質とお支払い）</h2>
            <p style={p}>本ポリシーに定めるキャンセル料は、出店枠の確保および代替出店者の手配ができないことによる損害を補填する損害賠償金であり、消費税の課税対象外です。</p>
            <p style={p}>キャンセル料は、当社からのご請求に基づき、請求日から14日以内に当社指定の方法でお支払いください。お支払いが確認できるまで、新たな出店申込を制限する場合があります。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第9条（無断キャンセルの扱い）</h2>
            <p style={p}>次の各号のいずれかに該当する場合は、無断キャンセルとして扱います。</p>
            {noShowCases.map((r, i) => (
              <p key={i} style={{ ...p, marginBottom: '4px' }}>（{i + 1}）{r}</p>
            ))}
            <p style={{ ...p, marginTop: '10px' }}>無断キャンセルを行った出店者に対しては、キャンセル料（出店料の100%）の請求に加え、3ヶ月間の本サービスの利用停止措置を行います。</p>
            <p style={p}>無断キャンセルを繰り返した場合、またはキャンセル料のお支払いに応じていただけない場合は、利用登録の抹消等の措置を行うことがあります。</p>
            <p style={p}>無断キャンセルの後であっても、第4条の無料となる事由に該当することが確認できる資料を速やかにご提出いただき、やむを得ない事情と認められた場合は、キャンセル料の全部または一部を免除することがあります。</p>
          </div>

          <div style={sec}>
            <h2 style={h2}>第10条（本ポリシーの変更）</h2>
            <p style={p}>当社は、必要と判断した場合、本ポリシーを変更することがあります。変更後のポリシーは、本サービス上に掲載した時点から効力を生じ、掲載後に確定した出店から適用されます。すでに出店が確定しているものには、確定時点のポリシーを適用します。</p>
            <p style={p}>本ポリシーの一部が法令により無効または制限された場合でも、その他の部分は引き続き有効とします。</p>
          </div>

          <p style={{ fontSize: '13px', color: '#888', marginTop: '8px' }}>制定日: 2026年8月17日　／　改定日: 2026年8月22日</p>
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}
