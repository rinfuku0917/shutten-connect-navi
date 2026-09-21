import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CATEGORY_SEGMENTS, findCategorySegment } from '../../segments'
import SegmentPage, { segmentMetadata, loadSegmentPage } from '../../SegmentPage'

// 場所の種類別（全国）の出店場所一覧（4枚）。
//
// 作るのは「会場の種類」で、かつ掲載20件以上のものだけ。
// 「飲食向け」「物販向け」はページを作らない（会場の種類ではなく、
// どんな出店者に向く募集かという印なので、都道府県ページとほぼ同じ集合になる）。
// 判定の表は app/places/segments.ts が唯一の正。ここでは数えない。

export const revalidate = 600

export function generateStaticParams() {
  return CATEGORY_SEGMENTS.map(s => ({ tag: s.tagSlug as string }))
}

export async function generateMetadata({ params }: { params: Promise<{ tag: string }> }): Promise<Metadata> {
  const { tag } = await params
  const seg = findCategorySegment(tag)
  if (!seg) return {}
  const set = await loadSegmentPage(seg)
  return segmentMetadata(seg, set.ok ? set.facts : null)
}

export default async function PlacesCategoryPage({ params }: { params: Promise<{ tag: string }> }) {
  const { tag } = await params
  const seg = findCategorySegment(tag)
  if (!seg) notFound()
  return <SegmentPage seg={seg} />
}
