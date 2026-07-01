import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(admin: any, requesterId: string) {
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', requesterId)
    .maybeSingle()
  if (error || !data || data.role !== 'admin') return false
  return true
}

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const requesterId = formData.get('requesterId') as string | null

    if (!requesterId) return NextResponse.json({ error: '認証情報がありません' }, { status: 401 })
    if (!(await verifyAdmin(admin, requesterId))) {
      return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
    }
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