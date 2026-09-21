import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AREA_SEGMENTS, findAreaSegment } from '../../segments'
import SegmentPage, { segmentMetadata, loadSegmentPage } from '../../SegmentPage'

// 都道府県別の出店場所一覧（6枚）。
//
// ルーティングの並び:
//   同じ階層に /places/[id]（案件詳細）があるが、静的な 'area' のほうが先に当たる。
//   万一そちらへ流れても、案件IDは UUID で /places/[id] の placeExists が
//   UUID でないものを false にするため 404 になり、開発中に気づける（静かに壊れない）。
//
// generateStaticParams は segments.ts の一覧から作る。DBを数えて決めない。
// node_modules/next/dist/docs/01-app/03-api-reference/04-functions/generate-static-params.md に
// 「During revalidation (ISR), generateStaticParams will not be called again」と書いてあり、
// 件数でページ集合を決めると、毎時DBを読み直す app/sitemap.ts との間でずれが固定される。

export const revalidate = 600

export function generateStaticParams() {
  return AREA_SEGMENTS.map(s => ({ pref: s.areaSlug as string }))
}

export async function generateMetadata({ params }: { params: Promise<{ pref: string }> }): Promise<Metadata> {
  const { pref } = await params
  const seg = findAreaSegment(pref)
  if (!seg) return {}
  const set = await loadSegmentPage(seg)
  return segmentMetadata(seg, set.ok ? set.facts : null)
}

export default async function PlacesAreaPage({ params }: { params: Promise<{ pref: string }> }) {
  const { pref } = await params
  const seg = findAreaSegment(pref)
  if (!seg) notFound()
  return <SegmentPage seg={seg} />
}
