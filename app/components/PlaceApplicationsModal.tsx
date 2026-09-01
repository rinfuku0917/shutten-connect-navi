'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../lib/supabase'
import ConfirmDialog from './ConfirmDialog'

// 案件ごとの応募者一覧。
//
// これまで応募者を見られるのは「出店承認」タブだけで、そこには
// 承認待ちのものしか出ていなかった。承認・却下を済ませると一覧から
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
}

const LABEL: Record<string, { text: string; bg: string; fg: string }> = {
  pending: { text: '承認待ち', bg: '#FFF7ED', fg: '#C2410C' },
  approved: { text: '承認済み', bg: '#ECFDF5', fg: '#047857' },
  rejected: { text: '却下', bg: '#FEF2F2', fg: '#B91C1C' },
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
}: {
  placeId: string
  placeTitle: string
  onClose: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)

  // 承認・却下は出店者にメールが飛ぶので、必ず確認をはさむ
  const [ask, setAsk] = useState<{ id: string; status: 'approved' | 'rejected'; who: string; when: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [askErr, setAskErr] = useState<string | null>(null)

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
      // 出店者へのお知らせ（送れなくても変更自体は成功として扱う）
      try {
        await fetch('/api/notify/application-status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ applicationId: ask.id, status: ask.status }),
        })
      } catch { /* メールが送れないだけなので進める */ }
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
                  {rej > 0 && <span style={{ ...chip, background: LABEL.rejected.bg, color: LABEL.rejected.fg }}>却下 {rej}</span>}
                </div>
                <p style={{ fontSize: '12px', color: '#888', lineHeight: 1.9, margin: '0 0 14px' }}>
                  申込は出店希望日ごとに1件で数えます。1社が3日申し込むと3件になります。
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {sellers.map(s => {
                    const open = openId === s.id
                    return (
                      <div key={s.id} style={{ border: '1px solid #E2E8F0', borderRadius: '12px', overflow: 'hidden' }}>
                        <div style={{ padding: '13px 15px', background: '#FBFCFD' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '8px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 900, color: '#111' }}>{s.shopName}</span>
                            {s.docsTotal > 0 && (
                              <span style={{ ...chip, background: s.docsOk === s.docsTotal ? '#ECFDF5' : '#FFF7ED', color: s.docsOk === s.docsTotal ? '#047857' : '#C2410C' }}>
                                書類 {s.docsOk}/{s.docsTotal}
                              </span>
                            )}
                          </div>

                          {/* 申込んだ日と、その状態 */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {s.rows.map(r => {
                              const b = badge(r.status)
                              return (
                                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', background: '#fff', border: '1px solid #EEF2F6', borderRadius: '8px', padding: '8px 10px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#334155' }}>{fmtDate(r.apply_date)}</span>
                                  {r.format && <span style={{ fontSize: '11px', color: '#888' }}>{r.format}</span>}
                                  <span style={{ ...chip, background: b.bg, color: b.fg }}>{b.text}</span>
                                  {r.status === 'pending' && (
                                    <span style={{ display: 'flex', gap: '6px', marginLeft: 'auto' }}>
                                      <button
                                        type='button'
                                        onClick={() => { setAskErr(null); setAsk({ id: r.id, status: 'approved', who: s.shopName, when: fmtDate(r.apply_date) }) }}
                                        style={{ background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', minHeight: '34px' }}
                                      >
                                        承認
                                      </button>
                                      <button
                                        type='button'
                                        onClick={() => { setAskErr(null); setAsk({ id: r.id, status: 'rejected', who: s.shopName, when: fmtDate(r.apply_date) }) }}
                                        style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA', borderRadius: '6px', padding: '6px 12px', fontSize: '12px', fontWeight: 800, cursor: 'pointer', minHeight: '34px' }}
                                      >
                                        却下
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
        title={ask?.status === 'approved' ? 'この申込を承認しますか？' : 'この申込を却下しますか？'}
        body={
          ask
            ? `${ask.who}／${ask.when}\n\n` +
              (ask.status === 'approved'
                ? '承認するとマッチングが成立し、出店者にお知らせのメールが送られます。'
                : '却下すると申込は取り消され、出店者にお知らせのメールが送られます。')
            : ''
        }
        okLabel={ask?.status === 'approved' ? '承認する' : '却下する'}
        onOk={apply}
        onCancel={() => { if (!busy) { setAsk(null); setAskErr(null) } }}
      />
    </>
  )
}
