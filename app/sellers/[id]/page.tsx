'use client'
import Link from 'next/link'
import Nav from '../../components/Nav'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'

type Seller = { id: string, name: string | null, shop_name: string | null, genre: string | null, areas: string[] | null, photos: string[] | null }
type Review = { id: string, reviewer_name: string | null, rating: number, comment: string | null, created_at: string }

const genreEmoji = (genre: string | null): string => {
  const g = genre || ''
  if (g.includes('スイーツ') || g.includes('菓子') || g.includes('デザート')) return '🍰'
  if (g.includes('ドリンク') || g.includes('カフェ') || g.includes('コーヒー')) return '☕'
  if (g.includes('クレープ') || g.includes('軽食')) return '🥞'
  if (g.includes('弁当') || g.includes('ランチ') || g.includes('まぜそば') || g.includes('麺') || g.includes('そば')) return '🍱'
  if (g.includes('パン')) return '🥐'
  return '🏪'
}

const Stars = ({ n }: { n: number }) => (
  <span style={{ color: '#F5A623', letterSpacing: '2px' }}>{'★'.repeat(Math.round(n))}<span style={{ color: '#ddd' }}>{'★'.repeat(5 - Math.round(n))}</span></span>
)

export default function SellerDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [seller, setSeller] = useState<Seller | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [rname, setRname] = useState('')
  const [rrating, setRrating] = useState(0)
  const [rcomment, setRcomment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')

  const loadReviews = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('id, reviewer_name, rating, comment, created_at')
      .eq('seller_id', id).eq('status', 'approved')
      .order('created_at', { ascending: false })
    setReviews((data || []) as Review[])
  }

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data: s } = await supabase
        .from('profiles')
        .select('id, name, shop_name, genre, areas, photos')
        .eq('id', id).single()
      setSeller(s as Seller)
      await loadReviews()
      setLoading(false)
    }
    load()
  }, [id])

  const avg = reviews.length > 0 ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : 0

  const submitReview = async () => {
    if (!rcomment.trim()) { setErr('レビュー本文を入力してください'); return }
    setSubmitting(true); setErr('')
    const { error } = await supabase.from('reviews').insert({
      seller_id: id,
      reviewer_name: rname.trim() || null,
      rating: rrating,
      comment: rcomment.trim(),
      status: 'pending',
    })
    if (error) { setErr('送信に失敗しました: ' + error.message); setSubmitting(false); return }
    setSubmitting(false); setDone(true)
    setRname(''); setRrating(0); setRcomment('')
  }

  if (loading) return (<div style={{background:'#FFF8F0',minHeight:'100vh'}}><Nav /><div style={{textAlign:'center',padding:'80px 20px',color:'#999'}}>読み込み中...</div></div>)
  if (!seller) return (<div style={{background:'#FFF8F0',minHeight:'100vh'}}><Nav /><div style={{textAlign:'center',padding:'80px 20px',color:'#999'}}>出店者が見つかりませんでした。<br/><Link href='/sellers' style={{color:'#F5A623',fontWeight:700}}>一覧に戻る</Link></div></div>)

  const labelStyle = { fontSize: '11px', color: '#64748B', marginBottom: '6px' }
  const inputStyle = { width: '100%', border: '1.5px solid #E2E8F0', borderRadius: '8px', padding: '10px 12px', fontSize: '14px', color: '#1a1a1a', boxSizing: 'border-box' as const }

  return (
    <div style={{ background: '#FFF8F0', minHeight: '100vh' }}>
      <Nav />
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '24px 16px' }}>
        <Link href='/sellers' style={{ fontSize: '13px', color: '#64748B', textDecoration: 'none' }}>← 出店者一覧に戻る</Link>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', padding: '24px', marginTop: '12px', display: 'flex', gap: '20px', alignItems: 'center' }}>
          <div style={{ fontSize: '56px', flexShrink: 0 }}>{genreEmoji(seller.genre)}</div>
          <div style={{ flex: 1 }}>
            <h1 style={{ fontSize: '22px', fontWeight: '900', color: '#1a1a1a', marginBottom: '6px' }}>{seller.shop_name || seller.name || '(店舗名未設定)'}</h1>
            <div style={{ fontSize: '13px', color: '#555', marginBottom: '4px' }}>{seller.genre || 'ジャンル未設定'}</div>
            {seller.areas && seller.areas.length > 0 && <div style={{ fontSize: '13px', color: '#555' }}>📍 {seller.areas.join('・')}</div>}
            <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: '700' }}>{reviews.length > 0 ? <><Stars n={avg} /> <span style={{ color: '#1a1a1a' }}>{avg}</span> <span style={{ color: '#94A3B8', fontSize: '12px' }}>({reviews.length}件)</span></> : <span style={{ color: '#94A3B8', fontSize: '13px' }}>レビューはまだありません</span>}</div>
          </div>
        </div>

        {seller.photos && seller.photos.length > 0 && (
          <div style={{ marginTop: '24px' }}>
            <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#1a1a1a', margin: '0 0 12px' }}>店舗・商品写真</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
              {seller.photos.slice(0, 8).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: '1 / 1', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e0e0e0', backgroundImage: 'url(' + url + ')', backgroundSize: 'cover', backgroundPosition: 'center' }}></a>
              ))}
            </div>
          </div>
        )}

        <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#1a1a1a', margin: '28px 0 12px' }}>お客様のレビュー</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          {reviews.length === 0 && <div style={{ color: '#94A3B8', fontSize: '14px', padding: '16px', background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', textAlign: 'center' }}>まだレビューがありません。最初のレビューを投稿してみませんか？</div>}
          {reviews.map(r => (
            <div key={r.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#1a1a1a' }}>{r.reviewer_name || '匿名のお客様'}</div>
                <Stars n={r.rating} />
              </div>
              {r.comment && <div style={{ fontSize: '14px', color: '#444', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{r.comment}</div>}
              <div style={{ fontSize: '11px', color: '#94A3B8', marginTop: '8px' }}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</div>
            </div>
          ))}
        </div>

        <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e0e0e0', padding: '24px', marginTop: '28px' }}>
          <h2 style={{ fontSize: '16px', fontWeight: '900', color: '#1a1a1a', marginBottom: '6px' }}>レビューを書く</h2>
          <p style={{ fontSize: '12px', color: '#94A3B8', marginBottom: '16px' }}>投稿後、運営の確認を経て公開されます。</p>
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🙏</div>
              <div style={{ fontSize: '14px', color: '#16A34A', fontWeight: '700' }}>レビューを投稿しました。ありがとうございます！</div>
              <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '6px' }}>運営の確認後に公開されます。</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <div style={labelStyle}>お名前（任意・空欄なら匿名）</div>
                <input value={rname} onChange={e => setRname(e.target.value)} placeholder='例：山田' style={inputStyle} />
              </div>
              <div>
                <div style={labelStyle}>評価</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setRrating(n)} style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: n <= rrating ? '#F5A623' : '#ddd', lineHeight: 1 }}>★</button>
                  ))}
                </div>
              </div>
              <div>
                <div style={labelStyle}>レビュー本文</div>
                <textarea value={rcomment} onChange={e => setRcomment(e.target.value)} placeholder='お店の感想をお聞かせください' rows={4} style={{ ...inputStyle, resize: 'vertical' }} />
              </div>
              {err && <div style={{ fontSize: '13px', color: '#DC2626' }}>{err}</div>}
              <button onClick={submitReview} disabled={submitting} style={{ background: submitting ? '#ccc' : '#F5A623', color: '#fff', border: 'none', borderRadius: '8px', padding: '12px', fontSize: '14px', fontWeight: '700', cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? '送信中...' : 'レビューを投稿する'}</button>
            </div>
          )}
        </div>
      </div>
      <footer style={{ background: '#F5A623', color: '#111', padding: '24px', textAlign: 'center', marginTop: '40px' }}>
        <Link href='/' style={{ fontWeight: '900', fontSize: '16px', marginBottom: '8px', display: 'block', color: '#111', textDecoration: 'none' }}>出店コネクトナビ</Link>
        <div style={{ fontSize: '12px', color: '#111' }}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
