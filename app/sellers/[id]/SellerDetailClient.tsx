'use client'
import Link from 'next/link'
import SiteHeader from '../../components/SiteHeader'
import BackButton from '../../components/BackButton'
import SiteFooter from '../../components/SiteFooter'
import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { formatVehicleSize } from '../../lib/vehicleSize'

export type Seller = {
  id: string; name: string | null; shop_name: string | null
  genre: string[] | string | null; areas: string[] | null; photos: string[] | null
  // 出店者がマイページで入力しているのに、これまで公開ページに出ていなかった項目
  bio?: string | null
  sales_type?: string | null
  vehicle_type?: string | null
  size_length?: number | null
  size_width?: number | null
  size_height?: number | null
  equipment?: string | null
  menu?: string | null
  takeout_bag?: string | null
  payment_methods?: string[] | string | null
}
export type Review = { id: string; reviewer_name: string | null; rating: number; comment: string | null; created_at: string }
export type MenuItem = { id: string; name: string; price: number | null; photo_url: string | null; sort_order: number; detail?: string | null }
export type SnsLink = { platform: string; url: string }

type Props = {
  id: string
  initialSeller: Seller | null
  initialMenus: MenuItem[]
  initialReviews: Review[]
  initialSns?: SnsLink[]
}

// 公開ページで出す列。サーバー側（page.tsx）と同じ並びにしておく
const SELLER_COLUMNS =
  'id, name, shop_name, genre, areas, photos, bio, sales_type, vehicle_type, size_length, size_width, size_height, equipment, menu, takeout_bag, payment_methods'

const SNS_LABEL: Record<string, string> = {
  instagram: 'Instagram', twitter: 'X（Twitter）', youtube: 'YouTube', tiktok: 'TikTok',
}

const BRAND = '#F5A623'
const CORPORATE_MARKERS = ['株式会社', '合同会社', '有限会社', '合資会社', '合名会社', '(株)', '（株）', '(有)', '（有）']

