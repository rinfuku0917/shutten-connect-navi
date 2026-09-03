'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import ConfirmDialog from './ConfirmDialog'
import NotifyChoice from './NotifyChoice'
import { exportPlaceSubmission, type SubmissionFormat } from '../lib/submissionXlsx'
import { exportPlaceSalesReport } from '../lib/salesReportXlsx'

// 案件ごとの応募者一覧。
//
// これまで応募者を見られるのは「出店承認」タブだけで、そこには
// 承認待ちのものしか出ていなかった。承認・不採用を済ませると一覧から
// 消えてしまい、「この案件に誰が応募したか」を後から確認できなかった。
// ここでは状態を問わず、その案件のすべての応募を出す。
//
// 申込は「出店希望日ごとに1行」で作られる。1社が3日申し込むと3件に
// なるため、そのまま並べると何社いるのか分からない。出店者ごとに
// まとめて、日付を中に並べる。

type Row = {
  id: string
  apply_date: string | null
  format: string | null
  status: string
  seller_id: string
  created_at: string | null
}

type Seller = {
  id: string
  shopName: string
  repName: string
  email: string
  phone: string
  address: string
  genre: string
  areas: string
  salesType: string
  vehicleType: string
  size: string
  equipment: string
  menu: string
  bio: string
  docsOk: number
  docsTotal: number
  rows: Row[]
  /** この案件のために出店者が入力したかどうか。提出用Excelはその内容で作られる */
  hasSubmission: boolean
  /** 出店者がこの案件あてに書いた連絡事項。提出用Excelには載せない */
  siteNote: string
}

const LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  pending: { text: '承認待ち', bg: '#FFF7ED', fg: '#C2410C' },
  approved: { text: '承認済み', bg: '#ECFDF5', fg: '#047857' },
  rejected: { text: '不採用', bg: '#FEF2F2', fg: '#B91C1C' },
  cancelled: { text: '取消し', bg: '#F1F5F9', fg: '#475569' },
}

function badge(status: string) {
  return LABEL[status] ?? { text: status || '不明', bg: '#F1F5F9', fg: '#475569' }
}

function size(l?: number | null, w?: number | null, h?: number | null) {
  const v = [l, w, h].filter(x => x !== null && x !== undefined && x !== 0)
  if (v.length === 0) return ''
  return `${l ?? '-'} × ${w ?? '-'} × ${h ?? '-'} cm`
}

function fmtDate(s: string | null) {
  if (!s) return '日程の指定なし'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
  return `${d.getMonth() + 1}月${d.getDate()}日（${w}）`
}

