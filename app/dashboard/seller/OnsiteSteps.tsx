'use client'

import { useCallback, useEffect, useState } from 'react'

// 当日の流れを、マイページの中で進められるようにする。
//
// これまでは公式LINEで、運営が前日に確認の連絡を入れ、当日は搬入の案内を送り、
// 出店者から「着きました」「準備できました」を受け取っていた。
// 同じことをここで押してもらう。運営には管理画面の「本日の受付状況」で伝わる。
//
// 段階は実際の運用に合わせて5つ（＋前日確認）。
//   前日確認 → 車両の搬入 → 営業準備中 → 営業開始 → 営業終了 → 撤収
// 運営は全部そろってから「受付完了」を押す。押されるとこの画面にも出る。
//
// 置き場所は2つ。
//   ・ホーム … 今日と明日の出店だけを出す（applicationId を渡さない）
//   ・カレンダーで日付を押したときの詳細 … その出店だけを出す（applicationId を渡す）

export type OnsiteApp = {
  id: string
  place_id: string
  apply_date: string
  placeTitle: string
  address: string
  openTime: string
  closeTime: string
  loadIn: string
  loadOut: string
  confirmed_at: string | null
  checked_in_at: string | null
  ready_at: string | null
  opened_at: string | null
  closed_at: string | null
  left_at: string | null
  checkin_seen_at: string | null
  reported: boolean
}

type Step = 'confirmed' | 'checked_in' | 'ready' | 'opened' | 'closed' | 'left'

const todayStr = () => {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const tomorrowStr = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}
const timeOf = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0')
}

type Props = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
  /** 売上報告のタブへ移動する */
  onGoSales: () => void
  /** 渡すとその1件だけを出す。渡さなければ今日と明日の出店を出す */
  applicationId?: string
  /** 見出しを出すかどうか。カレンダーの中に置くときは外す */
  heading?: boolean
}

