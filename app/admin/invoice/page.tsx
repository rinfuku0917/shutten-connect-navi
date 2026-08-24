'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// 出店者への請求書。/admin/invoice?seller=<id>&period=YYYY-MM で開く。
//
// レイアウトは実際に発行している請求書のPDFに合わせている。
// A4(596×842pt)・左右余白48pt・本文幅500pt。文字サイズも pt でそのまま指定し、
// 明細表の列幅は No.32pt / 実施日58pt / 請求件名317pt / 金額93pt。
// 体裁を変えるときは元のPDFと見比べること。

const ISSUER = {
  name: '株式会社nav',
  zip: '〒136-0073',
  address: '東京都江東区北砂5-1-26-301',
  mail: 'MAIL:info@connect-navi.com',
  taxId: '登録番号:T-6010601064156',
  bank: ['東京シティ信用金庫 日本橋支店', '普通 1095906', '口座名義:カ)ナヴ'],
  note: 'お振込手数料は貴社にてご負担をお願いいたします。',
}

type Item = { no: number; date: string; title: string; amount: number }
type Invoice = {
  seller: { shopName: string; personName: string }
  periodLabel: string
  items: Item[]
  subtotal: number
  tax: number
  total: number
  itemCount: number
  zeroCount?: number
  invoiceNo: string | null
  dueOn?: string | null
  alreadyIssued?: { invoice_no: string; issued_on: string }[]
}

