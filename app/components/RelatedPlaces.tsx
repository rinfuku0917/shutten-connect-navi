import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { segmentForFilter } from '../places/segments'

// 記事の下に出す「関連する出店場所」。
//
// 記事に設定した都道府県・カテゴリに合う案件を並べ、案件詳細への内部リンクにする。
// 募集終了した案件は載せない（リンク先で応募できず、回遊の行き止まりになるため）。

export type RelatedPlace = {
  id: string
  title: string
  prefecture: string | null
  image_url: string | null
}

export async function fetchRelatedPlaces(
  prefecture: string | null,
  category: string | null,
  limit = 4,
): Promise<RelatedPlace[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []
  const db = createClient(url, key, { auth: { persistSession: false } })

  const base = () =>
    db
      .from('places')
      .select('id, title, prefecture, image_url')
      .eq('status', 'published')
      .eq('closed', false)

  const seen = new Set<string>()
  const out: RelatedPlace[] = []
  const push = (rows: RelatedPlace[] | null) => {
    for (const r of rows ?? []) {
      if (out.length >= limit || seen.has(r.id)) continue
      seen.add(r.id)
      out.push(r)
    }
  }

  // 都道府県とカテゴリの両方が合うものを最優先で出す
  if (prefecture && category) {
    const { data } = await base()
      .eq('prefecture', prefecture)
      .contains('genres', [category])
      .order('created_at', { ascending: false })
      .limit(limit)
    push(data as RelatedPlace[] | null)
  }
  // 次に都道府県だけ
  if (out.length < limit && prefecture) {
    const { data } = await base().eq('prefecture', prefecture).order('created_at', { ascending: false }).limit(limit)
    push(data as RelatedPlace[] | null)
  }
  // 次にカテゴリだけ
  if (out.length < limit && category) {
    const { data } = await base().contains('genres', [category]).order('created_at', { ascending: false }).limit(limit)
    push(data as RelatedPlace[] | null)
  }
  // それでも足りなければ、新しい募集中の案件で埋める（枠が空のままにしない）
  if (out.length < limit) {
    const { data } = await base().order('created_at', { ascending: false }).limit(limit * 2)
    push(data as RelatedPlace[] | null)
  }

  return out.slice(0, limit)
}

export default function RelatedPlaces({
  places,
  heading = '関連する出店場所',
  lead,
  prefecture = null,
}: {
  places: RelatedPlace[]
  heading?: string
  lead?: string
  /** 記事に設定した都道府県。その県の出店場所一覧へ1本つなぐ。
   *  枠の中のカードは募集中のみという現仕様を維持する
   *  （AGENTS.md：記事の「関連する出店場所」枠に終了案件は出さない）。 */
  prefecture?: string | null
}) {
  if (places.length === 0) return null

  // 都道府県ごとの固有ページがある県はそちらへ。無い県は全国の一覧へ。
  // どのページがあるかの判定は app/places/segments.ts が唯一の正
  const areaSegment = prefecture ? segmentForFilter(prefecture, '') : undefined

  return (
    <section style={{ marginTop: '48px' }}>
      <h2 style={{ fontSize: '20px', fontWeight: 900, color: '#1a1a1a', margin: '0 0 6px' }}>{heading}</h2>
      {lead && <p style={{ fontSize: '13px', color: '#64748B', margin: '0 0 18px', lineHeight: 1.9 }}>{lead}</p>}

      <div className='related-places-grid' style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px' }}>
        {places.map(p => (
          <Link
            key={p.id}
            href={`/places/${p.id}`}
            style={{
              display: 'block',
              background: '#fff',
              border: '1px solid #EEE',
              borderRadius: '12px',
              overflow: 'hidden',
              textDecoration: 'none',
              color: 'inherit',
              minWidth: 0,
            }}
          >
            <div
              style={{
                aspectRatio: '16 / 10',
                background: p.image_url ? `url(${p.image_url}) center/cover no-repeat` : '#FFF3E0',
              }}
              role='img'
              aria-label={p.title}
            />
            <div style={{ padding: '12px 14px' }}>
              <div style={{ fontSize: '14px', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.6 }}>{p.title}</div>
              {p.prefecture && (
                <div style={{ fontSize: '12px', color: '#94A3B8', marginTop: '4px' }}>{p.prefecture}</div>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div style={{ textAlign: 'center', marginTop: '18px' }}>
        {areaSegment ? (
          <Link href={areaSegment.path} style={{ fontSize: '14px', fontWeight: 700, color: '#B45309' }}>
            {areaSegment.shortName}の出店場所をすべて見る →
          </Link>
        ) : (
          <Link href='/places' style={{ fontSize: '14px', fontWeight: 700, color: '#B45309' }}>
            出店場所をすべて見る →
          </Link>
        )}
      </div>
    </section>
  )
}
