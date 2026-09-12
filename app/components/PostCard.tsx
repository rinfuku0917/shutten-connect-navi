import Link from 'next/link'
import { firstImage, thumbnailUrl } from '../lib/postImage'

// 記事一覧の1枚。
//
// なぜ切り出したか:
//   募集者向けの記事をまとめた入口ページ（/blog/category/host）を作るとき、
//   /blog のカードをそのまま書き写すことになった。同じものが2か所にあると、
//   片方だけ直して見た目がずれていく。1か所にまとめる。

export type PostCardData = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  category: string | null
  cover_emoji: string | null
  content: string
  published_at: string | null
}

export default function PostCard({ post }: { post: PostCardData }) {
  const img = firstImage(post.content)
  return (
    <Link href={'/blog/' + post.slug} style={{ textDecoration: 'none', display: 'block', background: '#fff', border: '1px solid #e0e0e0', borderRadius: '12px', padding: '20px', color: 'inherit' }}>
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
        {img
          // 一覧のサムネイルは縮めた版を出す。記事本文の1枚目をそのまま出すと重い
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={thumbnailUrl(img)} alt="" width={96} height={96} loading="lazy" decoding="async" style={{ width: '96px', height: '96px', objectFit: 'cover', borderRadius: '10px', flexShrink: 0 }} />
          : <div style={{ fontSize: '40px', flexShrink: 0 }}>{post.cover_emoji || '📝'}</div>}
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {post.category && <span style={{ background: '#FFF3E0', color: '#B45309', fontSize: '11px', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>{post.category}</span>}
            {post.published_at && <span style={{ color: '#94A3B8', fontSize: '11px' }}>{new Date(post.published_at).toLocaleDateString('ja-JP')}</span>}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#1a1a1a', lineHeight: 1.5 }}>{post.title}</div>
          {post.excerpt && <div style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', lineHeight: 1.6 }}>{post.excerpt}</div>}
        </div>
      </div>
    </Link>
  )
}
