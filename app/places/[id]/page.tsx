'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import SiteHeader from '../../components/SiteHeader'
import BackButton from '../../components/BackButton'
import SiteFooter from '../../components/SiteFooter'
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
  open_days: string[] | null
  image_url: string | null
  images: string[] | null
  latitude: number | null
  longitude: number | null
  open_time: string | null
  close_time: string | null
  max_slots: number | null
  details: Record<string, string> | null
}

// 案件フォームで選んだ値を、画面に出す日本語に直す
const CHOICE: Record<string, Record<string, string>> = {
  power: { yes: '有り', no: '無し' },
  gas: { yes: '有り', no: '無し' },
  water: { yes: '有り', no: '無し' },
  eatSpace: { yes: '有り', no: '無し' },
  trash: { self: '各自', host: '主催者処理' },
  location: { outdoor: '屋外', outdoor_roof: '屋外（屋根あり）', indoor: '屋内' },
  heightLimit: { no: '制限なし', yes: '制限あり' },
  rain: { go: '雨天決行', cancel: '中止', other: 'その他' },
  history: { yes: '有り', no: '無し' },
  parking: { yes: '可', no: '不可' },
  format: { kitchen: 'キッチンカー', tent: 'テント', both: 'キッチンカー・テント' },
}

function detailText(key: string, raw: string | undefined): string {
  const v = (raw ?? '').trim()
  if (!v) return ''
  return CHOICE[key]?.[v] ?? v
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
  // 料金はログイン済みなら表示する（エントリー可否の判定とは別）
  const [canSeeFee, setCanSeeFee] = useState(false)
  // いま大きく出している写真の番号
  const [photoIndex, setPhotoIndex] = useState(0)
  const router = useRouter()
  const [showEntry, setShowEntry] = useState(false)
  const [format, setFormat] = useState('')
  const [selectedDates, setSelectedDates] = useState<string[]>([])
  const [entryDate, setEntryDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [entryErr, setEntryErr] = useState('')
  const [entryDone, setEntryDone] = useState(false)
  // この案件に自分がすでに申し込んでいるか。申込済みなのに
  // 「エントリーする」と出ていると、済んでいないように見えてしまう。
  type MyEntry = { id: string, apply_date: string | null, status: string }
  const [myEntries, setMyEntries] = useState<MyEntry[]>([])
  const [cancelingId, setCancelingId] = useState<string | null>(null)

  const loadMyEntries = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || !id) { setMyEntries([]); return }
    const { data } = await supabase
      .from('applications')
      .select('id, apply_date, status')
      .eq('place_id', id).eq('seller_id', user.id)
      .order('apply_date', { ascending: true })
    setMyEntries((data || []) as MyEntry[])
  }

  // 申込のキャンセル（出店者ダッシュボードと同じAPIを使う）
  const cancelEntry = async (appId: string, status: string) => {
    const ok = window.confirm(
      status === 'approved'
        ? 'この承認済みの申込をキャンセルしますか？募集者にも通知されます。この操作は取り消せません。'
        : 'この申込をキャンセルしますか？この操作は取り消せません。'
    )
    if (!ok) return
    setCancelingId(appId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      if (!token) { alert('ログインが必要です。再度ログインしてください。'); return }
      const res = await fetch('/api/applications/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ applicationId: appId }),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) { alert('キャンセルに失敗しました: ' + (j.error || res.status)); return }
      await loadMyEntries()
    } finally {
      setCancelingId(null)
    }
  }

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

  // 今日（YYYY-MM-DD）。自由入力日程の下限・過去日付チェックに使う
  const todayStr = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0') }

  const submitEntry = async () => {
    setEntryErr('')
    if (!format) { setEntryErr('出店形式を選択してください'); return }
    // 開催日がある案件は最低1日選択を必須に
    const hasSchedule = !!(place && place.schedule && place.schedule.filter(d => d.date).length > 0)
    const dates = hasSchedule ? selectedDates : (entryDate ? [entryDate] : [])
    if (hasSchedule && dates.length === 0) { setEntryErr('出店希望日を1日以上選択してください'); return }
    // 日程未設定の案件（自由入力）は、日付必須＋過去日付を禁止して誤エントリーを防ぐ
    if (!hasSchedule) {
      if (!entryDate) { setEntryErr('出店希望日を選択してください'); return }
      if (entryDate < todayStr()) { setEntryErr('過去の日付は選択できません'); return }
    }
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
    await loadMyEntries()
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
      if (user) { setCanSeeFee(true); await loadMyEntries() }
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
  // images に入っていない古い案件は、image_url の1枚だけを表示する
  const photos = (Array.isArray(place.images) ? place.images.filter(Boolean) : [])
  if (photos.length === 0 && place.image_url) photos.push(place.image_url)
  const shownPhoto = photos[photoIndex] || photos[0] || ''
  // 構造化された日程が無い案件は、旧サイトから移行した日程テキストを表示する
  const scheduleText = place.schedule && place.schedule.filter(d => d.date).length > 0
    ? place.schedule.filter(d => d.date).map(d => d.date + ' ' + d.start + '〜' + d.end).join(' / ')
    : ((place.open_days || []).map(x => (x || '').trim()).filter(Boolean)[0] || '要相談')

  return (
    <>
    <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/places' />
      </div>
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

            {/* 写真は複数枚登録できる。サムネイルを押すと大きい写真が入れ替わる。 */}
            <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
              <div style={{ height: '260px', background: shownPhoto ? `url(${shownPhoto}) center/cover no-repeat` : 'linear-gradient(135deg,#FFF3CD,#FFE082)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px' }}>
                {!shownPhoto && (place.place_type === 'event' ? '🎪' : '🏪')}
              </div>
              {photos.length > 1 && (
                <div style={{ display: 'flex', gap: '8px', padding: '10px', flexWrap: 'wrap', borderTop: '1px solid #F1F5F9' }}>
                  {photos.map((url, i) => (
                    <button key={url + i} type='button' onClick={() => setPhotoIndex(i)}
                      style={{ padding: 0, border: i === photoIndex ? '2px solid #F5A623' : '2px solid transparent', borderRadius: '8px', background: `url(${url}) center/cover no-repeat`, width: '72px', height: '54px', cursor: 'pointer' }}
                      aria-label={'写真' + (i + 1) + 'を表示'} />
                  ))}
                </div>
              )}
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
                    { label: '出店料', value: canSeeFee ? feeText(place) : '🔒 ログイン後に表示' },
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

            {(() => {
              const d = place.details || {}
              const val = (k: string) => detailText(k, d[k])
              // 高さ制限・雨天時の対応は補足を添えて1項目にまとめる
              const height = val('heightLimit') + (d.heightValue ? '（' + d.heightValue + '）' : '')
              const rain = val('rain') + (d.rainNote ? '（' + d.rainNote + '）' : '')
              const time = place.open_time || place.close_time
                ? [place.open_time, place.close_time].filter(Boolean).join(' 〜 ') : ''
              const rows: { label: string, value: string }[] = [
                { label: '開催時間', value: time },
                { label: '搬入時間', value: d.loadIn || '' },
                { label: '搬出時間', value: d.loadOut || '' },
                { label: '応募締切', value: d.deadline ? d.deadline.replaceAll('-', '/') : '' },
                { label: '想定来場者数', value: d.visitors || '' },
                { label: '募集台数', value: place.max_slots != null ? place.max_slots + '台' : '' },
                { label: '屋内 / 屋外', value: val('location') },
                { label: '電源', value: val('power') },
                { label: 'ガス機器', value: val('gas') },
                { label: '水道設備', value: val('water') },
                { label: '飲食スペース', value: val('eatSpace') },
                { label: 'ゴミの処理', value: val('trash') },
                { label: '高さ制限', value: height },
                { label: '雨天時の対応', value: rain },
                { label: '車両の留め置き', value: val('parking') },
                { label: '過去の開催実績', value: val('history') },
                { label: '希望メニュー', value: d.menuWant || '' },
                { label: 'NGメニュー', value: d.menuNG || '' },
                { label: '他の出店予定メニュー', value: d.menuOther || '' },
                { label: '販売禁止・ブランド制限', value: d.brand || '' },
              ].filter(r => r.value)
              if (rows.length === 0) return null
              return (
                <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '15px', fontWeight: '900', padding: '16px 20px 0', color: '#1a1a1a' }}>出店条件</h3>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
                    <tbody>
                      {rows.map((row, i) => (
                        <tr key={row.label} style={{ borderBottom: i < rows.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                          <td style={{ padding: '12px 20px', background: '#FFFBEB', fontWeight: '700', fontSize: '13px', color: '#B45309', width: '160px', verticalAlign: 'top' }}>{row.label}</td>
                          <td style={{ padding: '12px 20px', fontSize: '14px', color: '#1a1a1a', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{row.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            })()}

            {place.details?.notes && (
              <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px', marginBottom: '20px' }}>
                <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px', color: '#1a1a1a' }}>備考・ご案内</h3>
                <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{place.details.notes}</p>
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
                ) : (!showEntry && myEntries.length > 0) ? (
                  /* すでに申し込んでいる場合は、その状態を出す。
                     「エントリーする」だけだと未申込に見えてしまうため。 */
                  <>
                    <div style={{ background: '#ECFDF5', border: '1px solid #BBF7D0', borderRadius: '8px', padding: '12px 14px', marginBottom: '14px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 900, color: '#16A34A', marginBottom: '8px' }}>この案件はエントリー済みです</div>
                      <div style={{ display: 'grid', gap: '8px' }}>
                        {myEntries.map(e => {
                          const st = e.status === 'approved'
                            ? { label: '承認済', color: '#16A34A' }
                            : e.status === 'rejected'
                              ? { label: '否認', color: '#DC2626' }
                              : { label: '審査中', color: '#B45309' }
                          return (
                            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', background: '#fff', borderRadius: '6px', padding: '8px 10px' }}>
                              <span style={{ color: st.color, border: `1px solid ${st.color}`, borderRadius: '4px', padding: '1px 8px', fontSize: '11px', fontWeight: 700 }}>{st.label}</span>
                              <span style={{ fontSize: '13px', color: '#1a1a1a', fontWeight: 700 }}>
                                {e.apply_date ? e.apply_date.replace(/-/g, '/') : '日程調整中'}
                              </span>
                              {e.status !== 'rejected' && (
                                <button onClick={() => cancelEntry(e.id, e.status)} disabled={cancelingId === e.id}
                                  style={{ marginLeft: 'auto', background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA', borderRadius: '6px', padding: '5px 12px', fontSize: '11px', fontWeight: 700, cursor: cancelingId === e.id ? 'not-allowed' : 'pointer' }}>
                                  {cancelingId === e.id ? '取消中...' : 'キャンセル'}
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    <Link href="/dashboard/seller" style={{ display: 'block', background: '#F5A623', color: '#fff', textAlign: 'center', padding: '13px', borderRadius: '8px', fontWeight: '900', fontSize: '14px', textDecoration: 'none', marginBottom: '10px' }}>マイページで確認する</Link>
                    <button onClick={handleEntryClick} style={{ width: '100%', display: 'block', background: '#fff', color: '#3A9BD5', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', border: '1.5px solid #BFDBFE', cursor: 'pointer' }}>
                      別の日程を追加でエントリーする
                    </button>
                  </>
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
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', color: '#888', marginBottom: '6px' }}>この案件は出店日が未設定です。ご希望の日付を入力してください（過去の日付は選べません）。</div>
                        <input type="date" value={entryDate} min={todayStr()} onChange={e => setEntryDate(e.target.value)} style={{ width: '100%', border: '1px solid #E5C07B', borderRadius: '8px', padding: '10px 14px', fontSize: '14px', boxSizing: 'border-box', color: '#1a1a1a', background: '#fff' }} />
                      </div>
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
                <div>💴 {canSeeFee ? feeText(place) : '🔒 ログイン後に表示'}</div>
                <div>🚚 {tag}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <SiteFooter />
    </div>
    </>
  )
}
