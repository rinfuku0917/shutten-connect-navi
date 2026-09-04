// よくある質問の並び。サイト全体で同じ見た目にするための共通部品。
//
// これまで4か所（トップ／キッチンカーの手配／イベント／費用と都道府県別）で
// それぞれ別々に書かれており、見た目が3通りに分かれていた。
//   ・トップ            … 白地・Qのアイコン・右にプラス（開閉する）
//   ・手配とイベント      … 開閉せず、全部開いたまま縦に長く並ぶ
//   ・費用と都道府県別    … 開閉するが、ベージュ地でアイコンもプラスも無い
// トップの形にそろえる。
//
// details を使うので、閉じていても中身はHTMLに残る。
// 検索エンジンからは全文が見えるため、FAQの構造化データとも食い違わない。
//
// プラスが45度回って×になる動きは globals.css の .top3-faq にある。

import Link from 'next/link'

export type FaqItem = {
  q: string
  a: string
  /** 最初から開いておきたいものに付ける */
  open?: boolean
  /** 答えの下に置くリンク */
  cta?: { href: string; label: string }
}

export default function FaqList({ items }: { items: FaqItem[] }) {
  return (
    <div>
      {items.map(f => (
        <details
          key={f.q}
          className='top3-faq'
          open={f.open}
          style={{ background: '#fff', border: '1px solid #EDE7DE', borderRadius: '10px', marginBottom: '10px' }}
        >
          <summary style={{ cursor: 'pointer', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 700, fontSize: '14.5px', color: '#111', lineHeight: 1.7 }}>
            <span style={{ width: '24px', height: '24px', flexShrink: 0, borderRadius: '6px', background: '#F5A623', color: '#fff', fontWeight: 900, display: 'grid', placeItems: 'center', fontSize: '13px' }}>Q</span>
            <span className='jp-head' style={{ flex: 1, minWidth: 0 }}>{f.q}</span>
            <span className='top3-pl' style={{ fontSize: '20px', color: '#8A8178', lineHeight: 1 }}>+</span>
          </summary>
          <div className='jp-text' style={{ padding: '0 16px 16px 52px', fontSize: '13.5px', color: '#555', lineHeight: 2 }}>
            {f.a}
            {f.cta && (
              <Link href={f.cta.href} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '10px', color: '#1b3a5c', fontWeight: 700, fontSize: '13px', textDecoration: 'none', borderBottom: '2px solid #F5A623', paddingBottom: '1px' }}>
                {f.cta.label} →
              </Link>
            )}
          </div>
        </details>
      ))}
    </div>
  )
}
