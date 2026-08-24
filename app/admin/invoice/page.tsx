'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// 出店者への請求書。/admin/invoice?seller=<id>&period=YYYY-MM で開く。
// 「発行して番号を確定」で番号を採番し、そのまま印刷・PDF保存できる。

// 差出人と振込先。変更するときはここだけ直せばよい。
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
  invoiceNo: string | null
  alreadyIssued?: { invoice_no: string; issued_on: string }[]
}

const yen = (n: number) => '¥' + n.toLocaleString()

function InvoiceInner() {
  const params = useSearchParams()
  const sellerId = params.get('seller') || ''
  const period = params.get('period') || ''
  const [inv, setInv] = useState<Invoice | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  const [issuedOn, setIssuedOn] = useState('')

  const call = async (action: 'preview' | 'issue') => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('ログインが必要です'); setLoading(false); return }
    const res = await fetch('/api/admin/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requesterId: user.id, sellerId, period, action }),
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error || '請求書を作成できませんでした'); setLoading(false); return }
    setErr('')
    setInv(j)
    setLoading(false)
  }

  useEffect(() => {
    if (!sellerId || !period) { setErr('出店者と対象月が指定されていません'); setLoading(false); return }
    const d = new Date()
    setIssuedOn(`${d.getFullYear()}年${String(d.getMonth() + 1).padStart(2, '0')}月${String(d.getDate()).padStart(2, '0')}日`)
    call('preview')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, period])

  const issue = async () => {
    if (!window.confirm('請求書番号を採番して発行します。よろしいですか？')) return
    setIssuing(true)
    await call('issue')
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

  const th: React.CSSProperties = { borderBottom: '1.5px solid #333', padding: '7px 8px', fontSize: '11px', textAlign: 'left' }
  const td: React.CSSProperties = { borderBottom: '1px solid #ddd', padding: '7px 8px', fontSize: '11.5px' }
  const sumRow: React.CSSProperties = { padding: '6px 8px', fontSize: '12px', textAlign: 'right' }

  return (
    <div style={{ background: '#F1F5F9', minHeight: '100vh', padding: '20px' }}>
      {/* 画面用の操作パネル（印刷には出さない） */}
      <div className='no-print' style={{ maxWidth: '760px', margin: '0 auto 16px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href='/admin' style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>← 管理画面</Link>
        <div style={{ flex: 1 }} />
        {!inv.invoiceNo && (
          <button onClick={issue} disabled={issuing} style={{ background: issuing ? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: issuing ? 'not-allowed' : 'pointer' }}>
            {issuing ? '発行中...' : '発行して番号を確定'}
          </button>
        )}
        <button onClick={() => window.print()} style={{ background: '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>印刷 / PDF保存</button>
      </div>

      {!inv.invoiceNo && (inv.alreadyIssued?.length ?? 0) > 0 && (
        <div className='no-print' style={{ maxWidth: '760px', margin: '0 auto 16px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#92400E' }}>
          この出店者・対象月の請求書は既に発行されています（{inv.alreadyIssued?.map(x => x.invoice_no).join('、')}）。重複しないようご注意ください。
        </div>
      )}
      {!inv.invoiceNo && (
        <div className='no-print' style={{ maxWidth: '760px', margin: '0 auto 16px', fontSize: '12px', color: '#64748B' }}>
          いまは確認用の表示です。「発行して番号を確定」を押すと請求書番号が採番されます。
        </div>
      )}

      {/* 請求書本体 */}
      <div className='invoice-sheet' style={{ maxWidth: '760px', margin: '0 auto', background: '#fff', padding: '36px 40px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', color: '#1a1a1a' }}>
        <div style={{ textAlign: 'right', fontSize: '11px', lineHeight: 1.7 }}>
          <div>請求書番号:{inv.invoiceNo || '（未発行）'}</div>
          <div>発行日:{issuedOn}</div>
        </div>

        <h1 style={{ textAlign: 'center', fontSize: '22px', fontWeight: 700, letterSpacing: '0.4em', margin: '10px 0 26px' }}>請 求 書</h1>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '24px', marginBottom: '24px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '14px', fontWeight: 700, borderBottom: '1px solid #333', paddingBottom: '4px', marginBottom: '8px' }}>
              {inv.seller.shopName || '（店名未登録）'}
            </div>
            {inv.seller.personName && <div style={{ fontSize: '12.5px' }}>{inv.seller.personName} 様</div>}
          </div>
          <div style={{ fontSize: '11px', lineHeight: 1.9, textAlign: 'right', whiteSpace: 'nowrap' }}>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{ISSUER.name}</div>
            <div>{ISSUER.zip} {ISSUER.address}</div>
            <div>{ISSUER.mail}</div>
            <div>{ISSUER.taxId}</div>
          </div>
        </div>

        <p style={{ fontSize: '12px', marginBottom: '10px' }}>
          {inv.periodLabel}({inv.itemCount}件)を下記のとおりご請求申し上げます。
        </p>

        <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '12px 16px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '12.5px', fontWeight: 700 }}>ご請求金額({inv.periodLabel})</span>
          <span style={{ fontSize: '19px', fontWeight: 700 }}>{yen(inv.total)}(税込)</span>
        </div>

        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>【明細】</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '4px' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: '34px' }}>No.</th>
              <th style={{ ...th, width: '54px' }}>実施日</th>
              <th style={th}>請求件名</th>
              <th style={{ ...th, textAlign: 'right', width: '96px' }}>金額(税抜)</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map(it => (
              <tr key={it.no}>
                <td style={td}>{it.no}</td>
                <td style={td}>{it.date}</td>
                <td style={td}>{it.title}</td>
                <td style={{ ...td, textAlign: 'right' }}>{yen(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
          <tbody>
            <tr><td style={sumRow}>小計(税抜)</td><td style={{ ...sumRow, width: '96px' }}>{yen(inv.subtotal)}</td></tr>
            <tr><td style={sumRow}>消費税(10%)</td><td style={{ ...sumRow, width: '96px' }}>{yen(inv.tax)}</td></tr>
            <tr>
              <td style={{ ...sumRow, fontWeight: 700, borderTop: '1.5px solid #333' }}>税込合計</td>
              <td style={{ ...sumRow, fontWeight: 700, borderTop: '1.5px solid #333', width: '96px' }}>{yen(inv.total)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>【振込先】</div>
        <div style={{ fontSize: '11.5px', lineHeight: 1.9, marginBottom: '16px' }}>
          {ISSUER.bank.map(b => <div key={b}>{b}</div>)}
        </div>
        <div style={{ fontSize: '11.5px' }}>【備考】{ISSUER.note}</div>
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { background: #fff !important; }
          .invoice-sheet { box-shadow: none !important; max-width: none !important; padding: 0 !important; }
        }
        @page { size: A4; margin: 16mm; }
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
