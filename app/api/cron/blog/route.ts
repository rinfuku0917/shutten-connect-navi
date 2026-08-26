import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// ブログの自動投稿。Vercel の定期実行（毎週 月・木の朝）から呼ばれる。
//
//   記事の文章 … Claude（Anthropic）
//   記事の画像 … OpenAI（画像生成）
//
// 生成した記事はそのまま公開する。過去に書いたテーマと重ならないよう、
// 既存記事のタイトルを渡したうえで未使用のテーマを選ばせている。
//
// 手動で試したいときは、管理画面の「ブログ」から実行できる。

export const maxDuration = 300

// 記事のテーマ候補。上から順に、まだ書いていないものが選ばれる。
const TOPICS = [
  { cat: 'オーナー向け', theme: 'キッチンカーを呼びたい施設が最初に確認すべき設備条件（電源・給排水・搬入経路）' },
  { cat: 'オーナー向け', theme: '商業施設でキッチンカーを定期開催するときの曜日と時間帯の決め方' },
  { cat: 'オーナー向け', theme: 'キッチンカー誘致で失敗しないための出店者の選び方' },
  { cat: 'オーナー向け', theme: '駐車場の一角をキッチンカーに貸すときの注意点と必要な手続き' },
  { cat: '主催者向け', theme: 'イベントにキッチンカーを複数台呼ぶときのメニュー構成の考え方' },
  { cat: '主催者向け', theme: '雨天時の対応をどう決めるか｜主催者と出店者で揉めないための取り決め' },
  { cat: '主催者向け', theme: '来場者数からキッチンカーの適正台数を見積もる方法' },
  { cat: '経営ノウハウ', theme: 'キッチンカーの売上を左右する立地の見極め方' },
  { cat: '経営ノウハウ', theme: 'キッチンカーの原価率と価格設定の考え方' },
  { cat: '経営ノウハウ', theme: 'リピーターがつくキッチンカーの共通点' },
  { cat: '開業ガイド', theme: 'キッチンカー開業に必要な許可と保険を一から解説' },
  { cat: '開業ガイド', theme: 'キッチンカーの車両選び｜軽トラック・バン・トレーラーの違い' },
  { cat: '開業ガイド', theme: '開業前に押さえておきたい保健所の営業許可の取り方' },
]

function slugify(base: string) {
  const rand = Math.random().toString(36).slice(2, 8)
  return `${base}-${Date.now().toString(36)}-${rand}`
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateArticle(theme: string, category: string, avoid: string[]): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY が設定されていません')

  const prompt = `あなたは「出店コネクトナビ」というキッチンカーと出店場所をつなぐサービスのブログ担当です。
以下のテーマで、日本語のブログ記事を1本書いてください。

テーマ: ${theme}
カテゴリ: ${category}

条件:
- 読者は${category === '開業ガイド' || category === '経営ノウハウ' ? 'キッチンカーの出店者（事業者）' : '場所を貸す側の施設オーナー・イベント主催者'}です
- 本文は Markdown。見出しは ## と ### のみ使う（# は使わない）
- 2000〜2500字程度
- 具体的な数字や事例を交え、実務で使える内容にする
- 誇張や断定的な効果の保証は書かない
- 最後に出店コネクトナビへの自然な誘導を1〜2文入れる
- 以下の既存記事と内容が重複しないようにする:
${avoid.map(t => '  - ' + t).join('\n')}

次のJSON形式のみで返answer してください（前後に説明文を付けない）:
{"title":"32文字以内のタイトル","excerpt":"80文字程度の要約","meta_description":"110文字程度のSEO説明文","cover_emoji":"記事に合う絵文字1つ","content":"Markdown本文"}`

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) throw new Error('記事の生成に失敗しました: ' + (await res.text()).slice(0, 200))
  const j = await res.json()
  const text = (j.content || []).map((c: { text?: string }) => c.text || '').join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) throw new Error('生成結果を読み取れませんでした')
  return JSON.parse(m[0])
}

// 記事の見出し画像を作る。失敗しても記事の投稿は続ける。
async function generateImage(title: string): Promise<string | null> {
  const key = process.env.OPENAI_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: `日本のキッチンカー（移動販売車）に関するブログ記事の見出し画像。テーマ:「${title}」。明るく清潔感のある写真風のイメージ。文字は入れない。人物の顔は写さない。`,
        size: '1536x1024',
        n: 1,
      }),
    })
    if (!res.ok) {
      console.error('画像の生成に失敗しました', (await res.text()).slice(0, 200))
      return null
    }
    const j = await res.json()
    return j.data?.[0]?.b64_json || null
  } catch (e) {
    console.error('画像の生成に失敗しました', e)
    return null
  }
}

export async function GET(req: Request) {
  // Vercel の定期実行、または管理画面からの手動実行のみ受け付ける
  const auth = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  const url = new URL(req.url)
  if (secret && auth !== `Bearer ${secret}` && url.searchParams.get('key') !== secret) {
    return NextResponse.json({ error: '権限がありません' }, { status: 401 })
  }

  try {
    const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!sUrl || !sKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(sUrl, sKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // 既存記事のタイトルを集め、まだ書いていないテーマを選ぶ
    const { data: posts } = await db.from('posts').select('title')
    const titles = (posts || []).map(p => p.title as string)
    const used = new Set(titles.map(t => t.replace(/\s/g, '')))
    const pick = TOPICS.find(t => ![...used].some(u => u.includes(t.theme.slice(0, 8).replace(/\s/g, ''))))
      || TOPICS[Math.floor(Date.now() / 86400000) % TOPICS.length]

    const article = await generateArticle(pick.theme, pick.cat, titles.slice(0, 20))

    // 見出し画像を作ってストレージに置く
    let content = String(article.content || '')
    const b64 = await generateImage(article.title)
    if (b64) {
      const bytes = Buffer.from(b64, 'base64')
      const path = `posts/auto-${Date.now()}.png`
      const up = await db.storage.from('blog-images').upload(path, bytes, { contentType: 'image/png', upsert: true })
      if (!up.error) {
        const pub = db.storage.from('blog-images').getPublicUrl(path).data.publicUrl
        content = `![画像](${pub})\n${content}`
      }
    }

    const slug = slugify('auto')
    const { data: ins, error } = await db.from('posts').insert({
      slug,
      title: String(article.title || '').slice(0, 120),
      content,
      excerpt: String(article.excerpt || '').slice(0, 200),
      meta_description: String(article.meta_description || '').slice(0, 200),
      category: pick.cat,
      cover_emoji: String(article.cover_emoji || '📝').slice(0, 8),
      status: 'published',
      published_at: new Date().toISOString(),
    }).select('id, slug, title')
    if (error) return NextResponse.json({ error: '保存に失敗しました: ' + error.message }, { status: 500 })

    return NextResponse.json({
      success: true,
      post: ins?.[0] ?? null,
      theme: pick.theme,
      hasImage: !!b64,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
