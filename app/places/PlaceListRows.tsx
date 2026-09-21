import Link from 'next/link'
import type { SegmentPlace } from './segmentData'

// エリア別・カテゴリ別ページに並べる、案件の軽い行。
//
// カード（PlacesBrowser）ではなく行にしているのは、1ページに最大150行を並べるため。
// 写真を150枚並べると読み込みが重くなり、ファーストビューの外にある画像を
// 遅延読み込みにしても、行そのものの高さでページが長くなりすぎる。
//
// **金額は出さない。** SegmentPlace は出店料の列を持っていないので、
// ここから額を出すことはできない（app/places/segmentData.ts の COLUMNS を参照）。
//
// リンクは素の <a>（next/link）で書く。/places の絞り込みは select の onChange なので
// クローラーがたどれるリンクが1本も無く、13件目以降の案件はサイトマップ経由しか
// 発見経路が無かった。ここが実質の内部リンクになる。

export default function PlaceListRows({ places }: { places: SegmentPlace[] }) {
  if (places.length === 0) return null
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {places.map(p => (
        <li key={p.id}>
          <Link
            href={`/places/${p.id}`}
            style={{
              display: 'block', background: '#fff', border: '1px solid #EEE', borderRadius: '10px',
              padding: '13px 15px', textDecoration: 'none', color: 'inherit',
            }}
          >
            {/* 案件名はスマホでは2行以上になるのが普通なので、
                行送りを1.6にして、jp-head で文節の切れ目で折り返す */}
            <div className='jp-head' style={{ fontSize: '14px', fontWeight: 800, color: '#111', lineHeight: 1.6 }}>
              {p.title}
            </div>
            <div style={{ fontSize: '12px', color: '#777', marginTop: '4px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* 住所から読み取れなかったものは市区町村を出さない（「不明」と書かない） */}
              {p.city !== '不明' && <span>{p.city}</span>}
              <span>{p.typeLabel}</span>
              {p.closed && <span style={{ color: '#C81E1E', fontWeight: 700 }}>募集終了</span>}
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}
