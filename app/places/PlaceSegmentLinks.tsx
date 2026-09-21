import Link from 'next/link'
import { segmentsForPlace } from './segments'

// 案件詳細（/places/[id]）から、その案件が属するエリア別・カテゴリ別ページへの導線。
//
// なぜ要るか:
//   案件詳細は289ページあるのに、一覧へ戻る道は絞り込みクエリ（/places?pref=◯◯）1本
//   しかなかった。固有ページのある県・掛け合わせへは、そちらへ渡す。
//   募集終了した案件のページからもリンクしてよい
//   （AGENTS.md：終了案件は実績として検索に出すので、一覧からリンクしてよい）。
//
// サーバー部品にしているのは、リンクの判定に segments.ts を読むだけで、
// クライアント側のJSを増やす理由が無いため。

export default function PlaceSegmentLinks({
  prefecture, genres,
}: { prefecture: string | null; genres: string[] | null }) {
  const segs = segmentsForPlace(prefecture, genres)
  if (segs.length === 0) return null
  return (
    <section style={{ marginTop: '36px' }}>
      <h2 style={{ fontSize: '17px', fontWeight: 900, color: '#1a1a1a', margin: '0 0 12px' }}>
        同じエリア・同じ種類の出店場所
      </h2>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {segs.map(s => (
          <Link
            key={s.slug}
            href={s.path}
            style={{
              background: '#fff', border: '1px solid #E7DCC8', borderRadius: '10px',
              padding: '11px 16px', fontSize: '13.5px', fontWeight: 700,
              color: '#B45309', textDecoration: 'none',
            }}
          >
            {s.shortName}の出店場所をすべて見る →
          </Link>
        ))}
      </div>
    </section>
  )
}
