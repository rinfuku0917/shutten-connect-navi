'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// 領収書。/admin/receipt?no=2026-0042 で開く。
// 出店者側は /dashboard/seller/receipt?no=... から同じものを開く。
//
// 入金を確認できた請求書からしか作らない。
// まだ受け取っていないお金の領収書が出せてしまうと、帳簿と実際の入金が合わない。
// その判定はサーバー側（/api/admin/invoice の action='open' に forReceipt）で行う。
//
// 番号は請求書の番号をそのまま使う。別に採番すると、
// どの請求に対する領収かを照合するのに表を1つ挟むことになる。
//
// 領収日は、出店者が申告した振込日を使う。
// 実務では「いつ振り込んだか」を領収日にするのが通例で、
// 運営が確認した日にすると、確認が遅れたぶん日付が後ろにずれる。

const ISSUER = {
  name: '株式会社nav',
  zip: '〒136-0073',
  address: '東京都江東区北砂5-1-26-301',
  mail: 'MAIL:info@connect-navi.com',
  taxId: '登録番号:T-6010601064156',
}

type Item = { no: number; date: string; title: string; amount: number }
type Data = {
  seller: { shopName: string; personName: string }
  periodLabel: string
  items: Item[]
  subtotal: number
  tax: number
  total: number
  invoiceNo: string | null
  kind?: string
  paidStatus?: string | null
  paidOn?: string | null
  paidConfirmedAt?: string | null
  voidedAt?: string | null
}

// 市販の領収証（コクヨ ウケ-107N など）に近い配色。
// 罫線は真っ黒より少し落とし、金額の帯だけ薄い色を敷く
const INK = '#3A3A3A'
const TINT = '#E4EFE6'

const yen = (n: number) => '¥' + n.toLocaleString()
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const jpDate = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return ''
  const w = WEEKDAYS[new Date(Number(y), Number(m) - 1, Number(d)).getDay()]
  return `${y}年${m}月${d}日（${w}）`
}

type Viewer = 'admin' | 'seller'

