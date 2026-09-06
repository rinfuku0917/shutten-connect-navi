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
  // 領収日。申告された振込日を使い、無いときだけ運営が確認した日にする
  const paidDate = data.paidOn || (data.paidConfirmedAt ? String(data.paidConfirmedAt).slice(0, 10) : '')

  const abs: React.CSSProperties = { position: 'absolute', whiteSpace: 'nowrap' }

  return (
    <div style={{ background: '#F1F5F9', minHeight: '100vh', padding: '20px 12px' }}>
      <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href={isSeller ? '/dashboard/seller?tab=payment' : '/admin'} style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>
          {isSeller ? '← お支払いに戻る' : '← 管理画面'}
        </Link>
        <div style={{ flex: 1 }} />
        <button onClick={savePdf} disabled={pdfMaking}
          style={{ background: pdfMaking ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: pdfMaking ? 'not-allowed' : 'pointer', minHeight: '44px' }}>
          {pdfMaking ? '作成中...' : 'PDFをダウンロード'}
        </button>
      </div>

      {/* 紙面。請求書と同じA4（596×842pt）で組む */}
      <div id='receipt-sheet' style={{
        position: 'relative', width: '596pt', minHeight: '842pt', margin: '0 auto', background: '#fff',
        boxSizing: 'border-box', color: '#000',
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        <img src='/logo-invoice.png' alt='出店コネクトナビ'
          style={{ ...abs, left: '54.8pt', top: '55.3pt', width: '99.1pt', height: '24pt' }} />

        <div style={{ ...abs, right: '55.2pt', top: '53.9pt', fontSize: '10pt', lineHeight: '11.9pt', textAlign: 'right' }}>
          <div>請求書番号:{data.invoiceNo}</div>
          <div>発行日:{jpDate(paidDate)}</div>
        </div>

        <div style={{ ...abs, left: '250pt', top: '120.4pt', fontSize: '22pt', lineHeight: '22pt', letterSpacing: '6.1pt' }}>領収書</div>

        {/* 宛名 */}
        <div style={{ ...abs, left: '53.2pt', top: '175pt', fontSize: '15pt', lineHeight: '15pt' }}>
          {data.seller.shopName || '（店名未登録）'}　様
        </div>
        <div style={{ position: 'absolute', left: '53.2pt', top: '196pt', width: '260pt', borderBottom: '1pt solid #000' }} />

        {/* 金額 */}
        <div style={{ ...abs, left: '53.2pt', top: '232pt', fontSize: '12pt' }}>金額</div>
        <div style={{ ...abs, left: '110pt', top: '224pt', fontSize: '24pt', fontWeight: 700, letterSpacing: '1pt' }}>
          {yen(data.total)}　<span style={{ fontSize: '12pt', fontWeight: 400 }}>（税込）</span>
        </div>
        <div style={{ position: 'absolute', left: '53.2pt', top: '262pt', width: '440pt', borderBottom: '1.5pt solid #000' }} />

        {/* 但し書き */}
        <div style={{ ...abs, left: '53.2pt', top: '284pt', fontSize: '11pt' }}>但し　{data.periodLabel}　{forWhat}</div>
        <div style={{ ...abs, left: '53.2pt', top: '306pt', fontSize: '11pt' }}>上記正に領収いたしました</div>

        {/* 内訳 */}
        <div style={{ ...abs, left: '53.2pt', top: '348pt', fontSize: '10pt', fontWeight: 700 }}>【内訳】</div>
        <div style={{ position: 'absolute', left: '53.2pt', top: '368pt', width: '250pt', fontSize: '10pt', lineHeight: '18pt' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>税抜金額</span><span>{yen(data.subtotal)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}><span>消費税等（10%）</span><span>{yen(data.tax)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1pt solid #000', paddingTop: '3pt', fontWeight: 700 }}>
            <span>合計</span><span>{yen(data.total)}</span>
          </div>
        </div>

        {/* 受け取り方法。振込であることを書いておくと、
            先方の経理が振込明細と突き合わせやすい */}
        <div style={{ ...abs, left: '53.2pt', top: '452pt', fontSize: '10pt', lineHeight: '16pt' }}>
          <div>お支払い方法：銀行振込</div>
          {paidDate && <div>お振込日：{jpDate(paidDate)}</div>}
        </div>

        {/* 発行者 */}
        <div style={{ position: 'absolute', right: '55.2pt', top: '440pt', fontSize: '10pt', lineHeight: '15pt', textAlign: 'left' }}>
          <div style={{ fontSize: '12pt', fontWeight: 700, marginBottom: '4pt' }}>{ISSUER.name}</div>
          <div>{ISSUER.zip}</div>
          <div>{ISSUER.address}</div>
          <div>{ISSUER.mail}</div>
          <div>{ISSUER.taxId}</div>
        </div>

        {/* 電子で発行していることを書いておく。
            紙で渡す領収書と違い、収入印紙を貼っていない理由が先方に伝わる */}
        <div style={{ ...abs, left: '53.2pt', top: '560pt', fontSize: '8.5pt', color: '#333' }}>
          ※ この領収書は電子的に発行しており、収入印紙は貼付しておりません。
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
