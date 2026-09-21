import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CROSS_SEGMENTS, findCrossSegment } from '../../../segments'
import SegmentPage, { segmentMetadata, loadSegmentPage } from '../../../SegmentPage'

// 都道府県×場所の種類（いまは東京都×大学・学校の1枚）。
//
// **掛け合わせの向きは area→category に固定する。**
// /places/category/school/tokyo は作らない。両方向を許すと同じ集合に2つのURLが生まれる。
// 開設の線は掲載15件以上、かつどちらの親集合の60%未満（app/places/segments.ts の THRESHOLDS）。
//
// 親が2枚（東京都・全国の大学・学校）あるので、このページは親と同じことを書かない。
// 原稿（segmentCopy.ts）でも親と違う点だけを書き、FAQ は置いていない。

export const revalidate = 600

export function generateStaticParams() {
  return CROSS_SEGMENTS.map(s => ({ pref: s.areaSlug as string, tag: s.tagSlug as string }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ pref: string; tag: string }> },
): Promise<Metadata> {
  const { pref, tag } = await params
  const seg = findCrossSegment(pref, tag)
  if (!seg) return {}
  const set = await loadSegmentPage(seg)
  return segmentMetadata(seg, set.ok ? set.facts : null)
}

export default async function PlacesAreaCategoryPage(
  { params }: { params: Promise<{ pref: string; tag: string }> },
) {
  const { pref, tag } = await params
  const seg = findCrossSegment(pref, tag)
  if (!seg) notFound()
  return <SegmentPage seg={seg} />
}
