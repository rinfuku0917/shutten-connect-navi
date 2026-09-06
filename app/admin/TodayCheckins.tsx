'use client'

import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// 本日の受付状況。
//
// これまで運営は、当日の「着きました」「準備できました」を公式LINEで
// 一人ずつ受け取っていた。出店者がマイページで押した内容をここに集める。
//
// 工程は6つ。前日確認 / 車両の搬入 / 営業準備中 / 営業開始 / 営業終了 / 撤収。
// 済んだものは青、まだのものは赤。全部そろうと「受付完了」を押せるようになり、
// 押すと出店者の画面にも「運営が受付を完了しました」と出る。
//
// まだ受付完了を押していない行は光らせる。30秒ごとに読み直すので、
// 画面を開いたままにしておけば当日は追える。
//
// 撤収が日をまたぐことがあるため、前日ぶんも拾う。

type Row = {
  id: string
  shopName: string
  placeTitle: string
  applyDate: string
  confirmed_at: string | null
  checked_in_at: string | null
  ready_at: string | null
  opened_at: string | null
  closed_at: string | null
  left_at: string | null
  checkin_seen_at: string | null
  reported: boolean
}

const STEPS: { key: keyof Row; label: string }[] = [
  { key: 'confirmed_at', label: '前日確認' },
  { key: 'checked_in_at', label: '搬入' },
  { key: 'ready_at', label: '準備中' },
  { key: 'opened_at', label: '営業開始' },
  { key: 'closed_at', label: '営業終了' },
  { key: 'left_at', label: '撤収' },
]
// 「受付完了」を押せる条件。前日確認は当日の作業ではないので外す
const REQUIRED: (keyof Row)[] = ['checked_in_at', 'ready_at', 'opened_at', 'closed_at', 'left_at']

