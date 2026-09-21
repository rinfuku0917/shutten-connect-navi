import { NextResponse } from 'next/server'
import { requireAdmin } from '../../lib/apiAuth'

// ブログ記事の本文に挿す画像を、公開バケット（blog-images）へ上げる。
//
// 呼び出し元は formData の requesterId ではなく、Authorization ヘッダの
// アクセストークンで確かめる。requesterId は呼び出し側が自由に書ける値で、
// 運営のUUIDを知られていれば、当サイトのドメイン上に誰でも任意の
// ファイルを置ける状態だった（ストレージ濫用・不適切画像の配信）。
// トークンはヘッダで渡す（本文に入れると、multipart の組み立て次第で
// ログや中継に残りやすい）。

export async function POST(req: Request) {
  try {
    // ファイルを読む前に運営かどうかを見る。
    // 10MBの読み込みを、権限の無い相手のために行わない
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
    const admin = auth.db

    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) return NextResponse.json({ error: '画像が選択されていません' }, { status: 400 })

    // ファイルサイズ制限（10MB）
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: '画像サイズは10MBまでです' }, { status: 400 })
    }

    // 画像形式チェック
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: '画像ファイルを選択してください' }, { status: 400 })
    }

    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
    const path = 'posts/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: upErr } = await admin.storage.from('blog-images').upload(path, buffer, {
      contentType: file.type,
      upsert: false,
    })
    if (upErr) return NextResponse.json({ error: 'アップロード失敗: ' + upErr.message }, { status: 500 })

    const { data: pub } = admin.storage.from('blog-images').getPublicUrl(path)
    return NextResponse.json({ success: true, url: pub.publicUrl })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}