'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Place = {
  id: string
  title: string
  description: string | null
  prefecture: string | null
  address: string | null
  place_type: string | null
  fee: string | null
  map_url: string | null
  recruit: string | null
  schedule: { date: string, start: string, end: string }[] | null
  image_url: string | null
}

export default function PlaceDetail() {
  const params = useParams()
  const id = params?.id as string
  const [place, setPlace] = useState<Place | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('places').select('*').eq('id', id).single()
      setPlace(data)
      setLoading(false)
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
                    { label: '出店料', value: place.fee || '要相談' },
                    { label: '出店形態', value: tag },
                  ].map((row, i) => (
                    <tr key={row.label} style={{ borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ padding: '14px 20px', background: '#FFFBEB', fontWeight: '700', fontSize: '13px', color: '#B45309', width: '160px', whiteSpace: 'nowrap' }}>{row.label}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#1a1a1a' }}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

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
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', lineHeight: 1.7 }}>
                  会員登録すると全ての情報を確認できます！
                </div>
                <Link href="/login" style={{ display: 'block', background: '#3A9BD5', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', marginBottom: '10px' }}>
                  詳細を確認・エントリーする
                </Link>
                <Link href="/register" style={{ display: 'block', border: '2px solid #F5A623', color: '#E08A00', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', textDecoration: 'none' }}>
                  新規会員登録はこちら(無料)
                </Link>
              </div>
            </div>

            <div style={{ background: '#FFF9E6', borderRadius: '12px', border: '1px solid #FFE0A0', padding: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '900', marginBottom: '10px', color: '#B45309' }}>📋 基本情報</h4>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 2 }}>
                {place.prefecture && <div>📍 {place.prefecture}</div>}
                <div>💴 {place.fee || '要相談'}</div>
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
  )
}
