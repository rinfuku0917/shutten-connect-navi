'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import Nav from '../../components/Nav'
const PlacesMap = dynamic(() => import('../../components/PlacesMap'), { ssr: false, loading: () => <div style={{height:'320px',background:'#F1F5F9',borderRadius:'12px',display:'flex',alignItems:'center',justifyContent:'center',color:'#94A3B8',fontSize:'13px'}}>地図を読み込み中...</div> })

type Place = {
  id: string
  title: string
  description: string | null
  prefecture: string | null
  address: string | null
  place_type: string | null
  fee: string | null
  price_fixed: number | null
  price_share_pct: number | null
  place_fixed_unit: string | null
  company_fixed_amount: number | null
  company_fixed_unit: string | null
  company_share_pct: number | null
  map_url: string | null
  recruit: string | null
  schedule: { date: string, start: string, end: string }[] | null
  image_url: string | null
  latitude: number | null
  longitude: number | null
}

function feeText(p: Place): string {
  const fixed = (p.price_fixed || 0) + (p.company_fixed_amount || 0)
  const pct = (p.price_share_pct || 0) + (p.company_share_pct || 0)
  if (fixed === 0 && pct === 0) return p.fee || '要相談'
  const unit = p.place_fixed_unit === 'per_event' ? '期間' : '日'
  const parts: string[] = []
  if (fixed > 0) parts.push(fixed.toLocaleString() + '円/' + unit)
  if (pct > 0) parts.push('売上の' + pct + '%')
  return parts.join(' ＋ ')
}

