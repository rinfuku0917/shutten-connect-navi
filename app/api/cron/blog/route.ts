import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCronCaller } from '../../../lib/cronAuth'

// ブログの下書きをAIに1本作らせる。管理画面の「ブログ」から手動で呼ぶ。
//
//   記事の文章 … Claude（Anthropic）
//   記事の画像 … OpenAI（画像生成）
//
// 2026-09-02 に、定期実行（毎週 月・木）をやめた。理由は3つ。
//   1. そのまま公開していたため、中身を誰も読まないまま公開ページが増えていた
//   2. URLが auto-mtgh64lh-jwwkxe のような無意味な文字列になっていた
//   3. 同じテーマが二度選ばれ、ほぼ同じ記事が2本できていた
//      （「駐車場を貸す前に…」と「駐車場の一角を貸すときの…」）
//
// いまは次のようにしている。
//   ・作るのは下書きだけ。公開は管理画面で中身を読んでから
//   ・URLはテーマごとに決めた英語の固定文字列
//   ・そのURLの記事が既にあれば作らない（同じ記事が二度できない）
//
// 記事を自分で書くときは docs/blog/TEMPLATE.md と npm run blog:sql を使う。
// 自社のデータを載せた記事のほうが強いので、主な記事はそちらで書く。

export const maxDuration = 300

// 記事のテーマ候補。上から順に、まだ書いていないものが選ばれる。
//
// slug は記事のURLになる。一度公開したら変えないこと（変えるなら301が要る）。
// cat は app/lib/postCategories.ts の4つから選ぶ。記事一覧の絞り込みに使う。
const TOPICS = [
  { slug: 'venue-facility-requirements', cat: '募集者向け', theme: 'キッチンカーを呼びたい施設が最初に確認すべき設備条件（電源・給排水・搬入経路）' },
  { slug: 'regular-event-schedule', cat: '募集者向け', theme: '商業施設でキッチンカーを定期開催するときの曜日と時間帯の決め方' },
  { slug: 'choosing-food-truck-vendors', cat: '募集者向け', theme: 'キッチンカー誘致で失敗しないための出店者の選び方' },
  { slug: 'renting-parking-space', cat: '募集者向け', theme: '駐車場の一角をキッチンカーに貸すときの注意点と必要な手続き' },
  { slug: 'event-menu-mix', cat: '募集者向け', theme: 'イベントにキッチンカーを複数台呼ぶときのメニュー構成の考え方' },
  { slug: 'rainy-day-policy', cat: '募集者向け', theme: '雨天時の対応をどう決めるか｜主催者と出店者で揉めないための取り決め' },
  { slug: 'how-many-food-trucks', cat: '募集者向け', theme: '来場者数からキッチンカーの適正台数を見積もる方法' },
  { slug: 'location-sales-factors', cat: '出店場所の探し方', theme: 'キッチンカーの売上を左右する立地の見極め方' },
  { slug: 'food-cost-and-pricing', cat: '出店場所の探し方', theme: 'キッチンカーの原価率と価格設定の考え方' },
  { slug: 'repeat-customers', cat: '出店場所の探し方', theme: 'リピーターがつくキッチンカーの共通点' },
  { slug: 'permits-and-insurance', cat: '書類・保険', theme: 'キッチンカー開業に必要な許可と保険を一から解説' },
  { slug: 'choosing-a-vehicle', cat: '開業・許可', theme: 'キッチンカーの車両選び｜軽トラック・バン・トレーラーの違い' },
  { slug: 'health-center-license', cat: '開業・許可', theme: '開業前に押さえておきたい保健所の営業許可の取り方' },
]

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateArticle(theme: string, category: string, avoid: string[]): Promise<any> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY が設定されていません')

  const prompt = `あなたは「出店コネクトナビ」というキッチンカーと出店場所をつなぐサービスのブログ担当です。
以下のテーマで、日本語のブログ記事を1本書いてください。

テーマ: ${theme}
カテゴリ: ${category}

条件:
- 読者は${category === '募集者向け' ? '場所を貸す側の施設オーナー・イベント主催者' : 'キッチンカーの出店者（事業者）'}です
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
  const auth = await verifyCronCaller(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const sUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const sKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!sUrl || !sKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(sUrl, sKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // まだ書いていないテーマを選ぶ。
    //
    // 以前は「生成されたタイトルにテーマの先頭8文字が含まれるか」で判定していたが、
    // AIが少し違うタイトルを付けると書いたことに気づけず、同じテーマの記事が
    // 二度できていた。テーマごとに決めたURLがあるかどうかで判定する。
    const { data: posts } = await db.from('posts').select('slug, title')
    const titles = (posts || []).map(p => p.title as string)
    const usedSlugs = new Set((posts || []).map(p => p.slug as string))
    // 定期実行をやめる前に、無意味なURLで公開されてしまった記事。
    // 中身は TOPICS のテーマそのものなので、URLが違っても「書いた」とみなす。
    // これを見ないと、同じテーマの記事がもう一度作られる。
    //
    // docs/blog/rename-auto-articles.sql を流すと、これらは TOPICS の slug に
    // 改名されるので、この対応表は通らなくなる。流す前の取り違えを防ぐために残す。
    const ALREADY_WRITTEN: Record<string, string> = {
      'regular-event-schedule': 'auto-mta8z1w9-vazfy1', // 定期開催の曜日と時間帯の決め方
      'renting-parking-space': 'auto-mtgh64lh-jwwkxe',  // 駐車場の一角を貸すときの注意点
    }
    const pick = TOPICS.find(t => !usedSlugs.has(t.slug) && !usedSlugs.has(ALREADY_WRITTEN[t.slug] ?? ''))
    if (!pick) {
      // 以前はここで書いたことのあるテーマをもう一度選んでいた。
      // 同じ記事が増えるだけなので、何も作らずに終わる。
      return NextResponse.json({
        error: '用意したテーマをすべて書き終えています。app/api/cron/blog/route.ts の TOPICS に足してください。',
      }, { status: 409 })
    }

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

    // 下書きとして保存する。公開は管理画面で中身を読んでから。
    // published_at は公開したときに入るので、ここでは入れない。
    const { data: ins, error } = await db.from('posts').insert({
      slug: pick.slug,
      title: String(article.title || '').slice(0, 120),
      content,
      excerpt: String(article.excerpt || '').slice(0, 200),
      meta_description: String(article.meta_description || '').slice(0, 200),
      category: pick.cat,
      cover_emoji: String(article.cover_emoji || '📝').slice(0, 8),
      status: 'draft',
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
