'use client'
import { useState, useEffect, Suspense } from 'react'
import ConfirmDialog from '../../components/ConfirmDialog'
import Notice from '../../components/Notice'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

// 出店者への請求書。/admin/invoice?seller=<id>&period=YYYY-MM で開く。
//
// レイアウトは実際に発行している請求書のPDFから座標を読み取って合わせている。
// A4(596×842pt)。表より上は元PDFと同じ位置に絶対配置し、
// 【明細】から下だけを流し込む（件数で高さが変わるため）。
//   本文の左端 53.2pt / 右端 540.8pt、明細表は 48pt〜547.5pt
//   列幅 No.32.2 / 実施日58 / 請求件名317.2 / 金額92.1
// 流し込みで組むと下にいくほど位置がずれるので、この形を崩さないこと。
// 体裁を変えるときは元のPDFと見比べること。

const ISSUER = {
  name: '株式会社nav',
  zip: '〒136-0073',
  address: '東京都江東区北砂5-1-26-301',
  mail: 'MAIL:info@connect-navi.com',
  // 適格請求書（インボイス）の登録番号。
  // 先方が仕入税額控除を受けるのに要るので、請求書にも領収書にも必ず出す
  taxId: 'インボイス登録番号:T-6010601064156',
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
  note?: string | null
  alreadyIssued?: { invoice_no: string; issued_on: string }[]
  // 番号で開き直したときに返る。sales=売上からの請求 / advance=事前請求
  kind?: string
  sellerId?: string
  period?: string
  issuedOn?: string
  // 取り消された請求書。送ってしまわないよう、画面で強く知らせる
  voidedAt?: string | null
  voidReason?: string | null
}

