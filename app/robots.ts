import type { MetadataRoute } from 'next'
import { SITE_URL } from './lib/seo'

// 検索エンジンに、見に来てよい場所とサイトマップの場所を伝える。
//
// 管理画面やダッシュボードは、ここで Disallow にすると
// 中身（noindex の指定）を読んでもらえず、URL だけが検索結果に出ることがある。
// そのため各ページ側の layout.tsx で noindex を指定していて、ここでは塞がない。

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/auth/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
