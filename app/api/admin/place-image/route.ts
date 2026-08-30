import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCronCaller } from '../../../lib/cronAuth'

// 案件の写真を登録する。
// ストレージへの書き込みは権限が要るため、ここを通す。
// 1枚目は一覧のサムネイル（image_url）にもなる。

export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    const auth = await verifyCronCaller(req)
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const { placeId, placeTitle, imageBase64, contentType } = await req.json()
    if (!imageBase64) return NextResponse.json({ error: '画像がありません' }, { status: 400 })

    // 案件は ID か名前で指定する
    let id = placeId as string | undefined
    if (!id && placeTitle) {
      const { data } = await db.from('places').select('id').eq('title', placeTitle).limit(2)
      if (!data || data.length === 0) return NextResponse.json({ error: '案件が見つかりません: ' + placeTitle }, { status: 404 })
      if (data.length > 1) return NextResponse.json({ error: '同じ名前の案件が複数あります: ' + placeTitle }, { status: 409 })
      id = data[0].id
    }
    if (!id) return NextResponse.json({ error: '案件が指定されていません' }, { status: 400 })

    const { data: place, error: pErr } = await db.from('places').select('id, images').eq('id', id).maybeSingle()
    if (pErr || !place) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })

    const bytes = Buffer.from(String(imageBase64), 'base64')
    if (bytes.length === 0) return NextResponse.json({ error: '画像を読み取れませんでした' }, { status: 400 })
    if (bytes.length > 8 * 1024 * 1024) return NextResponse.json({ error: '画像は8MBまでです' }, { status: 400 })

    const ct = contentType === 'image/png' ? 'image/png' : 'image/jpeg'
    const ext = ct === 'image/png' ? 'png' : 'jpg'
    const path = `places/${id}/${Date.now()}.${ext}`
    const { error: uErr } = await db.storage.from('place-images').upload(path, bytes, { contentType: ct, upsert: true })
    if (uErr) return NextResponse.json({ error: 'アップロードに失敗: ' + uErr.message }, { status: 500 })

    const publicUrl = db.storage.from('place-images').getPublicUrl(path).data.publicUrl
    const images = Array.isArray(place.images) ? (place.images as string[]).filter(Boolean) : []
    images.push(publicUrl)

    const { data: upd, error: sErr } = await db.from('places')
      .update({ images, image_url: images[0] })
      .eq('id', id).select('id, title')
    if (sErr) return NextResponse.json({ error: '保存に失敗: ' + sErr.message }, { status: 500 })
    if (!upd || upd.length === 0) return NextResponse.json({ error: '保存できませんでした' }, { status: 500 })

    return NextResponse.json({ success: true, title: upd[0].title, url: publicUrl, count: images.length })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