const yen = (n: number) => '¥' + n.toLocaleString()
// 紙面に出す日付。曜日まで入れる。
// 先方が「何曜日の締めか」をその場で確かめられるようにするため
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const jpDate = (iso: string) => {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  if (!y || !m || !d) return ''
  const w = WEEKDAYS[new Date(Number(y), Number(m) - 1, Number(d)).getDay()]
  return `${y}年${m}月${d}日（${w}）`
}
// 日付の入力欄が受け取れる形（2026-09-06）かどうか
const isIsoDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)
// Date を、日付の入力欄が受け取れる形にする。
// toISOString は世界標準時に直すので、日本時間の朝9時より前が前日にずれる
const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
// 既定の振込期限は対象月の翌月末日
const defaultDue = (period: string) => {
  const [y, m] = period.split('-').map(Number)
  const d = new Date(y, m + 1, 0)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 誰が見ているか。
//   admin  … 運営。発行・編集・日付の変更ができる
//   seller … 出店者。自分あての請求書を見て、PDFにするだけ
// 紙面そのものは同じものを使う。2つに分けて書くと、
// どちらかを直したときにもう一方だけ古いままになるため
type Viewer = 'admin' | 'seller'

function InvoiceInner({ viewer = 'admin' }: { viewer?: Viewer } = {}) {
  const isSeller = viewer === 'seller'
  // 確認とお知らせを画面の中に出す。
  // window.confirm / alert はアプリ内ブラウザ（LINE など）で黙って無視され、
  // 押しても何も起きないように見える。管理画面と同じ作りにそろえる
  const [askState, setAskState] = useState<{ title: string; body?: string; okLabel?: string; danger?: boolean; resolve: (ok: boolean) => void } | null>(null)
  const ask = (o: { title: string; body?: string; okLabel?: string; danger?: boolean }) =>
    new Promise<boolean>(resolve => setAskState({ ...o, resolve }))
  const answerAsk = (ok: boolean) => { askState?.resolve(ok); setAskState(null) }
  const [notice, setNotice] = useState<{ message: string; kind: 'error' | 'ok' | 'info' } | null>(null)
  const showNotice = (message: string, kind: 'error' | 'ok' | 'info' = 'error') => setNotice({ message, kind })
  const params = useSearchParams()
  const sellerId = params.get('seller') || ''
  const period = params.get('period') || ''
  const dueParam = params.get('due') || ''
  // ?no=2026-0042 で、発行済みの請求書をそのまま開き直す。
  // 事前請求は売上に紐づかないため、出店者と対象月からは組み立て直せない。
  // 番号で開けば、売上からの請求も事前請求も同じように何度でもPDFにできる
  const openNo = params.get('no') || ''
  const [inv, setInv] = useState<Invoice | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [issuing, setIssuing] = useState(false)
  // 発行日。振込期限と同じく 2026-09-06 の形で持ち、紙面に出すときに整える。
  // 以前は日本語の文字列で持っていて画面から直せなかったが、
  // 「実際に出した日と紙面の日付を合わせたい」という運用の求めで直せるようにした
  const [issuedOn, setIssuedOn] = useState('')
  const [dueOn, setDueOn] = useState('')

  const call = async (action: 'preview' | 'issue' | 'open', due?: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('ログインが必要です'); setLoading(false); return }
    const res = await fetch('/api/admin/invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: user.id, sellerId, period, action, dueOn: due,
        invoiceNo: openNo || undefined,
        edited: action === 'issue' ? editedPayload() : undefined,
      }),
    })
    const j = await res.json()
    if (!res.ok) { setErr(j.error || '請求書を作成できませんでした'); setLoading(false); return }
    setErr('')
    setInv(j)
    // 最初の読み込みのときだけ保存済みの期限を入れる。
    // 画面で日付を直したあとに上書きされてしまうため、以降は触らない。
    if (j.dueOn && action !== 'issue') setDueOn(j.dueOn)
    // 発行済みを開いたときは、そのときの発行日を出す（今日ではない）。
    // 番号で開いた場合（open）だけでなく、出店者と対象月で開いて
    // すでに発行済みだった場合（preview）も同じ。
    // 記録は日付（2026-09-06）だが、古い行は日時で返ることがあるので両方を受ける
    if (action !== 'issue' && j.issuedOn) {
      const s = String(j.issuedOn)
      setIssuedOn(isIsoDate(s.slice(0, 10)) ? s.slice(0, 10) : toIso(new Date(s)))
    }
    setLoading(false)
  }

  useEffect(() => {
    // 既定は今日。発行済みを開いた場合は、そのあと call('open') が記録の日で上書きする
    setIssuedOn(toIso(new Date()))
    // 番号を指定して開くときは、出店者と対象月は要らない
    if (openNo) { call('open'); return }
    if (!sellerId || !period) { setErr('出店者と対象月が指定されていません'); setLoading(false); return }
    setDueOn(/^\d{4}-\d{2}-\d{2}$/.test(dueParam) ? dueParam : defaultDue(period))
    call('preview')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sellerId, period, openNo])

  // ===== 管理画面での修正 =====
  // 明細の文言・金額・宛先・備考を直せるようにする。合計は自動で計算し直す。
  // 出店者は中身を直せない。編集の入口を出さないだけでなく、
  // ここを false に固定して、紙面側の入力欄も出ないようにする
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<Item[]>([])
  const [toName, setToName] = useState('')
  const [toPerson, setToPerson] = useState('')
  const [note, setNote] = useState('')

  // 取得した内容を編集用に取り込む
  useEffect(() => {
    if (!inv) return
    setItems(inv.items)
    setToName(inv.seller.shopName)
    setToPerson(inv.seller.personName)
    setNote(inv.note || '')
  }, [inv])

  const subtotal = items.reduce((t, i) => t + (Number(i.amount) || 0), 0)
  const tax = Math.floor(subtotal * 0.1)
  const total = subtotal + tax

  const setItem = (idx: number, patch: Partial<Item>) =>
    setItems(list => list.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  const addItem = () =>
    setItems(list => [...list, { no: list.length + 1, date: '', title: '', amount: 0 }])
  const removeItem = (idx: number) =>
    setItems(list => list.filter((_, i) => i !== idx).map((it, i) => ({ ...it, no: i + 1 })))

  const editedPayload = () => ({
    items: items.map((it, i) => ({ ...it, no: i + 1, amount: Number(it.amount) || 0 })),
    toName, toPerson, note, dueOn,
    // 画面で直した発行日。形が違うときは送らず、サーバー側の既定に任せる
    issuedOn: isIsoDate(issuedOn) ? issuedOn : undefined,
  })

  // 発行済みの請求書の修正を保存する
  const saveEdits = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { showNotice('ログインが必要です'); return }
    setSaving(true)
    const res = await fetch('/api/admin/invoice', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requesterId: user.id,
        // 番号で開いているときは、その1枚だけを直す
        sellerId: sellerId || inv?.sellerId || '',
        period: period || inv?.period || '',
        invoiceNo: openNo || inv?.invoiceNo || undefined,
        action: 'save', edited: editedPayload(),
      }),
    })
    const j = await res.json()
    setSaving(false)
    if (!res.ok) { showNotice('保存できませんでした: ' + (j.error || '不明なエラー')); return }
    setEditing(false)
    showNotice('修正内容を保存しました', 'ok')
  }

  // ブラウザの印刷機能では白紙になる環境があるため、
  // 請求書の見た目をそのまま画像化してPDFファイルとして保存する。
  const [pdfMaking, setPdfMaking] = useState(false)
  const savePdf = async () => {
    const sheet = document.getElementById('invoice-sheet')
    if (!sheet) return
    setPdfMaking(true)
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ])
      // 画像化のあいだだけ、画面表示と同じA4の紙面（596×842pt）に固定する
      const canvas = await html2canvas(sheet, {
        scale: 2, backgroundColor: '#ffffff', useCORS: true,
        windowWidth: sheet.scrollWidth, windowHeight: sheet.scrollHeight,
        onclone: (doc: Document) => {
          const el = doc.getElementById('invoice-sheet') as HTMLElement | null
          if (!el) return
          el.style.setProperty('width', '596pt', 'important')
          el.style.setProperty('min-height', '842pt', 'important')
          el.style.setProperty('margin', '0', 'important')
          el.style.setProperty('box-shadow', 'none', 'important')
          el.style.setProperty('box-sizing', 'border-box', 'important')
          // 編集中の黄色い枠はPDFに出さない
          el.querySelectorAll('*').forEach(n => {
            const e = n as HTMLElement
            if (e.style?.outline) e.style.outline = 'none'
            if (e.style?.background === 'rgb(255, 253, 245)') e.style.background = 'transparent'
          })
          el.querySelectorAll('.no-print').forEach(n => ((n as HTMLElement).style.display = 'none'))
          // 入力欄は画像化すると文字がずれることがあるため、
          // 同じ見た目の文字に置き換えてから描画する
          el.querySelectorAll('input, textarea').forEach(n => {
            const f = n as HTMLInputElement
            const span = doc.createElement('span')
            span.textContent = f.value
            span.style.font = getComputedStyle(f).font
            span.style.color = getComputedStyle(f).color
            span.style.whiteSpace = 'pre-wrap'
            f.replaceWith(span)
          })
        },
      })
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' })
      const pw = pdf.internal.pageSize.getWidth()
      const ph = pdf.internal.pageSize.getHeight()
      // A4の幅に合わせ、縦が収まらない場合はページを分ける
      const imgH = (canvas.height * pw) / canvas.width
      const img = canvas.toDataURL('image/jpeg', 0.95)
      let left = imgH
      let pos = 0
      pdf.addImage(img, 'JPEG', 0, pos, pw, imgH)
      left -= ph
      while (left > 0) {
        pos -= ph
        pdf.addPage()
        pdf.addImage(img, 'JPEG', 0, pos, pw, imgH)
        left -= ph
      }
      const name = `請求書_${inv?.seller.shopName || ''}_${inv?.periodLabel || ''}.pdf`
      pdf.save(name)
    } catch (e) {
      console.error('PDFの作成に失敗しました', e)
      showNotice('PDFの作成に失敗しました。お手数ですが「印刷」からお試しください。')
    }
    setPdfMaking(false)
  }

  const issue = async () => {
    if (!(await ask({ title: '請求書を発行しますか？', body: '請求書番号を採番して発行します。', okLabel: '発行する' }))) return
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

  // 明細表の配色。実際に発行している請求書のPDFから読み取った色に合わせている。
  //   濃い青 #1A56B0 … ご請求金額の枠
  //   青     #6B89C0 … 明細表の罫線
  //   淡い青 #E8F0FE … 見出し行と合計欄の塗り
  //
  // 罫線は元は 0.5pt の #B7C8E8 だったが、「枠線が消えている」という
  // 指摘を受けて濃く・太くした。調べたところ線自体は消えておらず、
  // PDFにする途中（html2canvas → JPEG → A4への縮小）でも残っていた。
  // 原因は薄さだった。#B7C8E8 は明るさが 205 で、白（255）との差が 50 しかなく、
  // スマホの画面でも印刷でも見えない。#6B89C0 は差が 110 あり、はっきり出る。
  //
  // 太さも 0.5pt から 1pt に上げた。PDF は canvas を A4 幅へ約半分に縮めるため、
  // 0.5pt では紙の上で 0.25pt（0.09mm）まで細くなる。1pt なら 0.5pt 残る。
  const LINE = '#6B89C0'
  const ACCENT = '#1A56B0'
  const TINT = '#E8F0FE'
  const cell: React.CSSProperties = { border: `1pt solid ${LINE}`, padding: '0 6.7pt', fontSize: '10pt', height: '17.5pt' }
  const head: React.CSSProperties = { ...cell, textAlign: 'center', background: TINT, height: '17pt' }
  const right: React.CSSProperties = { ...cell, textAlign: 'right' }
  const sumLabel: React.CSSProperties = { ...cell, textAlign: 'right', background: TINT, height: '18.5pt' }
  const sumValue: React.CSSProperties = { ...right, background: TINT, height: '18.5pt' }
  // 絶対配置の共通指定。元PDFの座標をそのまま使う（下の abs() 参照）
  const abs: React.CSSProperties = { position: 'absolute', whiteSpace: 'nowrap' }
  // 編集中だけ入力できることが分かるようにする（印刷・PDFには枠を出さない）
  const editBox: React.CSSProperties = editing
    ? { background: '#FFFDF5', outline: '1pt dashed #F5A623', borderRadius: '2pt' }
    : {}
  const inputStyle: React.CSSProperties = {
    border: 'none', outline: 'none', background: 'transparent', font: 'inherit',
    color: 'inherit', padding: 0, margin: 0, width: '100%',
  }

  return (
    <div className='invoice-page' style={{ background: '#F1F5F9', minHeight: '100vh', padding: '20px 12px' }}>
      {/* 操作パネル（印刷には出さない） */}
      {isSeller && (
        <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: '#1E40AF', lineHeight: 1.9 }}>
          運営が発行した請求書です。内容のご確認と、PDFでの保存ができます。
          金額や日付のご相談は、お手数ですが運営までご連絡ください。
        </div>
      )}
      <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
        <Link href={isSeller ? '/dashboard/seller?tab=payment' : '/admin'} style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>
          {isSeller ? '← お支払いに戻る' : '← 管理画面'}
        </Link>
        {/* 紙面に出る2つの日付。どちらもここから直せる。
            発行日は、実際に先方へ出した日と紙面を合わせたい場面があるため。
            出店者には出さない。受け取る側が日付を動かせてはいけないため */}
        {!isSeller && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: '#64748B' }}>発行日</span>
          <input type='date' value={issuedOn} onChange={e => setIssuedOn(e.target.value)}
            style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }} />
          <span style={{ fontSize: '12px', color: '#64748B', marginLeft: '4px' }}>振込期限</span>
          <input type='date' value={dueOn} onChange={e => setDueOn(e.target.value)}
            style={{ border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '6px 10px', fontSize: '13px' }} />
          {inv.invoiceNo && (
            <button onClick={saveEdits} disabled={saving} style={{ background: saving ? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
              日付を保存
            </button>
          )}
        </div>
        )}
        <div style={{ flex: 1 }} />
        {!isSeller && (
        <button onClick={() => setEditing(v => !v)} style={{ background: editing ? '#1D4ED8' : '#fff', color: editing ? '#fff' : '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          {editing ? '編集を終える' : '内容を修正'}
        </button>
        )}
        {!isSeller && editing && (
          <button onClick={addItem} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 14px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>＋ 明細を追加</button>
        )}
        {!isSeller && inv.invoiceNo && (
          <button onClick={saveEdits} disabled={saving} style={{ background: saving ? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
            {saving ? '保存中...' : '修正を保存'}
          </button>
        )}
        {!isSeller && !inv.invoiceNo && (
          <button onClick={issue} disabled={issuing} style={{ background: issuing ? '#ccc' : '#16A34A', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: issuing ? 'not-allowed' : 'pointer' }}>
            {issuing ? '発行中...' : '発行して番号を確定'}
          </button>
        )}
        <button onClick={savePdf} disabled={pdfMaking} style={{ background: pdfMaking ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: pdfMaking ? 'not-allowed' : 'pointer' }}>
          {pdfMaking ? '作成中...' : 'PDFをダウンロード'}
        </button>
        <button onClick={() => window.print()} style={{ background: '#fff', color: '#64748B', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '9px 16px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>印刷</button>
      </div>

      {/* 取り消した請求書。開けてしまうこと自体は残しておくが、
          そのまま印刷して送られては困るので、いちばん上で強く知らせる */}
      {inv.voidedAt && (
        <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', background: '#FEF2F2', border: '2px solid #FCA5A5', borderRadius: '8px', padding: '12px 16px', color: '#B91C1C' }}>
          <div style={{ fontSize: '14px', fontWeight: 900, marginBottom: '4px' }}>
            この請求書は取り消されています
          </div>
          <div style={{ fontSize: '12px', lineHeight: 1.8 }}>
            {inv.voidReason && <>理由：{inv.voidReason}<br /></>}
            出店者の画面には表示されず、入金の集計にも入りません。
            <strong>この内容のまま先方へ送らないでください。</strong>
          </div>
        </div>
      )}

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
      {editing && (
        <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '10px 14px', fontSize: '12px', color: '#B45309', lineHeight: 1.8 }}>
          薄い枠の部分をクリックすると直せます（宛先・実施日・請求件名・金額・備考）。小計と消費税は自動で計算し直します。
          {inv.invoiceNo ? '　修正したら「修正を保存」を押してください。' : '　内容が決まったら「発行して番号を確定」を押してください。'}
        </div>
      )}
      {!inv.invoiceNo && (
        <div className='no-print' style={{ maxWidth: '596pt', margin: '0 auto 12px', fontSize: '12px', color: '#64748B' }}>
          いまは確認用の表示です。振込期限を決めてから「発行して番号を確定」を押すと、番号が採番されます。
        </div>
      )}

      {/* ===== 請求書本体 =====
          元のPDFから読み取った座標をそのまま指定している（単位はすべて pt）。
          流し込みで組むと明細に近づくほど位置がずれていくため、
          表より上は絶対配置で固定し、【明細】から下だけを流している。 */}
      <div id='invoice-sheet' className='invoice-sheet' style={{
        position: 'relative', width: '596pt', minHeight: '842pt', margin: '0 auto', background: '#fff',
        boxSizing: 'border-box', color: '#000',
        fontFamily: '"Hiragino Kaku Gothic ProN", "Yu Gothic", Meiryo, sans-serif',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      }}>
        {/* ロゴ。SVGのままだと画像化のときに下半分が切れてしまうためPNGを使う */}
        <img src='/logo-invoice.png' alt='出店コネクトナビ' className='invoice-logo'
          style={{ ...abs, left: '54.8pt', top: '55.3pt', width: '99.1pt', height: '24pt' }} />

        <div style={{ ...abs, right: '55.2pt', top: '53.9pt', fontSize: '10pt', lineHeight: '11.9pt', textAlign: 'right' }}>
          <div>請求書番号:{inv.invoiceNo || '（未発行）'}</div>
          <div>発行日:{jpDate(issuedOn)}</div>
          {dueOn && <div>お支払期限:{jpDate(dueOn)}</div>}
        </div>

        <div style={{ ...abs, left: '258.5pt', top: '120.4pt', fontSize: '22pt', lineHeight: '22pt', letterSpacing: '6.1pt' }}>請求書</div>

        {/* 宛先 */}
        <div style={{ ...abs, left: '53.2pt', top: '161.9pt', fontSize: '15pt', lineHeight: '15pt', ...editBox }}>
          {editing
            ? <input value={toName} onChange={e => setToName(e.target.value)} style={{ ...inputStyle, width: '200pt' }} placeholder='店舗名' />
            : (toName || '（店名未登録）')}
        </div>
        {(editing || toPerson) && (
          <div style={{ ...abs, left: '53.2pt', top: '181.5pt', fontSize: '12pt', lineHeight: '12pt' }}>
            <span style={{ display: 'inline-block', ...(editing ? { minWidth: '80pt', ...editBox } : {}) }}>
              {editing
                ? <input value={toPerson} onChange={e => setToPerson(e.target.value)} style={inputStyle} placeholder='担当者名' />
                : toPerson}
            </span>
            <span style={{ marginLeft: '3.3pt' }}>様</span>
          </div>
        )}

        {/* 差出人 */}
        <div style={{ ...abs, right: '55.2pt', top: '160.9pt', fontSize: '10pt', lineHeight: '11.9pt', textAlign: 'right' }}>
          <div>{ISSUER.name}</div>
          <div>{ISSUER.zip} {ISSUER.address}</div>
          <div>{ISSUER.mail}</div>
          <div>{ISSUER.taxId}</div>
        </div>

        <div style={{ ...abs, left: '53.2pt', top: '202.7pt', fontSize: '10pt', lineHeight: '10pt' }}>
          {inv.periodLabel}({items.length}件)を下記のとおりご請求申し上げます。
        </div>

        {/* ご請求金額（枠つき） */}
        <div style={{
          ...abs, left: '48pt', top: '235.5pt', width: '498.8pt', height: '29.2pt', boxSizing: 'border-box',
          border: `1pt solid ${ACCENT}`, background: TINT,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '13.3pt', fontSize: '18pt',
        }}>
          <span>ご請求金額({inv.periodLabel})</span>
          <span>{yen(total)}(税込)</span>
        </div>

        {/* ここから下は明細の件数で高さが変わるので、流し込みのまま置く */}
        <div style={{ paddingTop: '283.7pt', paddingLeft: '48pt', paddingRight: '48.5pt' }}>
        <div style={{ fontSize: '10pt', lineHeight: '10pt', marginLeft: '-5.5pt' }}>【明細】</div>
        <table style={{ width: '499.5pt', borderCollapse: 'collapse', tableLayout: 'fixed', marginTop: '2.2pt' }}>
          <colgroup>
            <col style={{ width: '32.2pt' }} />
            <col style={{ width: '58pt' }} />
            <col style={{ width: '317.2pt' }} />
            <col style={{ width: '92.1pt' }} />
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
            {items.map((it, idx) => (
              <tr key={idx}>
                <td style={{ ...cell, textAlign: 'center' }}>{idx + 1}</td>
                <td style={{ ...cell, textAlign: 'center', ...editBox }}>
                  {editing
                    ? <input value={it.date} onChange={e => setItem(idx, { date: e.target.value })} style={{ ...inputStyle, textAlign: 'center' }} placeholder='7/1' />
                    : it.date}
                </td>
                <td style={{ ...cell, ...editBox }}>
                  {editing
                    ? <input value={it.title} onChange={e => setItem(idx, { title: e.target.value })} style={inputStyle} placeholder='請求件名' />
                    : it.title}
                </td>
                <td style={{ ...right, ...editBox, position: 'relative' }}>
                  {editing ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4pt' }}>
                      <input type='number' value={it.amount} onChange={e => setItem(idx, { amount: parseInt(e.target.value, 10) || 0 })} style={{ ...inputStyle, textAlign: 'right' }} />
                      <button className='no-print' onClick={() => removeItem(idx)} title='この行を削除' style={{ border: 'none', background: 'none', color: '#DC2626', cursor: 'pointer', fontSize: '10pt', padding: 0 }}>✕</button>
                    </span>
                  ) : yen(it.amount)}
                </td>
              </tr>
            ))}
            {/* 元のPDFは明細と合計のあいだに空の行が1つ入る */}
            <tr>
              <td style={cell}>&nbsp;</td>
              <td style={cell}>&nbsp;</td>
              <td style={cell}>&nbsp;</td>
              <td style={cell}>&nbsp;</td>
            </tr>
            {/* 合計欄も同じ表の中に置く（元のPDFと同じ体裁） */}
            <tr>
              <td style={cell}>&nbsp;</td>
              <td style={cell}>&nbsp;</td>
              <td style={sumLabel}>小計(税抜)</td>
              <td style={sumValue}>{yen(subtotal)}</td>
            </tr>
            <tr>
              <td style={cell}>&nbsp;</td>
              <td style={cell}>&nbsp;</td>
              <td style={sumLabel}>消費税(10%)</td>
              <td style={sumValue}>{yen(tax)}</td>
            </tr>
            <tr>
              <td style={cell}>&nbsp;</td>
              <td style={cell}>&nbsp;</td>
              <td style={{ ...sumLabel, height: '20pt', fontSize: '11.5pt', fontWeight: 700 }}>税込合計</td>
              <td style={{ ...sumValue, height: '20pt', fontSize: '11.5pt', fontWeight: 700 }}>{yen(total)}</td>
            </tr>
          </tbody>
        </table>

        <div style={{ fontSize: '10pt', lineHeight: '10pt', marginTop: '23.1pt', marginLeft: '-5.5pt' }}>【振込先】</div>
        <div style={{ fontSize: '9pt', lineHeight: '11.9pt', marginTop: '2.1pt' }}>
          {ISSUER.bank.map(b => <div key={b}>{b}</div>)}
          {dueOn && <div style={{ marginTop: '4pt' }}>お支払期限:{jpDate(dueOn)}</div>}
        </div>
        <div style={{ fontSize: '8.3pt', lineHeight: '8.3pt', marginTop: '6.1pt', marginLeft: '-4.8pt', ...editBox }}>
          【備考】
          {editing
            ? <input value={note} onChange={e => setNote(e.target.value)} style={{ ...inputStyle, width: '85%' }} placeholder={ISSUER.note} />
            : (note || ISSUER.note)}
        </div>
        </div>
      </div>


      <Notice message={notice?.message ?? null} kind={notice?.kind} onClose={() => setNotice(null)} />
      <ConfirmDialog
        open={!!askState}
        title={askState?.title || ''}
        body={askState?.body}
        okLabel={askState?.okLabel}
        danger={askState?.danger}
        onOk={() => answerAsk(true)}
        onCancel={() => answerAsk(false)}
      />
    </div>
  )
}

// 出店者側の画面（app/dashboard/seller/invoice）からも同じ紙面を使う。
// 紙面を2つに分けて書くと、片方だけ古いままになるため
export function InvoiceScreen({ viewer = 'admin' }: { viewer?: Viewer } = {}) {
  return (
    <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>読み込み中...</div>}>
      <InvoiceInner viewer={viewer} />
    </Suspense>
  )
}

export default function InvoicePage() {
  return <InvoiceScreen viewer='admin' />
}