export default function PlaceDetail() {
  const params = useParams()
  const id = params?.id as string
  const [place, setPlace] = useState<Place | null>(null)
  const [loading, setLoading] = useState(true)
  const [isSeller, setIsSeller] = useState(false)
  const router = useRouter()
  const [showEntry, setShowEntry] = useState(false)
  const [format, setFormat] = useState('')
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [entryDate, setEntryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [entryErr, setEntryErr] = useState('')
  const [entryDone, setEntryDone] = useState(false)

  const handleEntryClick = async () => {
    setEntryErr('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (profile?.role !== 'seller') { router.push('/login'); return }
    setShowEntry(true)
  }

  const toggleDate = (d: string) => {
    setSelectedDates(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const submitEntry = async () => {
    setEntryErr('')
    if (!format) { setEntryErr('出店形式を選択してください'); return }
    // 開催日がある案件は最低1日選択を必須に
    const hasSchedule = !!(place && place.schedule && place.schedule.filter(d => d.date).length > 0)
    const dates = hasSchedule ? selectedDates : (entryDate ? [entryDate] : [])
    if (hasSchedule && dates.length === 0) { setEntryErr('出店希望日を1日以上選択してください'); return }
    setSubmitting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setEntryErr('ログインが必要です'); setSubmitting(false); return }
    // 選んだ日ごとに1行ずつ申込を作成（日付が無い案件は1件だけ作成）
    const rows: { place_id: string; seller_id: string; format: string; apply_date: string | null; status: string }[] =
      dates.length > 0
        ? dates.map(d => ({ place_id: id, seller_id: user.id, format, apply_date: d, status: 'pending' }))
        : [{ place_id: id, seller_id: user.id, format, apply_date: null, status: 'pending' }]
    const { error } = await supabase.from('applications').insert(rows)
    if (error) { const msg = error.message.includes('duplicate key') ? 'この案件には既に申込済みの日があります。' : 'エントリー失敗: ' + error.message; setEntryErr(msg); setSubmitting(false); return }
    setSubmitting(false)
    setEntryDone(true)
    // ホストへ申込通知（失敗しても応募は成功させる）
    try {
      await fetch('/api/notify/new-application', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId: id, sellerId: user.id, dates }),
      })
    } catch (e) {
      console.error('申込通知に失敗しましたが応募は完了しました', e)
    }
  }

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('places').select('*').eq('id', id).single()
      setPlace(data)
      setLoading(false)
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (prof?.role === 'seller') setIsSeller(true)
      }
    }
    if (id) load()
  }, [id])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFF9E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#999' }}>読み込み中...</div>
      </div>
    )
  }

  if (!place) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFF9E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😢</div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>案件が見つかりません</div>
          <Link href="/" style={{ color: '#3A9BD5', textDecoration: 'none' }}>トップに戻る</Link>
        </div>
      </div>
    )
  }

  const tag = place.place_type === 'event' ? 'イベント' : '常設'
  const scheduleText = place.schedule && place.schedule.length > 0
    ? place.schedule.filter(d => d.date).map(d => d.date + ' ' + d.start + '〜' + d.end).join(' / ')
    : '要相談'

  return (
    <>
    <Nav />
    <div style={{ minHeight: '100vh', background: '#FFF9E6' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <Link href="/places" style={{ color: '#3A9BD5', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
          ← 一覧に戻る
        </Link>

        <div className='detail-2col' style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px', alignItems: 'start' }}>
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span style={{ background: '#F5A623', color: '#fff', fontSize: '12px', fontWeight: '700', padding: '3px 12px', borderRadius: '999px' }}>{tag}</span>
              {place.prefecture && <span style={{ background: '#EBF6FD', color: '#1D4ED8', fontSize: '12px', fontWeight: '700', padding: '3px 12px', borderRadius: '999px' }}>📍{place.prefecture}</span>}
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1a1a1a', marginBottom: '20px', lineHeight: 1.4 }}>{place.title}</h1>

            <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
              <div style={{ height: '260px', background: place.image_url ? `url(${place.image_url}) center/cover no-repeat` : 'linear-gradient(135deg,#FFF3CD,#FFE082)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px' }}>
                {!place.image_url && (place.place_type === 'event' ? '🎪' : '🏪')}
              </div>
            </div>

            {place.description && (
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px', color: '#1a1a1a' }}>概要</h3>
                <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{place.description}</p>
              </div>
            )}

            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    { label: '日程', value: scheduleText },
                    { label: 'アクセス', value: place.address || '要相談' },
                    { label: '出店料', value: isSeller ? feeText(place) : '🔒 出店者ログイン後に表示' },
                    { label: '出店形態', value: tag },
                  ].map((row, i) => (
                    <tr key={row.label} style={{ borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ padding: '14px 20px', background: '#FFFBEB', fontWeight: '700', fontSize: '13px', color: '#B45309', width: '160px', whiteSpace: 'nowrap' }}>{row.label}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#1a1a1a' }}>{row.label === 'アクセス' && place.address ? (<a href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(place.address)} target='_blank' rel='noopener noreferrer' style={{ color: '#1D4ED8', textDecoration: 'underline', fontWeight: 700 }}>{row.value} 🗺️</a>) : row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {place.latitude != null && place.longitude != null && (
              <div style={{ marginBottom: '20px' }}>
                <PlacesMap pins={[{ id: place.id, title: place.title, prefecture: place.prefecture, fee: place.fee, latitude: place.latitude, longitude: place.longitude }]} />
              </div>
            )}

            {place.recruit && (
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px', color: '#1a1a1a' }}>募集内容</h3>
                <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{place.recruit}</p>
              </div>
            )}
          </div>

          <div style={{ position: 'sticky', top: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ background: '#F5A623', padding: '14px 20px' }}>
                <div style={{ color: '#fff', fontWeight: '900', fontSize: '15px' }}>この案件に出店する</div>
              </div>
              <div style={{ padding: '20px' }}>
                {entryDone ? (
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '40px', marginBottom: '10px' }}>🎉</div>
                    <div style={{ fontSize: '15px', fontWeight: '900', color: '#16A34A', marginBottom: '8px' }}>エントリーが完了しました</div>
                    <div style={{ fontSize: '13px', color: '#666', marginBottom: '16px', lineHeight: 1.7 }}>申込内容はマイページでご確認いただけます。</div>
                    <Link href="/dashboard/seller" style={{ display: 'block', background: '#F5A623', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', textDecoration: 'none' }}>マイページへ</Link>
                  </div>
                ) : !showEntry ? (
                  <>
                    <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', lineHeight: 1.7 }}>
                      出店者ログイン後、この案件にエントリーできます。
                    </div>
                    <button onClick={handleEntryClick} style={{ width: '100%', display: 'block', background: '#3A9BD5', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', border: 'none', cursor: 'pointer', marginBottom: '10px' }}>
                      この案件にエントリーする
                    </button>
                    <Link href="/register" style={{ display: 'block', border: '2px solid #F5A623', color: '#E08A00', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', textDecoration: 'none' }}>
                      新規会員登録はこちら(無料)
                    </Link>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#1a1a1a', marginBottom: '14px' }}>出店形式を選択してください</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
                      {['キッチンカー', 'テント'].map(opt => (
                        <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: format === opt ? '2px solid #F5A623' : '1px solid #E5E7EB', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#1a1a1a', background: format === opt ? '#FFFBEB' : '#fff' }}>
                          <input type="radio" name="format" checked={format === opt} onChange={() => setFormat(opt)} style={{ accentColor: '#F5A623' }} />
                          {opt}
                        </label>
                      ))}
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '900', color: '#1a1a1a', marginBottom: '8px' }}>出店希望日</div>
                    {place.schedule && place.schedule.filter(d => d.date).length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#888' }}>出店したい日にチェックを入れてください（複数選択可）</div>
                        {place.schedule.filter(d => d.date).map(d => (
                          <label key={d.date} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', border: selectedDates.includes(d.date) ? '2px solid #F5A623' : '1px solid #E5E7EB', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#1a1a1a', background: selectedDates.includes(d.date) ? '#FFFBEB' : '#fff' }}>
                            <input type="checkbox" checked={selectedDates.includes(d.date)} onChange={() => toggleDate(d.date)} style={{ accentColor: '#F5A623' }} />
                            {d.date}（{d.start}〜{d.end}）
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)} style={{ width: '100%', border: '1px solid #E5C07B', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', marginBottom: '16px', boxSizing: 'border-box', color: '#1a1a1a', background: '#fff' }} />
                    )}
                    {entryErr && <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px', fontSize: '13px', color: '#DC2626', marginBottom: '12px' }}>{entryErr}</div>}
                    <button onClick={submitEntry} disabled={submitting} style={{ width: '100%', background: submitting ? '#ccc' : '#3A9BD5', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', border: 'none', cursor: submitting ? 'not-allowed' : 'pointer', marginBottom: '8px' }}>
                      {submitting ? '送信中...' : 'エントリーする'}
                    </button>
                    <button onClick={() => setShowEntry(false)} style={{ width: '100%', background: 'transparent', color: '#888', textAlign: 'center', padding: '8px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', border: 'none', cursor: 'pointer' }}>
                      キャンセル
                    </button>
                  </>
                )}
              </div>
            </div>

            <div style={{ background: '#FFF9E6', borderRadius: '12px', border: '1px solid #FFE0A0', padding: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '900', marginBottom: '10px', color: '#B45309' }}>📋 基本情報</h4>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 2 }}>
                {place.prefecture && <div>📍 {place.prefecture}</div>}
                <div>💴 {isSeller ? feeText(place) : '🔒 ログイン後に表示'}</div>
                <div>🚚 {tag}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ background: '#1E2A3B', color: '#fff', padding: '24px', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ fontWeight: '900', fontSize: '16px', marginBottom: '8px' }}>出店コネクトナビ</div>
        <div style={{ fontSize: '12px', color: '#666' }}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
    </>
  )
}