const dayStr = (offset = 0) => {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const timeOf = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

const cell: React.CSSProperties = { padding: '9px 10px', fontSize: '12px', borderBottom: '1px solid #F1F5F9', verticalAlign: 'middle' }
const head: React.CSSProperties = { ...cell, fontWeight: 700, color: '#64748B', background: '#F8FAFC', whiteSpace: 'nowrap', textAlign: 'center' }

// 済み＝青、まだ＝赤。ひと目で進み具合が分かるようにする
function Mark({ at }: { at: string | null }) {
  if (at) return <span style={{ color: '#1D4ED8', fontWeight: 700, whiteSpace: 'nowrap' }}>✓ {timeOf(at)}</span>
  return <span style={{ color: '#DC2626', fontWeight: 700 }}>—</span>
}

export default function TodayCheckins() {
  const [rows, setRows] = useState<Row[]>([])
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('applications')
      .select('id, seller_id, apply_date, confirmed_at, checked_in_at, ready_at, opened_at, closed_at, left_at, checkin_seen_at, places(title)')
      .eq('status', 'approved')
      .in('apply_date', [dayStr(0), dayStr(-1)])   // 撤収が日をまたぐことがある
      .order('apply_date', { ascending: false })
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
      applyDate: a.apply_date,
      confirmed_at: a.confirmed_at,
      checked_in_at: a.checked_in_at,
      ready_at: a.ready_at,
      opened_at: a.opened_at,
      closed_at: a.closed_at,
      left_at: a.left_at,
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

  const markSeen = async (applicationId: string, undo: boolean) => {
    setBusy(applicationId)
    setErr(null)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) { setErr('ログインしなおしてからお試しください。'); setBusy(null); return }
    try {
      const res = await fetch('/api/onsite', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId, step: 'seen', undo }),
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

  const waiting = rows.filter(r => !r.checkin_seen_at && r.checked_in_at).length
  const d = new Date()

  return (
    <section aria-label='本日の受付状況' style={{ background: '#fff', borderRadius: '12px', border: '1px solid ' + (waiting > 0 ? '#F5A623' : '#E2E8F0'), marginBottom: '20px', overflow: 'hidden' }}>
      {/* 受付完了がまだの行を光らせる。動きを抑える設定の端末では色だけで示す */}
      <style>{`
        @keyframes ccn-blink { 0%,100% { background:#FFF8E1 } 50% { background:#FDE9BF } }
        .ccn-unseen { animation: ccn-blink 1.2s ease-in-out infinite }
        @media (prefers-reduced-motion: reduce) { .ccn-unseen { animation: none; background:#FFF8E1 } }
      `}</style>

      <div style={{ padding: '14px 18px', borderBottom: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '14px' }}>本日の受付状況</span>
        <span style={{ fontSize: '12px', color: '#64748B' }}>{d.getMonth() + 1}月{d.getDate()}日</span>
        {waiting > 0 && (
          <span className='ccn-unseen' style={{ fontSize: '11px', fontWeight: 800, color: '#B45309', border: '1px solid #F5A623', borderRadius: '20px', padding: '3px 10px' }}>
            進行中 {waiting}件
          </span>
        )}
        <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>
          <span style={{ color: '#1D4ED8', fontWeight: 700 }}>青</span>＝済み／
          <span style={{ color: '#DC2626', fontWeight: 700 }}>赤</span>＝まだ
        </span>
      </div>

      {err && <div role='alert' style={{ padding: '12px 18px', fontSize: '12px', color: '#DC2626' }}>{err}</div>}

      {rows.length === 0 ? (
        <div style={{ padding: '20px 18px', color: '#999', fontSize: '13px' }}>本日の出店はありません。</div>
      ) : (
        <div className='admin-table-wrap' style={{ overflowX: 'auto' }}>
          {/* 10列あるのでスマホでは横に送って見ることになる。admin-table-wrap を付けると
              1列目の店舗名が固定されて画面に残るため、右端の「受付完了」まで送っても
              誰の受付をしているのか分からなくなることがない */}
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '900px' }}>
            <thead>
              <tr>
                <th style={{ ...head, textAlign: 'left' }}>店舗</th>
                <th style={{ ...head, textAlign: 'left' }}>案件</th>
                {STEPS.map(s => <th key={String(s.key)} style={head}>{s.label}</th>)}
                <th style={head}>売上報告</th>
                <th style={head}>受付完了</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => {
                const seen = !!r.checkin_seen_at
                const ready = REQUIRED.every(k => !!r[k])
                // 搬入が押されていて、まだ受付完了していない行を光らせる
                const live = !seen && !!r.checked_in_at
                const yesterday = r.applyDate === dayStr(-1)
                return (
                  <tr key={r.id} className={live ? 'ccn-unseen' : undefined}>
                    {/* 折り返さない指定は admin-table-wrap 側が持っている。ここで重ねて書くと
                        スマホで1列目を固定したときの折り返しが効かず、店舗名がはみ出すため書かない */}
                    <td style={{ ...cell, fontWeight: 700 }}>
                      {r.shopName}
                      {yesterday && <span style={{ marginLeft: '6px', fontSize: '10px', color: '#94A3B8', fontWeight: 400 }}>前日分</span>}
                    </td>
                    {/* 案件名だけは長くなるので折り返して見せる。ただし下限の幅を決めておかないと
                        他の列に幅を取られて1行1文字まで潰れてしまうため 140px を確保する */}
                    <td style={{ ...cell, color: '#64748B', whiteSpace: 'normal', minWidth: '140px' }}>{r.placeTitle}</td>
                    {STEPS.map(s => (
                      <td key={String(s.key)} style={{ ...cell, textAlign: 'center' }}>
                        <Mark at={r[s.key] as string | null} />
                      </td>
                    ))}
                    <td style={{ ...cell, textAlign: 'center' }}>
                      {r.reported
                        ? <span style={{ color: '#1D4ED8', fontWeight: 700 }}>✓</span>
                        : <span style={{ color: '#DC2626', fontWeight: 700 }}>—</span>}
                    </td>
                    <td style={{ ...cell, textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {seen ? (
                        <button type='button' onClick={() => markSeen(r.id, true)} disabled={busy === r.id}
                          title='押し直すと取り消せます'
                          style={{ fontSize: '11px', fontWeight: 700, padding: '5px 12px', borderRadius: '8px', border: '1px solid #BBF7D0', background: '#ECFDF5', color: '#15803D', cursor: busy === r.id ? 'wait' : 'pointer', minHeight: '30px' }}>
                          ✓ {timeOf(r.checkin_seen_at)}
                        </button>
                      ) : (
                        <button type='button' onClick={() => markSeen(r.id, false)} disabled={busy === r.id || !ready}
                          title={ready ? 'この出店の受付を完了します。出店者の画面にも出ます' : '搬入から撤収まで、すべて済むと押せます'}
                          style={{ fontSize: '11px', fontWeight: 800, padding: '5px 12px', borderRadius: '8px', border: '1px solid ' + (ready ? '#F5A623' : '#E2E8F0'), background: ready ? '#FFF8E1' : '#F8FAFC', color: ready ? '#B45309' : '#CBD5E1', cursor: busy === r.id ? 'wait' : ready ? 'pointer' : 'not-allowed', minHeight: '30px' }}>
                          {busy === r.id ? '…' : '受付完了'}
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