export default function PlaceApplicationsModal({
  placeId,
  placeTitle,
  onClose,
  onOpenDocs,
}: {
  placeId: string
  placeTitle: string
  onClose: () => void
  /** 書類の件数を押したときに、その出店者の書類審査へ移動する */
  onOpenDocs?: (sellerId: string, sellerName: string) => void
}) {
  const [loading, setLoading] = useState(true)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // 承認・不採用は出店者にメールが飛ぶので、必ず確認をはさむ
  const [ask, setAsk] = useState<{ id: string; status: 'approved' | 'rejected'; who: string; when: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [askErr, setAskErr] = useState<string | null>(null)
  // 承認・不採用のときにメールを送るかどうか。既定は送る
  const [notify, setNotify] = useState(true)

  // 承認済みの出店の取消し。
  // この一覧は管理画面からしか開かれないため、ここに置いている。
  // 出店者・募集者の画面には取消しの入口を作らない方針
  // （「連絡すれば消せる」と分かるとキャンセルが増えるため、
  //   運営が連絡を受けて処理する形を守る）。
  // 念のためAPI側でも role='admin' を確かめている。
  const [cxAsk, setCxAsk] = useState<{ id: string; who: string; when: string } | null>(null)
  const [cxBusy, setCxBusy] = useState(false)
  const [cxErr, setCxErr] = useState<string | null>(null)
  const [cxReason, setCxReason] = useState('')

  const REASONS = ['体調不良', '車両の故障', '日程の重複', '天候', '出店者の都合', 'その他']

  const runCancel = async () => {
    if (!cxAsk) return
    setCxBusy(true)
    setCxErr(null)
    try {
      const { data: sess } = await supabase.auth.getSession()
      const token = sess.session?.access_token
      if (!token) { setCxErr('ログインしなおしてからお試しください。'); return }
      const res = await fetch('/api/applications/cancel-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId: cxAsk.id, reason: cxReason }),
      })
      const json = await res.json()
      if (!res.ok) {
        // お金の記録で止まった場合は、何が引っかかったのかを並べて出す
        const blockers: string[] = Array.isArray(json?.blockers) ? json.blockers : []
        setCxErr((json?.error || '取り消せませんでした。') +
          (blockers.length ? '\n\n・' + blockers.join('\n・') : ''))
        return
      }
      setCxAsk(null)
      setCxReason('')
      await load()
    } catch {
      setCxErr('通信に失敗しました。もう一度お試しください。')
    } finally {
      setCxBusy(false)
    }
  }

  // 提出用Excelの書き出し。
  // 出す資料は2種類あり、必要になる場面が違うので選べるようにしている。
  //   出店者情報 … 出店の前に施設・企業へ出す（誰が何をいくらで売るか）
  //   売上報告   … 出店が終わったあとに企業から求められることがある
  const [xlsxKind, setXlsxKind] = useState<'submission' | 'sales'>('submission')
  const [xlsxBusy, setXlsxBusy] = useState<SubmissionFormat | null>(null)
  const [salesBusy, setSalesBusy] = useState(false)
  const [xlsxMsg, setXlsxMsg] = useState<string | null>(null)
  const [withPending, setWithPending] = useState(false)

  const downloadSalesReport = async () => {
    setSalesBusy(true)
    setXlsxMsg(null)
    try {
      const n = await exportPlaceSalesReport(supabase, placeId, placeTitle)
      setXlsxMsg(n === 0
        ? '売上の報告がまだ届いていません。出店者が報告すると、ここから書き出せます。'
        : `${n}日分のシートで保存しました。`)
    } catch (e) {
      setXlsxMsg('作成できませんでした：' + (e instanceof Error ? e.message : '不明なエラー'))
    } finally {
      setSalesBusy(false)
    }
  }

  const downloadXlsx = async (format: SubmissionFormat) => {
    setXlsxBusy(format)
    setXlsxMsg(null)
    try {
      const n = await exportPlaceSubmission(supabase, placeId, placeTitle, format, withPending)
      if (n === 0) {
        setXlsxMsg(
          withPending
            ? '出店日の入った申込がまだありません。日程を選んで応募されるとExcelに載ります。'
            : '出店日の入った承認済みの申込がまだありません。承認するか、下の「承認待ちも含める」をお使いください。',
        )
      } else {
        const unit = format === 'aeon' ? `${n}か月分` : `${n}日分`
        setXlsxMsg(withPending ? `${unit}のシートで保存しました。承認待ちの出店者が含まれています。` : `${unit}のシートで保存しました。`)
      }
    } catch (e) {
      setXlsxMsg('作成できませんでした：' + (e instanceof Error ? e.message : '不明なエラー'))
    } finally {
      setXlsxBusy(null)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    const { data, error } = await supabase
      .from('applications')
      .select('id, apply_date, format, status, seller_id, created_at, profiles!applications_seller_id_fkey(name, shop_name, email, phone, address, genre, areas, sales_type, vehicle_type, size_length, size_width, size_height, equipment, menu, bio)')
      .eq('place_id', placeId)
      .order('created_at', { ascending: true })

    if (error) {
      setErr('読み込めませんでした：' + error.message)
      setLoading(false)
      return
    }

    const rows = (data ?? []) as unknown as (Row & { profiles: Record<string, unknown> | null })[]

    // 書類の提出状況をまとめて引く
    const ids = Array.from(new Set(rows.map(r => r.seller_id).filter(Boolean)))
    const docs = new Map<string, { ok: number; total: number }>()
    if (ids.length > 0) {
      const { data: d } = await supabase.from('seller_documents').select('seller_id, status').in('seller_id', ids)
      for (const x of d ?? []) {
        const cur = docs.get(x.seller_id) || { ok: 0, total: 0 }
        cur.total += 1
        if (x.status === 'approved') cur.ok += 1
        docs.set(x.seller_id, cur)
      }
    }

    // この案件のために入力された出店者情報。入っていればExcelはその内容で作られる
    const subs = new Map<string, string>()
    if (ids.length > 0) {
      const { data: sb } = await supabase
        .from('application_submissions').select('seller_id, note')
        .eq('place_id', placeId).in('seller_id', ids)
      for (const x of sb ?? []) subs.set(x.seller_id, x.note || '')
    }

    // 出店者ごとにまとめる
    const map = new Map<string, Seller>()
    for (const r of rows) {
      const p = (r.profiles ?? {}) as Record<string, string | number | null>
      const s = String(p.shop_name || p.name || '(出店者)')
      let cur = map.get(r.seller_id)
      if (!cur) {
        const dc = docs.get(r.seller_id) || { ok: 0, total: 0 }
        cur = {
          id: r.seller_id,
          shopName: s,
          repName: String(p.name ?? ''),
          email: String(p.email ?? ''),
          phone: String(p.phone ?? ''),
          address: String(p.address ?? ''),
          genre: String(p.genre ?? ''),
          areas: Array.isArray(p.areas) ? (p.areas as unknown as string[]).join('・') : String(p.areas ?? ''),
          salesType: String(p.sales_type ?? ''),
          vehicleType: String(p.vehicle_type ?? ''),
          size: size(p.size_length as number, p.size_width as number, p.size_height as number),
          equipment: String(p.equipment ?? ''),
          menu: String(p.menu ?? ''),
          bio: String(p.bio ?? ''),
          docsOk: dc.ok,
          docsTotal: dc.total,
          rows: [],
          hasSubmission: subs.has(r.seller_id),
          siteNote: subs.get(r.seller_id) || '',
        }
        map.set(r.seller_id, cur)
      }
      cur.rows.push({ id: r.id, apply_date: r.apply_date, format: r.format, status: r.status, seller_id: r.seller_id, created_at: r.created_at })
    }

    // 承認待ちがある出店者を先に出す
    const list = Array.from(map.values())
    list.forEach(s => s.rows.sort((a, b) => (a.apply_date ?? '').localeCompare(b.apply_date ?? '')))
    list.sort((a, b) => {
      const pa = a.rows.some(r => r.status === 'pending') ? 0 : 1
      const pb = b.rows.some(r => r.status === 'pending') ? 0 : 1
      return pa - pb
    })
    setSellers(list)
    setLoading(false)
  }, [placeId])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !ask) onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose, ask])

  const apply = async () => {
    if (!ask) return
    setBusy(true)
    setAskErr(null)
    try {
      const { error } = await supabase.from('applications').update({ status: ask.status }).eq('id', ask.id)
      if (error) { setAskErr('変更できませんでした：' + error.message); return }
      // 出店者へのお知らせ。チェックを外した場合は送らない。
      // 送れなかった場合でも、状態の変更自体は成功として扱う。
      if (notify) {
        try {
          await fetch('/api/notify/application-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ applicationId: ask.id, status: ask.status }),
          })
        } catch { /* メールが送れないだけなので進める */ }
      }
      setAsk(null)
      await load()
    } catch {
      setAskErr('通信に失敗しました。もう一度お試しください。')
    } finally {
      setBusy(false)
    }
  }

  const total = sellers.reduce((n, s) => n + s.rows.length, 0)
  const pend = sellers.reduce((n, s) => n + s.rows.filter(r => r.status === 'pending').length, 0)
  const appr = sellers.reduce((n, s) => n + s.rows.filter(r => r.status === 'approved').length, 0)
  const rej = sellers.reduce((n, s) => n + s.rows.filter(r => r.status === 'rejected').length, 0)

  const chip: React.CSSProperties = { fontSize: '11px', fontWeight: 800, padding: '3px 9px', borderRadius: '999px' }
  const kv: React.CSSProperties = { fontSize: '12px', color: '#475569', lineHeight: 1.9 }

  return (
    <>
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 1500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '16px', overflowY: 'auto' }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{ background: '#fff', borderRadius: '14px', width: '100%', maxWidth: '760px', margin: '24px 0', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}
        >
          {/* 見出し */}
          <div style={{ position: 'sticky', top: 0, background: '#fff', borderRadius: '14px 14px 0 0', borderBottom: '1px solid #EEE', padding: '16px 18px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#111', lineHeight: 1.6 }}>{placeTitle}</div>
              <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>この案件への応募</div>
            </div>
            <button
              type='button'
              onClick={onClose}
              style={{ flexShrink: 0, background: '#F1F5F9', border: 'none', borderRadius: '8px', width: '40px', height: '40px', fontSize: '18px', color: '#475569', cursor: 'pointer' }}
              aria-label='閉じる'
            >
              ×
            </button>
          </div>

          <div style={{ padding: '16px 18px 20px' }}>
            {loading && <div style={{ padding: '30px', textAlign: 'center', color: '#888', fontSize: '13px' }}>読み込み中…</div>}

            {err && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', color: '#B91C1C', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', lineHeight: 1.8 }}>{err}</div>
            )}

            {!loading && !err && sellers.length === 0 && (
              <div style={{ padding: '30px', textAlign: 'center', color: '#888', fontSize: '13px', lineHeight: 1.9 }}>
                この案件にはまだ応募がありません。
              </div>
            )}

            {!loading && !err && sellers.length > 0 && (
              <>
                {/* 内訳 */}
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <span style={{ ...chip, background: '#F1F5F9', color: '#334155' }}>出店者 {sellers.length}社</span>
                  <span style={{ ...chip, background: '#EBF6FD', color: '#1D4ED8' }}>申込 {total}件</span>
                  {pend > 0 && <span style={{ ...chip, background: LABEL.pending.bg, color: LABEL.pending.fg }}>承認待ち {pend}</span>}
                  {appr > 0 && <span style={{ ...chip, background: LABEL.approved.bg, color: LABEL.approved.fg }}>承認済み {appr}</span>}
                  {rej > 0 && <span style={{ ...chip, background: LABEL.rejected.bg, color: LABEL.rejected.fg }}>不採用 {rej}</span>}
                </div>
                <p style={{ fontSize: '12px', color: '#888', lineHeight: 1.9, margin: '0 0 14px' }}>
                  申込は出店希望日ごとに1件で数えます。1社が3日申し込むと3件になります。
                </p>

                {/* 施設・企業へ提出するExcel。出店の前後で必要な資料が違うので選べるようにしている */}
                <div style={{ background: '#F8FBFE', border: '1px solid #DCE9F5', borderRadius: '10px', padding: '13px 15px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 900, color: '#1D4ED8', marginBottom: '9px' }}>📄 提出用Excelを作る</div>

                  <div role='tablist' aria-label='書き出す資料' style={{ display: 'flex', gap: '6px', marginBottom: '11px', flexWrap: 'wrap' }}>
                    {([
                      { key: 'submission' as const, label: '出店者情報', hint: '出店の前に施設へ出す資料' },
                      { key: 'sales' as const, label: '売上などの報告', hint: '出店が終わったあとに出す資料' },
                    ]).map(t => {
                      const on = xlsxKind === t.key
                      return (
                        <button
                          key={t.key} type='button' role='tab' aria-selected={on} title={t.hint}
                          onClick={() => { setXlsxKind(t.key); setXlsxMsg(null) }}
                          style={{ background: on ? '#1D4ED8' : '#fff', color: on ? '#fff' : '#475569', border: '1px solid ' + (on ? '#1D4ED8' : '#DCE9F5'), borderRadius: '999px', padding: '7px 16px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', minHeight: '34px' }}
                        >
                          {t.label}
                        </button>
                      )
                    })}
                  </div>

                  {xlsxKind === 'submission' ? (
                    <>
                      <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: 1.8, marginBottom: '10px' }}>
                        承認済みの出店者を、普段ご提出いただいている様式で書き出します。施設に合わせて様式を選んでください。出店者が現場ごとに入力していれば、その内容が載ります。
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type='button'
                          onClick={() => downloadXlsx('daily')}
                          disabled={xlsxBusy !== null}
                          title='開催日ごとに1シート。店舗名・Instagram・ジャンル・テイクアウト時／袋・利用可能決済・メニュー'
                          style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '999px', padding: '8px 16px', fontSize: '12px', fontWeight: 800, cursor: xlsxBusy ? 'wait' : 'pointer', minHeight: '36px', opacity: xlsxBusy && xlsxBusy !== 'daily' ? 0.5 : 1 }}
                        >
                          {xlsxBusy === 'daily' ? '作成中…' : '日付ごとの様式'}
                        </button>
                        <button
                          type='button'
                          onClick={() => downloadXlsx('aeon')}
                          disabled={xlsxBusy !== null}
                          title='月ごとに1シート。施設名と希望日程の欄あり。イオンモール系でご提出いただいている様式'
                          style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', borderRadius: '999px', padding: '8px 16px', fontSize: '12px', fontWeight: 800, cursor: xlsxBusy ? 'wait' : 'pointer', minHeight: '36px', opacity: xlsxBusy && xlsxBusy !== 'aeon' ? 0.5 : 1 }}
                        >
                          {xlsxBusy === 'aeon' ? '作成中…' : 'イオン様式（月ごと）'}
                        </button>
                      </div>
                      <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '11px', cursor: 'pointer', minHeight: '32px' }}>
                        <input
                          type='checkbox'
                          checked={withPending}
                          onChange={e => { setWithPending(e.target.checked); setXlsxMsg(null) }}
                          style={{ width: '17px', height: '17px', marginTop: '2px', flexShrink: 0, accentColor: '#B45309', cursor: 'pointer' }}
                        />
                        <span style={{ fontSize: '12px', color: '#475569', lineHeight: 1.8 }}>
                          <strong style={{ color: '#B45309' }}>承認待ちも含める</strong>
                          <br />
                          承認する前に中身を見比べたいときに。含めた出店者は見出しに「（承認待ち）」と入り、ファイル名も「_承認待ち含む」になります。
                          <strong style={{ color: '#B45309' }}>このファイルはそのまま施設へ提出しないでください。</strong>
                        </span>
                      </label>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '11.5px', color: '#64748B', lineHeight: 1.8, marginBottom: '10px' }}>
                        出店者から届いた報告（売上金額・販売食数・天候・来客数・所感）を、開催日ごとにまとめます。
                      </div>
                      <button
                        type='button'
                        onClick={downloadSalesReport}
                        disabled={salesBusy}
                        title='開催日ごとに1シート。店舗名・売上金額・販売食数・天候・来客数・品目別の販売実績'
                        style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: '999px', padding: '8px 16px', fontSize: '12px', fontWeight: 800, cursor: salesBusy ? 'wait' : 'pointer', minHeight: '36px' }}
                      >
                        {salesBusy ? '作成中…' : '売上報告を書き出す'}
                      </button>
                    </>
                  )}

                  {xlsxMsg && (
                    <div style={{ marginTop: '10px', fontSize: '12px', color: xlsxMsg.includes('できませんでした') || xlsxMsg.includes('ありません') ? '#B45309' : '#047857', lineHeight: 1.8 }}>
                      {xlsxMsg}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sellers.map(s => {
                    const open = openId === s.id
                    return (
                      <div key={s.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '13px 15px', background: '#FBFCFD' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: '#111' }}>{s.shopName}</span>
                            {s.docsTotal > 0 && (
                              onOpenDocs ? (
                                <button
                                  type='button'
                                  onClick={() => onOpenDocs(s.id, s.shopName)}
                                  title={`${s.shopName} の書類審査を開く`}
                                  style={{ ...chip, background: s.docsOk === s.docsTotal ? '#ECFDF5' : '#FFF7ED', color: s.docsOk === s.docsTotal ? '#047857' : '#C2410C', border: '1px solid ' + (s.docsOk === s.docsTotal ? '#A7F3D0' : '#FED7AA'), cursor: 'pointer', minHeight: '28px' }}
                                >
                                  書類 {s.docsOk}/{s.docsTotal} ›
                                </button>
                              ) : (
                                <span style={{ ...chip, background: s.docsOk === s.docsTotal ? '#ECFDF5' : '#FFF7ED', color: s.docsOk === s.docsTotal ? '#047857' : '#C2410C' }}>
                                  書類 {s.docsOk}/{s.docsTotal}
                                </span>
                              )
                            )}
                            {s.docsTotal === 0 && (
                              onOpenDocs ? (
                                <button
                                  type='button'
                                  onClick={() => onOpenDocs(s.id, s.shopName)}
                                  title={`${s.shopName} の書類審査を開く`}
                                  style={{ ...chip, background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', cursor: 'pointer', minHeight: '28px' }}
                                >
                                  書類 未提出 ›
                                </button>
                              ) : (
                                <span style={{ ...chip, background: '#FEF2F2', color: '#B91C1C' }}>書類 未提出</span>
                              )
                            )}
                            {/* この案件のために入力があれば、Excelはその内容で作られる。
                                入力が無ければプロフィールが使われるので、そこも見えるようにする */}
                            <span
                              style={{ ...chip, background: s.hasSubmission ? '#EFF6FF' : '#F8FAFC', color: s.hasSubmission ? '#1D4ED8' : '#94A3B8' }}
                              title={s.hasSubmission
                                ? 'この案件のための出店者情報が入力されています。提出用Excelにはこの内容が載ります'
                                : 'この案件のための入力がありません。提出用Excelにはプロフィールの内容が載ります'}
                            >
                              {s.hasSubmission ? '現場ごとの入力あり' : 'プロフィールの内容'}
                            </span>
                          </div>

                          {s.siteNote && (
                            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: '8px', padding: '9px 11px', marginBottom: '8px' }}>
                              <div style={{ fontSize: '11px', fontWeight: 800, color: '#B45309', marginBottom: '3px' }}>出店者からの連絡事項</div>
                              <div style={{ fontSize: '12px', color: '#475569', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{s.siteNote}</div>
                            </div>
                          )}

                          {/* 申込んだ日と、その状態 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {s.rows.map(r => {
                              const b = badge(r.status)
                              return (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#fff', border: '1px solid #EEF2F6', borderRadius: '8px', padding: '8px 10px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>{fmtDate(r.apply_date)}</span>
                                  {r.format && <span style={{ fontSize: '11px', color: '#888' }}>{r.format}</span>}
                                  <span style={{ ...chip, background: b.bg, color: b.fg }}>{b.text}</span>
                                  {r.status === 'approved' && (
                                    <span style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                                      <button
                                        type='button'
                                        onClick={() => { setCxErr(null); setCxReason(''); setCxAsk({ id: r.id, who: s.shopName, when: fmtDate(r.apply_date) }) }}
                                        title='出店者から連絡を受けて、この出店を取り消します'
                                        style={{ background: '#fff', color: '#475569', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', minHeight: '34px' }}
                                      >
                                        出店取消し
                                      </button>
                                    </span>
                                  )}
                                  {r.status === 'pending' && (
                                    <span style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                                      <button
                                        type='button'
                                        onClick={() => { setAskErr(null); setNotify(true); setAsk({ id: r.id, status: 'approved', who: s.shopName, when: fmtDate(r.apply_date) }) }}
                                        style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', minHeight: '34px' }}
                                      >
                                        承認
                                      </button>
                                      <button
                                        type='button'
                                        onClick={() => { setAskErr(null); setNotify(true); setAsk({ id: r.id, status: 'rejected', who: s.shopName, when: fmtDate(r.apply_date) }) }}
                                        style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', minHeight: '34px' }}
                                      >
                                        不採用
                                      </button>
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>

                          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                            <button
                              type='button'
                              onClick={() => setOpenId(open ? null : s.id)}
                              style={{ background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#475569', cursor: 'pointer', minHeight: '34px' }}
                            >
                              {open ? '出店者の情報を閉じる' : '出店者の情報を見る'}
                            </button>
                            <Link
                              href={`/sellers/${s.id}`}
                              target='_blank'
                              rel='noopener noreferrer'
                              style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '7px 14px', fontSize: '12px', fontWeight: 700, color: '#1D4ED8', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', minHeight: '34px' }}
                            >
                              公開ページ
                            </Link>
                          </div>
                        </div>

                        {open && (
                          <div style={{ borderTop: '1px solid #EEF2F6', padding: '13px 15px', background: '#fff' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <tbody>
                                {([
                                  ['代表者', s.repName],
                                  ['メール', s.email],
                                  ['電話', s.phone],
                                  ['住所', s.address],
                                  ['ジャンル', s.genre],
                                  ['対応エリア', s.areas],
                                  ['販売形態', s.salesType],
                                  ['車両', s.vehicleType],
                                  ['サイズ', s.size],
                                  ['設備', s.equipment],
                                  ['メニュー', s.menu],
                                  ['紹介文', s.bio],
                                ] as [string, string][])
                                  .filter(([, v]) => v && v.trim())
                                  .map(([k, v]) => (
                                    <tr key={k}>
                                      <th style={{ ...kv, textAlign: 'left', verticalAlign: 'top', width: '84px', padding: '5px 10px 5px 0', color: '#94A3B8', fontWeight: 700, whiteSpace: 'nowrap' }}>{k}</th>
                                      <td style={{ ...kv, padding: '5px 0', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{v}</td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={!!ask}
        busy={busy}
        error={askErr}
        danger={ask?.status === 'rejected'}
        title={ask?.status === 'approved' ? 'この申込を承認しますか？' : 'この申込を不採用にしますか？'}
        body={
          ask
            ? `${ask.who}／${ask.when}\n\n` +
              (ask.status === 'approved'
                ? '承認するとマッチングが成立します。'
                : '不採用にすると、この申込は取り消されます。')
            : ''
        }
        extra={
          ask ? <NotifyChoice checked={notify} onChange={setNotify} disabled={busy} approved={ask.status === 'approved'} /> : null
        }
        okLabel={ask?.status === 'approved' ? '承認する' : '不採用にする'}
        onOk={apply}
        onCancel={() => { if (!busy) { setAsk(null); setAskErr(null) } }}
      />

      <ConfirmDialog
        open={!!cxAsk}
        busy={cxBusy}
        error={cxErr}
        danger
        title='この出店を取り消しますか？'
        body={
          cxAsk
            ? `${cxAsk.who}／${cxAsk.when}\n\n` +
              '出店者・募集者・運営にお知らせのメールが届きます。\n' +
              '確定後の取消しはキャンセル料の対象です（キャンセルポリシー）。\n' +
              '売上の報告や請求書がある出店は取り消せません。'
            : ''
        }
        extra={
          cxAsk ? (
            <div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                取消しの理由（任意・あとから見返せます）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '8px' }}>
                {REASONS.map(v => {
                  const on = cxReason === v
                  return (
                    <button
                      key={v} type='button' disabled={cxBusy}
                      onClick={() => setCxReason(on ? '' : v)}
                      style={{ fontSize: '12px', padding: '5px 12px', borderRadius: '999px', cursor: cxBusy ? 'not-allowed' : 'pointer', border: '1px solid ' + (on ? '#B45309' : '#E2E8F0'), background: on ? '#FFF8E1' : '#fff', color: on ? '#B45309' : '#64748B', fontWeight: on ? 700 : 400 }}
                    >
                      {v}
                    </button>
                  )
                })}
              </div>
              <input
                value={cxReason} disabled={cxBusy}
                onChange={e => setCxReason(e.target.value)}
                placeholder='そのまま書くこともできます'
                aria-label='取消しの理由'
                style={{ width: '100%', border: '1px solid #E2E8F0', borderRadius: '8px', padding: '8px 11px', fontSize: '13px', color: '#1a1a1a' }}
              />
            </div>
          ) : null
        }
        okLabel='出店を取り消す'
        onOk={runCancel}
        onCancel={() => { if (!cxBusy) { setCxAsk(null); setCxErr(null) } }}
      />
    </>
  )
}
