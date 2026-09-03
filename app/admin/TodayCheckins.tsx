'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// 本日の受付状況。
//
// これまで運営は、当日の「着きました」「準備できました」を公式LINEで
// 一人ずつ受け取っていた。出店者がマイページで押した内容をここに集める。
//
// いちばん知りたいのは受付完了なので、まだ見ていないものは行を光らせる。
// 「確認」を押すと光りが止まる（applications.checkin_seen_at に時刻が入る）。
// 30秒ごとに読み直すので、画面を開いたままにしておけば当日ぶんは追える。

type Row = {
  id: string
  shopName: string
  placeTitle: string
  confirmed_at: string | null
  checked_in_at: string | null
  ready_at: string | null
  checkin_seen_at: string | null
  reported: boolean
}

const todayStr = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const timeOf = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

const cell: React.CSSProperties = { padding: '10px 12px', fontSize: '12px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }
const head: React.CSSProperties = { ...cell, fontWeight: 700, color: '#64748B', background: '#F8FAFC', whiteSpace: 'nowrap' }

function Mark({ at }: { at: string | null }) {
  if (!at) return <span style={{ color: '#CBD5E1' }}>—</span>
  return <span style={{ color: '#15803D', fontWeight: 700 }}>✓ {timeOf(at)}</span>
}

export default function TodayCheckins() {
  const [rows, setRows] = useState<Row[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const today = todayStr()
    const { data, error } = await supabase
      .from('applications')
      .select('id, seller_id, confirmed_at, checked_in_at, ready_at, checkin_seen_at, places(title)')
      .eq('status', 'approved').eq('apply_date', today)
      .order('checked_in_at', { ascending: false, nullsFirst: false })
    if (error) { setErr('読み込めませんでした：' + error.message); setLoaded(true); return }
    setErr(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const list = (data ?? []) as any[]
    if (list.length === 0) { setRows([]); setLoaded(true); return }

    // 店舗名は公開用のビューから引く（profiles には連絡先が入っている）
    const ids = Array.from(new Set(list.map(a => a.seller_id).filter(Boolean)))
    const [{ data: sellers }, { data: sales }] = await Promise.all([
      supabase.from('public_sellers').select('id, shop_name, name').in('id', ids),
      supabase.from('sales').select('application_id').in('application_id', list.map(a => a.id)),
    ])
    const nameById = new Map<string, string>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const s of (sellers ?? []) as any[]) nameById.set(s.id, s.shop_name || s.name || '(出店者)')
    const reported = new Set((sales ?? []).map((s: { application_id: string }) => s.application_id))

    setRows(list.map(a => ({
      id: a.id,
      shopName: nameById.get(a.seller_id) || '(出店者)',
      placeTitle: a.places?.title || '(案件名なし)',
      confirmed_at: a.confirmed_at,
      checked_in_at: a.checked_in_at,
      ready_at: a.ready_at,
      checkin_seen_at: a.checkin_seen_at,
      reported: reported.has(a.id),
    })))
    setLoaded(true)
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 30000)
    return () => clearInterval(timer)
  }, [load])

  const markSeen = async (applicationId: string) => {
    setBusy(applicationId)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) { setErr('ログインしなおしてからお試しください。'); setBusy(null); return }
    try {
      const res = await fetch('/api/onsite', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId, step: 'seen' }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json?.error || '更新できませんでした。'); return }
      await load()
    } catch {
      setErr('通信に失敗しました。')
    } finally {
      setBusy(null)
    }
  }

  if (!loaded) return null

  const unseen = rows.filter(r => r.checked_in_at && !r.checkin_seen_at).length
  const d = new Date()

  return (
    <section aria-label='本日の受付状況' style={{ background: '#fff', borderRadius: '12px', border: '1px solid ' + (unseen > 0 ? '#F5A623' : '#E2E8F0'), marginBottom: '20px', overflow: 'hidden' }}>
      {/* 見ていない受付完了の行を光らせる。動きを抑える設定の端末では色だけで示す */}
      <style>{`
        @keyframes ccn-blink { 0%,100% { background:#FFF8E1 } 50% { background:#FDE9BF } }
        .ccn-unseen { animation: ccn-blink 1.2s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .ccn-unseen { animation: none; background:#FFF8E1 } }
      `}</style>

      <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>本日の受付状況</span>
        <span style={{ fontSize: '12px', color: '#64748B' }}>{d.getMonth() + 1}月{d.getDate()}日</span>
        {unseen > 0 && (
          <span className='ccn-unseen' style={{ fontSize: '11px', fontWeight: 800, color: '#B45309', border: '1px solid #F5A623', borderRadius: '20px', padding: '3px 10px' }}>
            未確認の受付 {unseen}件
          </span>
        )}
      </div>

      {err && <div role='alert' style={{ padding: '12px 18px', fontSize: '12px', color: '#DC2626' }}>{err}</div>}

      {rows.length === 0 ? (
        <div style={{ padding: '20px 18px', color: '#999', fontSize: '13px' }}>本日の出店はありません。</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '640px' }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: 'left' }}>店舗</th>
                <th style={{ ...head, textAlign: 'left' }}>案件</th>
                <th style={head}>前日確認</th>
                <th style={head}>受付完了</th>
                <th style={head}>準備完了</th>
                <th style={head}>売上報告</th>
                <th style={head}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const isUnseen = !!r.checked_in_at && !r.checkin_seen_at
                return (
                  <tr key={r.id} className={isUnseen ? 'ccn-unseen' : undefined}>
                    <td style={{ ...cell, fontWeight: 700 }}>{r.shopName}</td>
                    <td style={{ ...cell, color: '#64748B' }}>{r.placeTitle}</td>
                    <td style={{ ...cell, textAlign: 'center' }}><Mark at={r.confirmed_at} /></td>
                    <td style={{ ...cell, textAlign: 'center' }}><Mark at={r.checked_in_at} /></td>
                    <td style={{ ...cell, textAlign: 'center' }}><Mark at={r.ready_at} /></td>
                    <td style={{ ...cell, textAlign: 'center' }}>
                      {r.reported ? <span style={{ color: '#15803D', fontWeight: 700 }}>✓</span> : <span style={{ color: '#CBD5E1' }}>—</span>}
                    </td>
                    <td style={{ ...cell, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isUnseen && (
                        <button type='button' onClick={() => markSeen(r.id)} disabled={busy === r.id}
                          style={{ fontSize: '11px', fontWeight: 800, padding: '5px 12px', borderRadius: '8px', border: '1px solid #F5A623', background: '#fff', color: '#B45309', cursor: busy === r.id ? 'wait' : 'pointer', minHeight: '30px' }}>
                          {busy === r.id ? '…' : '確認'}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
