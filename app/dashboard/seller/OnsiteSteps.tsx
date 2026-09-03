'use client'

import { useCallback, useEffect, useState } from 'react'

// 当日の流れを、マイページの中で進められるようにする。
//
// これまでは公式LINEで、運営が前日に確認の連絡を入れ、当日は搬入の案内を送り、
// 出店者から「着きました」「準備できました」を受け取っていた。
// 同じことをここで押してもらう。運営には管理画面の「本日の受付状況」で伝わる。
//
// 出すのは今日と明日の出店だけ。先の予定まで並べると、いま何をすればよいかが
// 埋もれてしまう。過去の未報告は、これまでどおり売上報告のお知らせが受け持つ。

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
  reported: boolean
}

type Step = 'confirmed' | 'checked_in' | 'ready'

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
}

export default function OnsiteSteps({ supabase, onGoSales }: Props) {
  const [apps, setApps] = useState<OnsiteApp[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser()
    const uid = userData.user?.id
    if (!uid) return
    const today = todayStr()
    const { data, error } = await supabase
      .from('applications')
      .select('id, place_id, apply_date, confirmed_at, checked_in_at, ready_at, places(title, address, open_time, close_time, details)')
      .eq('seller_id', uid).eq('status', 'approved')
      .gte('apply_date', today).lte('apply_date', tomorrowStr())
      .order('apply_date', { ascending: true })
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
      reported: reported.has(a.id),
    })))
  }, [supabase])

  useEffect(() => { load() }, [load])

  const press = async (applicationId: string, step: Step, undo: boolean) => {
    setBusy(applicationId + step)
    setErr(null)
    const { data: sess } = await supabase.auth.getSession()
    const token = sess.session?.access_token
    if (!token) { setErr('ログインしなおしてからお試しください。'); setBusy(null); return }
    try {
      const res = await fetch('/api/onsite', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId, step, undo }),
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
    <section aria-label='当日の流れ' style={{ marginBottom: '20px' }}>
      <h2 style={{ fontSize: '14px', fontWeight: 800, color: '#1a1a1a', margin: '0 0 10px' }}>当日の流れ</h2>

      {err && (
        <div role='alert' style={{ fontSize: '12px', color: '#DC2626', background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '9px 12px', marginBottom: '10px' }}>{err}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {apps.map(a => {
          const isToday = a.apply_date === today
          const steps: { key: Step; label: string; at: string | null; can: boolean; hint: string }[] = [
            { key: 'confirmed', label: '前日確認', at: a.confirmed_at, can: true, hint: '明日の出店を確認しました' },
            { key: 'checked_in', label: '受付完了', at: a.checked_in_at, can: isToday, hint: '現場で受付を済ませました' },
            { key: 'ready', label: '営業準備完了', at: a.ready_at, can: isToday && !!a.checked_in_at, hint: '準備ができて営業を始められます' },
          ]
          return (
            <div key={a.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid ' + (isToday ? '#F5A623' : '#E2E8F0'), padding: '16px 18px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10px', fontWeight: 800, padding: '3px 9px', borderRadius: '20px', background: isToday ? '#FFF8E1' : '#F1F5F9', color: isToday ? '#B45309' : '#64748B' }}>
                  {isToday ? '本日' : '明日'}
                </span>
                <span style={{ fontSize: '14px', fontWeight: 700 }}>{a.placeTitle}</span>
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
                      title={done ? '押し直すと取り消せます' : s.can ? s.hint : '出店当日に押せます'}
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
                  type='button' onClick={onGoSales} disabled={!isToday && !a.reported}
                  title={a.reported ? '報告済みです' : isToday ? '営業が終わったら報告してください' : '出店当日に報告できます'}
                  style={{
                    fontSize: '12px', fontWeight: 700, padding: '9px 16px', borderRadius: '999px', minHeight: '38px',
                    border: '1.5px solid ' + (a.reported ? '#16A34A' : isToday ? '#F5A623' : '#E2E8F0'),
                    background: a.reported ? '#ECFDF5' : isToday ? '#FFF8E1' : '#F8FAFC',
                    color: a.reported ? '#15803D' : isToday ? '#B45309' : '#94A3B8',
                    cursor: !isToday && !a.reported ? 'not-allowed' : 'pointer',
                  }}
                >
                  {a.reported ? '✓ 売上報告' : '売上報告'}
                </button>
              </div>

              {!a.checked_in_at && a.apply_date === today && (
                <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '10px' }}>
                  受付を済ませたら「受付完了」を押してください。運営に届きます。
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
