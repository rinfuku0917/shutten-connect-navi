import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 記事の表紙を、AIに実写風の絵で作り直させる。
//
// 管理画面の記事一覧にある「表紙をAIで作る」から呼ぶ。
// 生成 → ストレージへ保存 → 記事の本文の1枚目を差し替え、までを一度に行う。
//
// なぜ管理画面からなのか:
//   画像生成の鍵（OPENAI_API_KEY）は Vercel にしか置いていない。
//   手元からは生成できないので、サーバー側で動かす。
//
// 差し替えるのは本文の1枚目の画像。ここが記事一覧のサムネイルと、
// SNSで共有したときの絵（og:image）になる。

export const maxDuration = 300

const SIZE = '1536x1024'

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(admin: any, requesterId: string) {
  const { data, error } = await admin.from('profiles').select('role').eq('id', requesterId).maybeSingle()
  return !error && data?.role === 'admin'
}

// 記事ごとに、絵にしたい場面を決めておく。
// タイトルをそのまま渡すと「出店料」「書類」のような抽象語が絵にならないため。
const SCENES: Record<string, string> = {
  'food-truck-fee-guide':
    'キッチンカーの店主が、カウンター越しに会計をしている手元。レジと料金表が見える',
  'kitchen-car-location-guide':
    'スーパーの駐車場に停まったキッチンカーと、順番を待つ買い物客の列',
  'weekday-food-truck-spots':
    '平日の昼、オフィス街の広場に停まったキッチンカーと、昼休みの会社員の列',
  'get-food-truck-offers':
    'きれいに装飾されたキッチンカーの外観。のぼりとメニュー看板が出ている',
  'renting-parking-space':
    '広い駐車場の一角に停まったキッチンカー。区画のラインと、まわりに停まった車が見える',
  'supermarket-food-truck':
    'スーパーマーケットの入口横に停まったキッチンカー。買い物かごを持った客が並んでいる',
  'kitchen-car-required-documents':
    '机の上に並んだ営業許可証と保険証券などの書類、その奥にキッチンカーの鍵',
  'mall-food-truck-event':
    '大型商業施設の屋外イベント広場に並んだキッチンカー2台と、行き交う買い物客',
  'how-to-invite-kitchen-car':
    '屋外イベントの会場に複数台並んだキッチンカーと、にぎわう来場者',
}

function buildPrompt(slug: string, title: string): string {
  const scene = SCENES[slug] ?? `「${title}」を表す、日本のキッチンカーの場面`
  return [
    `日本のキッチンカー（移動販売車）の実写風の写真。`,
    `場面：${scene}。`,
    `明るい自然光の屋外。清潔感があり、実際に撮影した写真のような質感にする。`,
    `文字・ロゴ・看板の文字は入れない。人物の顔は写さない（後ろ姿や手元にする）。`,
    `イラスト調・アニメ調にはしない。`,
  ].join('')
}

export async function POST(req: Request) {
  try {
    const admin = getAdminClient()
    if (!admin) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    const { requesterId, slug } = await req.json()
    if (!requesterId) return NextResponse.json({ error: '認証情報がありません' }, { status: 401 })
    if (!(await verifyAdmin(admin, requesterId))) {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }
    if (!slug) return NextResponse.json({ error: '記事が指定されていません' }, { status: 400 })

    const key = process.env.OPENAI_API_KEY
    if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY が設定されていません' }, { status: 500 })

    const { data: post } = await admin.from('posts').select('id, slug, title, content').eq('slug', slug).maybeSingle()
    if (!post) return NextResponse.json({ error: '記事が見つかりません' }, { status: 404 })

    // 1. 生成
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + key },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: buildPrompt(post.slug, post.title),
        size: SIZE,
        n: 1,
      }),
    })
    if (!res.ok) {
      return NextResponse.json({ error: '画像の生成に失敗しました: ' + (await res.text()).slice(0, 200) }, { status: 502 })
    }
    const b64 = (await res.json())?.data?.[0]?.b64_json
    if (!b64) return NextResponse.json({ error: '生成結果を読み取れませんでした' }, { status: 502 })

    // 2. ストレージへ保存。差し替えのたびに新しい名前にする
    //    （同じ名前だと、見ている人のブラウザに古い絵が残る）
    const path = `covers/${post.slug}-${Date.now()}.png`
    const up = await admin.storage.from('blog-images')
      .upload(path, Buffer.from(b64, 'base64'), { contentType: 'image/png', upsert: true })
    if (up.error) return NextResponse.json({ error: '保存に失敗しました: ' + up.error.message }, { status: 500 })
    const url = admin.storage.from('blog-images').getPublicUrl(path).data.publicUrl

    // 3. 本文の1枚目の画像を差し替える。画像が無ければ先頭に足す
    const content = String(post.content ?? '')
    const first = content.match(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/)
    const alt = first?.[1] || post.title
    const next = first
      ? content.replace(first[0], `![${alt}](${url})`)
      : `![${post.title}](${url})\n\n${content}`

    const { error: upErr } = await admin.from('posts')
      .update({ content: next, updated_at: new Date().toISOString() }).eq('id', post.id)
    if (upErr) return NextResponse.json({ error: '記事の更新に失敗しました: ' + upErr.message }, { status: 500 })

    return NextResponse.json({ success: true, url, replaced: !!first })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : '不明なエラー' }, { status: 500 })
  }
}
