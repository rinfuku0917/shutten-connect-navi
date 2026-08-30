import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import PlaceDetailClient, { type Place } from './PlaceDetailClient'
import JsonLd from '../../components/JsonLd'
import { SITE_URL, breadcrumbJsonLd } from '../../lib/seo'

// 案件の詳細。
//
// 以前はブラウザ側でデータを取っていたため、検索エンジンには
// 「読み込み中...」しか見えず、300件以上の案件ページが1つも
// 検索結果に出ていなかった。ここでサーバー側で読み込んでから渡す。
//
// 出店料・出店条件・備考のログイン制限は変えていない。
// 制限はブラウザ側の判定（canSeeFee）で行っていて、
// サーバーでは常にログイン前なので、HTMLにも出ない。

export const revalidate = 600

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return null
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })
}

// サーバー側では公開中の案件だけを読む。
// ここはサービスキーを使うため、status で絞らないと
// 下書きや非公開の案件まで誰にでも見えてしまう。
// 非公開の案件を募集者本人が見る場合は、ブラウザ側で読み直す。
async function fetchPlace(id: string): Promise<Place | null> {
  const client = db()
  if (!client) return null
  const { data } = await client
    .from('places')
    .select('*')
    .eq('id', id)
    .eq('status', 'published')
    .maybeSingle()
  return (data as Place) ?? null
}

// 検索結果に出す説明文。案件の説明が無い場合は場所と募集内容から作る。
function summarize(p: Place): string {
  const parts: string[] = []
  const where = [p.prefecture, p.address].filter(Boolean).join(' ')
  if (where) parts.push(where)
  if (p.recruit) parts.push('募集：' + p.recruit)
  const desc = (p.description || '').replace(/\s+/g, ' ').trim()
  if (desc) parts.push(desc)
  const text = parts.join('｜')
  return text.length > 120 ? text.slice(0, 119) + '…' : text || '出店者を募集しています。'
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params
  const place = await fetchPlace(id)
  if (!place) return { title: '案件が見つかりません', robots: { index: false, follow: true } }

  const area = place.prefecture ? `${place.prefecture}｜` : ''
  const title = `${place.title}｜${area}キッチンカーの出店募集`
  const description = summarize(place)
  const image = place.image_url || (Array.isArray(place.images) ? place.images[0] : null)

  return {
    title: { absolute: `${title}｜出店コネクトナビ` },
    description,
    alternates: { canonical: `/places/${place.id}` },
    openGraph: {
      title,
      description,
      url: `/places/${place.id}`,
      type: 'article',
      images: image ? [image] : undefined,
    },
  }
}

export default async function PlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const place = await fetchPlace(id)

  // 公開中でない案件は、募集者本人なら見られる可能性があるので
  // ここでは 404 にせず、ブラウザ側の読み込みに任せる。
  if (!place) return <PlaceDetailClient id={id} initialPlace={null} />

  const image = place.image_url || (Array.isArray(place.images) ? place.images[0] : null)

  return (
    <>
      <JsonLd
        data={breadcrumbJsonLd([
          { name: 'ホーム', path: '/' },
          { name: '出店場所を探す', path: '/places' },
          { name: place.title, path: `/places/${place.id}` },
        ])}
      />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: place.title,
          description: summarize(place),
          url: `${SITE_URL}/places/${place.id}`,
          ...(image ? { image } : {}),
          ...(place.address
            ? {
                address: {
                  '@type': 'PostalAddress',
                  addressCountry: 'JP',
                  ...(place.prefecture ? { addressRegion: place.prefecture } : {}),
                  streetAddress: place.address,
                },
              }
            : {}),
          ...(place.latitude != null && place.longitude != null
            ? { geo: { '@type': 'GeoCoordinates', latitude: place.latitude, longitude: place.longitude } }
            : {}),
        }}
      />
      <PlaceDetailClient id={id} initialPlace={place} />
    </>
  )
}