const yen = (n: number) => '¥' + n.toLocaleString()
const jpDate = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${y}年${m}月${d}日`
}
// 既定の振込期限は対象月の翌月末日
const defaultDue = (period: string) => {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function InvoiceInner() {
  const params = useSearchParams()
  const sellerId = params.get('seller') || ''
  const period = params.get('period') || ''
  const [inv, setInv] = useState<Invoice | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [issuedOn, setIssuedOn] = useState('')
  const [dueOn, setDueOn] = useState('')

  const call = async (action: 'preview' | 'issue', due?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('ログインが必要です'); setLoading(false); return }
    const res = await fetch('/api/admin/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId: user.id, sellerId, period, action, dueOn: due }),
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error || '請求書を作成できませんでした'); setLoading(false); return }
    setErr('')
    setInv(j)
    if (j.dueOn) setDueOn(j.dueOn)
    setLoading(false)
  }

  useEffect(() => {
    if (!sellerId || !period) { setErr('出店者と対象月が指定されていません'); setLoading(false); return }
    const d = new Date()
    setIssuedOn(`${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`)
    setDueOn(defaultDue(period))
    call('preview')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, period])

  const issue = async () => {
    if (!window.confirm('請求書番号を採番して発行します。よろしいですか？')) return
    setIssuing(true)
    await call('issue', dueOn)
    setIssuing(false)
  }

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>読み込み中...</div>
  if (err) return (
    <div style={{ padding: '40px', textAlign: 'center' }}>
      <p style={{ color: '#DC2626', marginBottom: '16px' }}>{err}</p>
      <Link href='/admin' style={{ color: '#1D4ED8' }}>管理画面に戻る</Link>
    </div>
  )
  if (!inv) return null

  // 明細表の共通スタイル（罫線つきのグリッド）
  const cell: React.CSSProperties = { border: '0.5pt solid #000', padding: '3pt 5pt', fontSize: '9pt', lineHeight: 1.5 }
  const head: React.CSSProperties = { ...cell, textAlign: 'center' }
  const right: React.CSSProperties = { ...cell, textAlign: 'right' }

  return (
    <div style={{ background: '#F1F5F9', minHeight: '100vh', padding: '20px 12px' }}>
      {/* 操作パネル（印刷には出さない） */}
      <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href='/admin' style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>← 管理画面</Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px' }}>
          <span style={{ fontSize: '12px', color: '#64748B' }}>振込期限</span>
          <input type='date' value={dueOn} onChange={e => setDueOn(e.target.value)} disabled={!!inv.invoiceNo}
            style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }} />
        </div>
        <div style={{ flex: 1 }} />
        {!inv.invoiceNo && (
          <button onClick={issue} disabled={issuing} style={{ background: issuing ? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: issuing ? 'not-allowed' : 'pointer' }}>
            {issuing ? '発行中...' : '発行して番号を確定'}
          </button>
        )}
        <button onClick={() => window.print()} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>印刷 / PDF保存</button>
      </div>

      {!inv.invoiceNo && (inv.alreadyIssued?.length ?? 0) > 0 && (
        <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#92400E' }}>
          この出店者・対象月の請求書は既に発行されています（{inv.alreadyIssued?.map(x => x.invoice_no).join('、')}）。重複しないようご注意ください。
        </div>
      )}
      {(inv.zeroCount ?? 0) > 0 && (
        <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#DC2626' }}>
          出店料が0円の売上が{inv.zeroCount}件あるため、明細に含めていません。案件の料金設定（歩合・固定額）をご確認ください。
        </div>
      )}
      {!inv.invoiceNo && (
        <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', fontSize: '12px', color: '#64748B' }}>
          いまは確認用の表示です。振込期限を決めてから「発行して番号を確定」を押すと、番号が採番されます。
        </div>
      )}

      {/* ===== 請求書本体（A4・余白48pt） ===== */}
      <div className='invoice-sheet' style={{
        width: '596pt', minHeight: '842pt', margin: '0 auto', background: '#fff',
        padding: '48pt', boxSizing: 'border-box', color: '#000',
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        {/* 右上：請求書番号・発行日・振込期限 */}
        <div style={{ textAlign: 'right', fontSize: '9pt', lineHeight: 1.55 }}>
          <div>請求書番号:{inv.invoiceNo || '（未発行）'}</div>
          <div>発行日:{issuedOn}</div>
          {dueOn && <div>お支払期限:{jpDate(dueOn)}</div>}
        </div>

        <h1 style={{ textAlign: 'center', fontSize: '22pt', fontWeight: 400, letterSpacing: '0.28em', margin: '28pt 0 0', textIndent: '0.28em' }}>請求書</h1>

        {/* 宛先と差出人 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginTop: '24pt' }}>
          <div style={{ minWidth: 0, paddingTop: '2pt' }}>
            <div style={{ fontSize: '15pt', lineHeight: 1.3 }}>{inv.seller.shopName || '（店名未登録）'}</div>
            {inv.seller.personName && <div style={{ fontSize: '12pt', marginTop: '5pt' }}>{inv.seller.personName} 様</div>}
          </div>
          <div style={{ fontSize: '9pt', lineHeight: 1.75, textAlign: 'right', whiteSpace: 'nowrap' }}>
            <div>{ISSUER.name}</div>
            <div>{ISSUER.zip} {ISSUER.address}</div>
            <div>{ISSUER.mail}</div>
            <div>{ISSUER.taxId}</div>
          </div>
        </div>

        <p style={{ fontSize: '9pt', margin: '10pt 0 0' }}>
          {inv.periodLabel}({inv.itemCount}件)を下記のとおりご請求申し上げます。
        </p>

        {/* ご請求金額（枠つき） */}
        <div style={{ border: '0.5pt solid #000', marginTop: '20pt', height: '29pt', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14pt' }}>
          <span style={{ fontSize: '16pt' }}>ご請求金額({inv.periodLabel})</span>
          <span style={{ fontSize: '16pt' }}>{yen(inv.total)}(税込)</span>
        </div>

        <div style={{ fontSize: '10pt', margin: '18pt 0 4pt' }}>【明細】</div>
        <table style={{ width: '500pt', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: '32pt' }} />
            <col style={{ width: '58pt' }} />
            <col style={{ width: '317pt' }} />
            <col style={{ width: '93pt' }} />
          </colgroup>
          <thead>
            <tr>
              <th style={head}>No.</th>
              <th style={head}>実施日</th>
              <th style={head}>請求件名</th>
              <th style={head}>金額(税抜)</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map(it => (
              <tr key={it.no}>
                <td style={{ ...cell, textAlign: 'center' }}>{it.no}</td>
                <td style={{ ...cell, textAlign: 'center' }}>{it.date}</td>
                <td style={cell}>{it.title}</td>
                <td style={right}>{yen(it.amount)}</td>
              </tr>
            ))}
            {/* 合計欄も同じ表の中に置く（元のPDFと同じ体裁） */}
            <tr>
              <td style={cell} colSpan={2}>&nbsp;</td>
              <td style={{ ...cell, textAlign: 'right' }}>小計(税抜)</td>
              <td style={right}>{yen(inv.subtotal)}</td>
            </tr>
            <tr>
              <td style={cell} colSpan={2}>&nbsp;</td>
              <td style={{ ...cell, textAlign: 'right' }}>消費税(10%)</td>
              <td style={right}>{yen(inv.tax)}</td>
            </tr>
            <tr>
              <td style={cell} colSpan={2}>&nbsp;</td>
              <td style={{ ...cell, textAlign: 'right', fontSize: '11pt' }}>税込合計</td>
              <td style={{ ...right, fontSize: '11pt' }}>{yen(inv.total)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '10pt', margin: '22pt 0 3pt' }}>【振込先】</div>
        <div style={{ fontSize: '9pt', lineHeight: 1.65 }}>
          {ISSUER.bank.map(b => <div key={b}>{b}</div>)}
          {dueOn && <div style={{ marginTop: '4pt' }}>お支払期限:{jpDate(dueOn)}</div>}
        </div>
        <div style={{ fontSize: '8pt', marginTop: '13pt' }}>【備考】{ISSUER.note}</div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .invoice-sheet {
            box-shadow: none !important;
            margin: 0 !important;
            min-height: auto !important;
          }
          * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        @page { size: A4; margin: 0; }
      `}</style>
    </div>
  )
}

export default function InvoicePage() {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>読み込み中...</div>}>
      <InvoiceInner />
    </Suspense>
  )
}