function ReceiptInner({ viewer = 'admin' }: { viewer?: Viewer } = {}) {
  const isSeller = viewer === 'seller'
  const params = useSearchParams()
  const no = params.get('no') || ''
  const [data, setData] = useState<Data | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [pdfMaking, setPdfMaking] = useState(false)
  // 領収日。既定は出店者が申告した振込日。
  // 先方の締めの都合で日付を合わせたい場面があるため、運営は直せる
  const [issueOn, setIssueOn] = useState('')

  useEffect(() => {
    ;(async () => {
      if (!no) { setErr('請求書番号が指定されていません'); setLoading(false); return }
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setErr('ログインが必要です'); setLoading(false); return }
      const res = await fetch('/api/admin/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requesterId: user.id, action: 'open', invoiceNo: no, forReceipt: true }),
      })
      const j = await res.json()
      if (!res.ok) { setErr(j.error || '領収書を作成できませんでした'); setLoading(false); return }
      setData(j)
      // 既定の領収日。申告された振込日、無ければ運営が確認した日
      setIssueOn(j.paidOn || (j.paidConfirmedAt ? String(j.paidConfirmedAt).slice(0, 10) : ''))
      setLoading(false)
    })()
  }, [no])

  // ブラウザの印刷では白紙になる環境があるため、
  // 紙面をそのまま画像にしてPDFにする（請求書と同じやり方）
  const savePdf = async () => {
    const sheet = document.getElementById('receipt-sheet')
    if (!sheet) return
    setPdfMaking(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      const canvas = await html2canvas(sheet, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true,
        windowWidth: sheet.scrollWidth, windowHeight: sheet.scrollHeight,
        onclone: (doc: Document) => {
          const el = doc.getElementById('receipt-sheet') as HTMLElement | null
          if (!el) return
          el.style.setProperty('width', '596pt', 'important')
          el.style.setProperty('min-height', '842pt', 'important')
          el.style.setProperty('margin', '0', 'important')
          el.style.setProperty('box-shadow', 'none', 'important')
          el.querySelectorAll('.no-print').forEach(n => ((n as HTMLElement).style.display = 'none'))
        },
      })
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pw = pdf.internal.pageSize.getWidth()
      const imgH = (canvas.height * pw) / canvas.width
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, pw, imgH)
      pdf.save(`領収書_${data?.seller.shopName || ''}_${data?.invoiceNo || ''}.pdf`)
    } catch (e) {
      console.error('PDFの作成に失敗しました', e)
    }
    setPdfMaking(false)
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>読み込み中...</div>
  if (err || !data) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ color: '#DC2626', marginBottom: '14px', lineHeight: 1.9 }}>{err}</div>
        <Link href={isSeller ? '/dashboard/seller?tab=payment' : '/admin'} style={{ color: '#1D4ED8' }}>
          {isSeller ? 'お支払いに戻る' : '管理画面に戻る'}
        </Link>
      </div>
    )
  }

  // 但し書き。明細の件名からいちばん多い言い回しを拾うのではなく、
  // 何の代金かが一目で分かる形に固定する。
  // 事前請求も売上からの請求も、受け取っているのは出店料である点は変わらない
  const forWhat = data.kind === 'advance' ? '出店料（事前）として' : '出店料として'
  // 実際に振り込まれた日。紙面の下に添える
  const paidDate = data.paidOn || (data.paidConfirmedAt ? String(data.paidConfirmedAt).slice(0, 10) : '')
  // 紙面に出す領収日。年・月・日を別に置くため、分けておく
  const [iy, im, id] = (issueOn || paidDate || '').slice(0, 10).split('-')
  const ymd = { y: iy || '　　', m: im ? String(Number(im)) : '　', d: id ? String(Number(id)) : '　' }

  const abs: React.CSSProperties = { position: 'absolute', whiteSpace: 'nowrap' }

  return (
    <div style={{ background: '#F1F5F9', minHeight: '100vh', padding: '20px 12px' }}>
      <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href={isSeller ? '/dashboard/seller?tab=payment' : '/admin'} style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>
          {isSeller ? '← お支払いに戻る' : '← 管理画面'}
        </Link>
        {/* 領収日。既定は振込日で、運営だけが直せる。
            受け取る側が日付を動かせてはいけないので、出店者には出さない */}
        {!isSeller && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#64748B' }}>領収日</span>
            <input type='date' value={issueOn} onChange={e => setIssueOn(e.target.value)}
              style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }} />
            {paidDate && issueOn !== paidDate && (
              <button type='button' onClick={() => setIssueOn(paidDate)}
                style={{ background: '#fff', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '6px 10px', fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                振込日に戻す
              </button>
            )}
          </div>
        )}
        <div style={{ flex: 1 }} />
        <button onClick={savePdf} disabled={pdfMaking}
          style={{ background: pdfMaking ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: pdfMaking ? 'not-allowed' : 'pointer', minHeight: '44px' }}>
          {pdfMaking ? '作成中...' : 'PDFをダウンロード'}
        </button>
      </div>

      {/* 紙面。市販の複写式領収証（紙幣判ヨコ型）と同じ体裁で組む。
          先方の経理が見慣れた形にしておくと、確認が早い。
          用紙はA4のままで、その中に領収証の枠を1枚置いている */}
      <div id='receipt-sheet' style={{
        position: 'relative', width: '596pt', minHeight: '842pt', margin: '0 auto', background: '#fff',
        boxSizing: 'border-box', color: '#111',
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        {/* 領収証の枠 */}
        <div style={{ position: 'absolute', left: '52pt', top: '86pt', width: '492pt', border: `1.2pt solid ${INK}`, background: '#fff' }}>

          {/* 1段目　表題／宛名／番号 */}
          <div style={{ display: 'flex', alignItems: 'flex-end', padding: '14pt 16pt 10pt', gap: '14pt' }}>
            <div style={{ fontSize: '17pt', letterSpacing: '7pt', fontWeight: 700, whiteSpace: 'nowrap' }}>領収証</div>
            <div style={{ flex: 1, minWidth: 0, borderBottom: `0.8pt solid ${INK}`, paddingBottom: '2pt', fontSize: '12.5pt', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.seller.shopName || '（店名未登録）'}
            </div>
            <div style={{ fontSize: '11pt', whiteSpace: 'nowrap', paddingBottom: '2pt' }}>様</div>
            <div style={{ fontSize: '9pt', whiteSpace: 'nowrap', paddingBottom: '3pt' }}>No. {data.invoiceNo}</div>
          </div>

          {/* 2段目　金額。市販の様式と同じく、薄い色を敷いた帯にする */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12pt', padding: '10pt 16pt', background: TINT, borderTop: `0.8pt solid ${INK}`, borderBottom: `0.8pt solid ${INK}` }}>
            <div style={{ fontSize: '10pt', whiteSpace: 'nowrap' }}>金額</div>
            <div style={{ flex: 1, fontSize: '23pt', fontWeight: 700, letterSpacing: '1pt', whiteSpace: 'nowrap' }}>
              ¥ {data.total.toLocaleString()} —
            </div>
            <div style={{ fontSize: '9.5pt', whiteSpace: 'nowrap' }}>（税込）</div>
          </div>

          {/* 3段目　但し書きと領収日 */}
          <div style={{ padding: '12pt 16pt 6pt', display: 'flex', alignItems: 'flex-end', gap: '10pt' }}>
            <div style={{ fontSize: '10.5pt', whiteSpace: 'nowrap' }}>但</div>
            <div style={{ flex: 1, minWidth: 0, borderBottom: `0.6pt solid ${INK}`, paddingBottom: '2pt', fontSize: '10.5pt', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {data.periodLabel}　{forWhat}
            </div>
          </div>
          <div style={{ padding: '4pt 16pt 12pt', fontSize: '10pt', textAlign: 'right' }}>
            {ymd.y} 年 {ymd.m} 月 {ymd.d} 日　上記正に領収いたしました
          </div>

          {/* 4段目　収入印紙欄／内訳／発行者 */}
          <div style={{ display: 'flex', alignItems: 'stretch', borderTop: `0.8pt solid ${INK}` }}>
            {/* 収入印紙の欄。市販の様式にあるので枠は残し、
                なぜ貼っていないかをその場で書いておく */}
            <div style={{ width: '74pt', borderRight: `0.8pt solid ${INK}`, padding: '8pt 4pt', textAlign: 'center' }}>
              <div style={{ fontSize: '8.5pt', letterSpacing: '3pt', lineHeight: '13pt' }}>収入<br />印紙</div>
              <div style={{ fontSize: '6.2pt', color: '#555', marginTop: '4pt', lineHeight: '8pt' }}>電子発行のため<br />貼付不要</div>
            </div>

            {/* 内訳 */}
            <div style={{ width: '196pt', borderRight: `0.8pt solid ${INK}`, padding: '8pt 12pt', fontSize: '9.5pt', lineHeight: '17pt' }}>
              <div style={{ fontSize: '8.5pt', color: '#333', marginBottom: '2pt' }}>内訳</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `0.5pt solid ${INK}` }}>
                <span>税抜金額</span><span>¥{data.subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `0.5pt solid ${INK}` }}>
                <span>消費税額等（10%）</span><span>¥{data.tax.toLocaleString()}</span>
              </div>
            </div>

            {/* 発行者。社名に丸印を重ねる */}
            <div style={{ flex: 1, position: 'relative', padding: '8pt 62pt 8pt 14pt', fontSize: '8.4pt', lineHeight: '12pt' }}>
              <div style={{ fontSize: '10.5pt', fontWeight: 700, marginBottom: '2pt' }}>{ISSUER.name}</div>
              <div>{ISSUER.zip} {ISSUER.address}</div>
              <div>{ISSUER.mail}</div>
              <div>{ISSUER.taxId}</div>
              <img src='/seal-company.webp' alt=''
                style={{ position: 'absolute', right: '6pt', bottom: '6pt', width: '50pt', height: '50pt', opacity: 0.88 }} />
            </div>
          </div>
        </div>

        {/* 枠の下に、振込であることを添える。
            先方の経理が振込明細と突き合わせやすいように */}
        <div style={{ position: 'absolute', left: '52pt', top: '360pt', fontSize: '9pt', color: '#333', lineHeight: '15pt' }}>
          <div>お支払い方法：銀行振込{paidDate ? `（お振込日 ${jpDate(paidDate)}）` : ''}</div>
          <div>請求書番号：{data.invoiceNo}</div>
        </div>
      </div>
    </div>
  )
}

export function ReceiptScreen({ viewer = 'admin' }: { viewer?: Viewer } = {}) {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>読み込み中...</div>}>
      <ReceiptInner viewer={viewer} />
    </Suspense>
  )
}

export default function ReceiptPage() {
  return <ReceiptScreen viewer='admin' />
}