const toArray = (v: string[] | string | null): string[] => {
  if (!v) return []
  let arr: unknown[]
  if (Array.isArray(v)) {
    arr = v
  } else {
    const t = v.trim()
    if (t.startsWith('[') && t.endsWith(']')) {
      try { const j = JSON.parse(t); arr = Array.isArray(j) ? j : [t] } catch { arr = t.split(/[,、，]/) }
    } else {
      arr = t.split(/[,、，]/)
    }
  }
  return arr.map((s) => (s ?? '').toString().replace(/^[\[\]"'\s]+|[\[\]"'\s]+$/g, '').trim()).filter(Boolean)
}

const displayShopName = (s: Seller): string | null => {
  const name = (s.shop_name ?? '').trim()
  if (!name || CORPORATE_MARKERS.some((m) => name.includes(m))) return null
  return name
}

const Stars = ({ n }: { n: number }) => (
  <span style={{ color: BRAND, letterSpacing: '2px' }}>
    {'★'.repeat(Math.round(n))}
    <span style={{ color: '#E7E5E4' }}>{'★'.repeat(5 - Math.round(n))}</span>
  </span>
)

function SellerDetailInner({ id, initialSeller, initialMenus, initialReviews, initialSns = [] }: Props) {
  // サーバーで取ったものを最初から表示する。読み込み中の空白が出ず、
  // 検索エンジンにも中身が渡る。
  const [seller, setSeller] = useState<Seller | null>(initialSeller)
  const [reviews, setReviews] = useState<Review[]>(initialReviews)
  const [menus, setMenus] = useState<MenuItem[]>(initialMenus)
  const [sns, setSns] = useState<SnsLink[]>(initialSns)
  const [loading, setLoading] = useState(initialSeller === null)
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
      .eq('seller_id', id)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
    setReviews((data || []) as Review[])
  }

  const searchParams = useSearchParams()
  const isPreview = searchParams.get('preview') === '1'

  useEffect(() => {
    if (!id) return
    // サーバーで取れていて、プレビューでもなければ取り直さない
    if (initialSeller && !isPreview) return
    const load = async () => {
      // 通常は公開済み（承認済み）の出店者のみ表示する。
      // 管理画面からの「プレビュー」だけは、承認前の内容も確認できるようにする。
      // 通常は公開用のビューから読む（承認済みの出店者だけが入っている）。
      // 管理画面からのプレビューだけは、承認前も見たいので profiles を直接読む
      // （管理者は profiles を読めるポリシーがある）。
      const q = isPreview
        ? supabase.from('profiles').select(SELLER_COLUMNS).eq('id', id)
        : supabase.from('public_sellers').select(SELLER_COLUMNS).eq('id', id)
      const { data: s } = await q.single()
      setSeller(s as unknown as Seller)
      await loadReviews()
      const [{ data: menuData }, { data: snsData }] = await Promise.all([
        supabase.from('menus')
          .select('id, name, price, photo_url, sort_order, detail')
          .eq('seller_id', id)
          .order('sort_order', { ascending: true })
          .order('created_at', { ascending: true }),
        supabase.from('sns_links').select('platform, url').eq('seller_id', id),
      ])
      setMenus((menuData || []) as MenuItem[])
      setSns(((snsData || []) as SnsLink[]).filter(x => x.url))
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isPreview])

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

  if (loading) return (<div style={{ background: '#FBF7F1', minHeight: '100vh' }}><SiteHeader /><div style={{ textAlign: 'center', padding: '80px 20px', color: '#A8A29E' }}>読み込み中...</div></div>)
  if (!seller) return (<div style={{ background: '#FBF7F1', minHeight: '100vh' }}><SiteHeader /><div style={{ textAlign: 'center', padding: '80px 20px', color: '#A8A29E' }}>出店者が見つかりませんでした。<br /><Link href='/sellers' style={{ color: BRAND, fontWeight: 700 }}>一覧に戻る</Link></div></div>)

  const shopName = displayShopName(seller)
  const genres = toArray(seller.genre)
  const areas = seller.areas || []
  const cover = seller.photos && seller.photos.length > 0 ? seller.photos[0] : null
  const initial = (shopName || '店').trim().charAt(0)

  const card = { background: '#fff', borderRadius: '16px', border: '1px solid #EDE7DE' }
  const sectionTitle = { fontSize: '15px', fontWeight: 700, color: '#1C1917', margin: '0 0 12px' }
  const labelStyle = { fontSize: '12px', color: '#78716C', marginBottom: '6px' }
  const inputStyle = { width: '100%', border: '1.5px solid #E7E5E4', borderRadius: '10px', padding: '10px 12px', fontSize: '14px', color: '#1C1917', boxSizing: 'border-box' as const, background: '#fff' }
  const chip = (bg: string, color: string) => ({ fontSize: '12px', fontWeight: 500, background: bg, color, padding: '3px 10px', borderRadius: '999px' })

  return (
    <div style={{ background: '#FBF7F1', minHeight: '100vh' }}>
      <SiteHeader />
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '14px 16px 0' }}>
        <BackButton fallback='/sellers' />
      </div>
      <div style={{ maxWidth: '780px', margin: '0 auto', padding: '24px 16px' }}>
        <Link href='/sellers' style={{ fontSize: '13px', color: '#78716C', textDecoration: 'none' }}>← 出店者一覧に戻る</Link>

        <div style={{ ...card, padding: '24px', marginTop: '12px', display: 'flex', gap: '18px', alignItems: 'center' }}>
          <div style={{ width: '72px', height: '72px', flexShrink: 0, borderRadius: '16px', overflow: 'hidden', background: cover ? 'center/cover url(' + cover + ')' : '#FEF3E2', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #EDE7DE' }}>
            {!cover && <span style={{ fontSize: '30px', fontWeight: 700, color: BRAND }}>{initial}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* 見出しは法人名でも出す。
                一覧では「株式会社◯◯」を屋号ではないとみなして伏せているが、
                その規則を詳細ページにも当てると、全項目を埋めた出店者のページに
                「（店名未登録）」と出てしまう。ページのタイトルとSNS共有では
                元から法人名を出しているので、見出しだけが食い違っていた。 */}
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1C1917', margin: '0 0 8px', lineHeight: 1.3 }}>{shopName || (seller.shop_name ?? '').trim() || (seller.name ?? '').trim() || <span style={{ color: '#A8A29E' }}>（店名未登録）</span>}</h1>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {genres.length > 0 ? genres.map((g) => (<span key={g} style={chip('#FEF3E2', '#9A5B0A')}>{g}</span>)) : <span style={{ fontSize: '13px', color: '#A8A29E' }}>ジャンル未設定</span>}
            </div>
            {areas.length > 0 && <div style={{ fontSize: '13px', color: '#57534E', marginTop: '10px' }}>📍 {areas.join('・')}</div>}
            <div style={{ marginTop: '10px', fontSize: '14px', fontWeight: 700 }}>{reviews.length > 0 ? <><Stars n={avg} /> <span style={{ color: '#1C1917' }}>{avg}</span> <span style={{ color: '#A8A29E', fontSize: '12px' }}>({reviews.length}件)</span></> : <span style={{ color: '#A8A29E', fontSize: '13px', fontWeight: 400 }}>レビューはまだありません</span>}</div>
          </div>
        </div>

        {/* 紹介文。出店者が自分の言葉で書いた説明なので、いちばん上に置く */}
        {(seller.bio ?? '').trim() && (
          <div style={{ ...card, padding: '20px 22px', marginTop: '16px' }}>
            <p style={{ margin: 0, fontSize: '14px', lineHeight: 2, color: '#44403C', whiteSpace: 'pre-wrap' }}>{seller.bio}</p>
          </div>
        )}

        {/* お店について。出店者がマイページで入力した内容のうち、
            書かれているものだけを並べる（空欄は行ごと出さない） */}
        {(() => {
          const size = formatVehicleSize(
            seller.size_length != null ? String(seller.size_length) : null,
            seller.size_width != null ? String(seller.size_width) : null,
            seller.size_height != null ? String(seller.size_height) : null,
          )
          const pays = Array.isArray(seller.payment_methods)
            ? seller.payment_methods.filter(Boolean).join('・')
            : (seller.payment_methods ?? '')
          const rows: { label: string; value: string }[] = [
            { label: '販売形態', value: (seller.sales_type ?? '').trim() },
            { label: '車種', value: (seller.vehicle_type ?? '').trim() },
            { label: '車両サイズ', value: size },
            { label: '設備', value: (seller.equipment ?? '').trim() },
            { label: 'テイクアウトの袋', value: (seller.takeout_bag ?? '').trim() },
            { label: '利用できる決済', value: String(pays).trim() },
          ].filter(r => r.value)
          if (rows.length === 0) return null
          return (
            <div style={{ marginTop: '28px' }}>
              <h2 style={sectionTitle}>お店について</h2>
              <div style={{ ...card, overflow: 'hidden' }}>
                {rows.map((r, i) => (
                  <div key={r.label} style={{ display: 'grid', gridTemplateColumns: '128px 1fr', gap: '14px', padding: '12px 18px', borderTop: i === 0 ? 'none' : '1px solid #F1EBE2', alignItems: 'baseline' }}>
                    <span style={{ fontSize: '12px', color: '#78716C' }}>{r.label}</span>
                    <span style={{ fontSize: '14px', color: '#1C1917', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{r.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}

        {(seller.menu ?? '').trim() && (
          <div style={{ marginTop: '28px' }}>
            <h2 style={sectionTitle}>取り扱い品目</h2>
            <div style={{ ...card, padding: '18px 20px' }}>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 2, color: '#44403C', whiteSpace: 'pre-wrap' }}>{seller.menu}</p>
            </div>
          </div>
        )}

        {seller.photos && seller.photos.length > 0 && (
          <div style={{ marginTop: '28px' }}>
            <h2 style={sectionTitle}>店舗・商品写真</h2>
            <div style={{ display: 'grid', gridTemplateColumns: seller.photos.length === 1 ? '1fr' : 'repeat(2, 1fr)', gap: '12px' }}>
              {seller.photos.slice(0, 8).map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', aspectRatio: seller.photos!.length === 1 ? '16 / 10' : '4 / 3', borderRadius: '14px', overflow: 'hidden', border: '1px solid #EDE7DE', background: 'center/cover url(' + url + ')' }} />
              ))}
            </div>
          </div>
        )}

        {menus.length > 0 && (
          <div style={{ marginTop: '28px' }}>
            <h2 style={sectionTitle}>提供メニュー</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '12px' }}>
              {menus.map((m) => (
                <div key={m.id} style={{ ...card, overflow: 'hidden' }}>
                  {m.photo_url ? (
                    <div style={{ width: '100%', paddingTop: '70%', position: 'relative' }}><img src={m.photo_url} alt={m.name} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                  ) : (
                    <div style={{ width: '100%', paddingTop: '70%', position: 'relative', background: '#F5F0E8' }}><div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '30px' }}>🍽️</div></div>
                  )}
                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#1C1917' }}>{m.name}</div>
                    {(m.detail ?? '').trim() && (
                      <div style={{ fontSize: '12px', color: '#78716C', marginTop: '3px', lineHeight: 1.7 }}>{m.detail}</div>
                    )}
                    <div style={{ fontSize: '14px', fontWeight: 700, color: BRAND, marginTop: '4px' }}>{m.price != null ? m.price.toLocaleString() + '円' : '価格応相談'}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {sns.length > 0 && (
          <div style={{ marginTop: '28px' }}>
            <h2 style={sectionTitle}>SNS</h2>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {sns.map(l => (
                <a key={l.platform} href={l.url} target='_blank' rel='noopener noreferrer nofollow'
                  style={{ ...card, padding: '9px 16px', fontSize: '13px', fontWeight: 700, color: '#9A5B0A', textDecoration: 'none' }}>
                  {SNS_LABEL[l.platform] ?? l.platform} ↗
                </a>
              ))}
            </div>
          </div>
        )}

        <h2 style={{ ...sectionTitle, margin: '28px 0 12px' }}>お客様のレビュー</h2>
        <div style={{ display: 'grid', gap: '12px' }}>
          {reviews.length === 0 && <div style={{ ...card, color: '#A8A29E', fontSize: '14px', padding: '16px', textAlign: 'center' }}>まだレビューがありません。最初のレビューを投稿してみませんか？</div>}
          {reviews.map((r) => (
            <div key={r.id} style={{ ...card, padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#1C1917' }}>{r.reviewer_name || '匿名のお客様'}</div>
                <Stars n={r.rating} />
              </div>
              {r.comment && <div style={{ fontSize: '14px', color: '#44403C', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{r.comment}</div>}
              <div style={{ fontSize: '11px', color: '#A8A29E', marginTop: '8px' }}>{new Date(r.created_at).toLocaleDateString('ja-JP')}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, padding: '24px', marginTop: '28px' }}>
          <h2 style={{ ...sectionTitle, marginBottom: '6px' }}>レビューを書く</h2>
          <p style={{ fontSize: '12px', color: '#A8A29E', marginBottom: '16px' }}>投稿後、運営の確認を経て公開されます。</p>
          {done ? (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <div style={{ fontSize: '40px', marginBottom: '10px' }}>🙏</div>
              <div style={{ fontSize: '14px', color: '#15803D', fontWeight: 700 }}>レビューを投稿しました。ありがとうございます！</div>
              <div style={{ fontSize: '12px', color: '#A8A29E', marginTop: '6px' }}>運営の確認後に公開されます。</div>
            </div>
          ) : (
            <div style={{ display: 'grid', gap: '14px' }}>
              <div><div style={labelStyle}>お名前（任意・空欄なら匿名）</div><input value={rname} onChange={(e) => setRname(e.target.value)} placeholder='例：山田' style={inputStyle} /></div>
              <div>
                <div style={labelStyle}>評価</div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {[1, 2, 3, 4, 5].map((n) => (<button key={n} onClick={() => setRrating(n)} aria-label={n + 'つ星'} style={{ fontSize: '28px', background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: n <= rrating ? BRAND : '#E7E5E4', lineHeight: 1 }}>★</button>))}
                </div>
              </div>
              <div><div style={labelStyle}>レビュー本文</div><textarea value={rcomment} onChange={(e) => setRcomment(e.target.value)} placeholder='お店の感想をお聞かせください' rows={4} style={{ ...inputStyle, resize: 'vertical' }} /></div>
              {err && <div style={{ fontSize: '13px', color: '#DC2626' }}>{err}</div>}
              <button onClick={submitReview} disabled={submitting} style={{ background: submitting ? '#D6D3D1' : BRAND, color: '#fff', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer' }}>{submitting ? '送信中...' : 'レビューを投稿する'}</button>
            </div>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  )
}

// useSearchParams を使うため Suspense で包む（本番ビルドで必要）
export default function SellerDetailClient(props: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#FFF8F0' }} />}>
      <SellerDetailInner {...props} />
    </Suspense>
  )
}