export default function OnsiteSteps({ supabase, onGoSales, applicationId, heading = true }: Props) {
  const [apps, setApps] = useState<OnsiteApp[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    let q = supabase
      .from('applications')
      .select('id, place_id, apply_date, confirmed_at, checked_in_at, ready_at, opened_at, closed_at, left_at, checkin_seen_at, places(title, address, open_time, close_time, details)')
      .eq('seller_id', uid).eq('status', 'approved')
    q = applicationId
      ? q.eq('id', applicationId)
      : q.gte('apply_date', todayStr()).lte('apply_date', tomorrowStr())
    const { data, error } = await q.order('apply_date', { ascending: true })
    if (error) { setErr('当日の予定を読み込めませんでした：' + error.message); return }
    setErr(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = (data ?? []) as any[]
    if (rows.length === 0) { setApps([]); return }

    // 報告済みかどうかは sales の有無で見る（売上報告の段階を済みにするため）
    const { data: sales } = await supabase
      .from('sales').select('application_id').in('application_id', rows.map(r => r.id))
    const reported = new Set((sales ?? []).map((s: { application_id: string }) => s.application_id))

    setApps(rows.map(a => ({
      id: a.id,
      place_id: a.place_id,
      apply_date: a.apply_date,
      placeTitle: a.places?.title || '(案件名なし)',
      address: a.places?.address || '',
      openTime: a.places?.open_time || '',
      closeTime: a.places?.close_time || '',
      loadIn: a.places?.details?.loadIn || '',
      loadOut: a.places?.details?.loadOut || '',
      confirmed_at: a.confirmed_at,
      checked_in_at: a.checked_in_at,
      ready_at: a.ready_at,
      opened_at: a.opened_at,
      closed_at: a.closed_at,
      left_at: a.left_at,
      checkin_seen_at: a.checkin_seen_at,
      reported: reported.has(a.id),
    })))
  }, [supabase, applicationId])

  useEffect(() => { load() }, [load])

  const press = async (id: string, step: Step, undo: boolean) => {
    setBusy(id + step)
    setErr(null)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) { setErr('ログインしなおしてからお試しください。'); setBusy(null); return }
    try {
      const res = await fetch('/api/onsite', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId: id, step, undo }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json?.error || '記録できませんでした。'); return }
      await load()
    } catch {
      setErr('通信に失敗しました。電波の良いところでもう一度お試しください。')
    } finally {
      setBusy(null)
    }
  }

  if (apps.length === 0 && !err) return null

  const today = todayStr()

  return (
    <section aria-label='当日の流れ' style={{ marginBottom: heading ? '20px' : 0 }}>
      {heading && <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px' }}>当日の流れ</h2>}

      {err && (
        <div role='alert' style={{ fontSize: '12px', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '9px 12px', marginBottom: '10px' }}>{err}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {apps.map(a => {
          const isToday = a.apply_date === today
          // 当日にならないと押せない。前日確認だけは前日から押せる。
          // 順番どおりに押してもらう（前が済んでいないと次が開かない）ので、
          // 押し忘れたまま先に進むことがない
          const steps: { key: Step; label: string; at: string | null; can: boolean }[] = [
            { key: 'confirmed', label: '前日確認', at: a.confirmed_at, can: true },
            { key: 'checked_in', label: '車両の搬入', at: a.checked_in_at, can: isToday },
            { key: 'ready', label: '営業準備中', at: a.ready_at, can: isToday && !!a.checked_in_at },
            { key: 'opened', label: '営業開始', at: a.opened_at, can: isToday && !!a.ready_at },
            { key: 'closed', label: '営業終了', at: a.closed_at, can: isToday && !!a.opened_at },
            { key: 'left', label: '撤収', at: a.left_at, can: isToday && !!a.closed_at },
          ]
          const doneCount = steps.filter(s => s.at).length
          return (
            <div key={a.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid ' + (isToday ? '#F5A623' : '#E2E8F0'), padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                {!applicationId && (
                  <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 9px', borderRadius: '20px', background: isToday ? '#FFF8E1' : '#F1F5F9', color: isToday ? '#B45309' : '#64748B' }}>
                    {isToday ? '本日' : '明日'}
                  </span>
                )}
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{a.placeTitle}</span>
                <span style={{ fontSize: '11px', color: '#94A3B8', marginLeft: 'auto' }}>{doneCount} / 6</span>
              </div>

              <div style={{ fontSize: '12px', color: '#64748B', lineHeight: 1.8, marginBottom: '12px' }}>
                {a.address && <div>{a.address}</div>}
                {(a.loadIn || a.loadOut) && <div>搬入 {a.loadIn || '—'}／搬出 {a.loadOut || '—'}</div>}
                {(a.openTime || a.closeTime) && <div>営業 {[a.openTime, a.closeTime].filter(Boolean).join(' 〜 ')}</div>}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {steps.map(s => {
                  const done = !!s.at
                  const working = busy === a.id + s.key
                  return (
                    <button
                      key={s.key} type='button'
                      onClick={() => press(a.id, s.key, done)}
                      disabled={!s.can || working}
                      title={done ? '押し直すと取り消せます' : s.can ? '' : '前の工程を済ませると押せます'}
                      style={{
                        fontSize: '12px', fontWeight: 700, padding: '9px 16px', borderRadius: '999px', minHeight: '38px',
                        border: '1.5px solid ' + (done ? '#16A34A' : s.can ? '#F5A623' : '#E2E8F0'),
                        background: done ? '#ECFDF5' : s.can ? '#FFF8E1' : '#F8FAFC',
                        color: done ? '#15803D' : s.can ? '#B45309' : '#94A3B8',
                        cursor: !s.can || working ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {working ? '記録中…' : done ? `✓ ${s.label}　${timeOf(s.at)}` : s.label}
                    </button>
                  )
                })}

                {/* 売上報告は既にある仕組みへ送る。同じ並びに置いて流れを切らさない */}
                <button
                  type='button' onClick={onGoSales} disabled={!a.closed_at && !a.reported}
                  title={a.reported ? '報告済みです' : a.closed_at ? '' : '営業終了のあとに報告できます'}
                  style={{
                    fontSize: '12px', fontWeight: 700, padding: '9px 16px', borderRadius: '999px', minHeight: '38px',
                    border: '1.5px solid ' + (a.reported ? '#16A34A' : a.closed_at ? '#F5A623' : '#E2E8F0'),
                    background: a.reported ? '#ECFDF5' : a.closed_at ? '#FFF8E1' : '#F8FAFC',
                    color: a.reported ? '#15803D' : a.closed_at ? '#B45309' : '#94A3B8',
                    cursor: !a.closed_at && !a.reported ? 'not-allowed' : 'pointer',
                  }}
                >
                  {a.reported ? '✓ 売上報告' : '売上報告'}
                </button>
              </div>

              {/* 運営が受付を完了したら、その旨をここに出す */}
              {a.checkin_seen_at ? (
                <div style={{ marginTop: '11px', fontSize: '12px', fontWeight: 700, color: '#15803D', background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '8px 12px' }}>
                  ✓ 運営が受付を完了しました（{timeOf(a.checkin_seen_at)}）
                </div>
              ) : isToday && !a.checked_in_at ? (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px' }}>
                  現場に着いたら「車両の搬入」から順に押してください。運営に届きます。
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </section>
  )
}
