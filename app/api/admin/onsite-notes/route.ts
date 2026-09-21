import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'

// 出店枠ごとの現場メモの読み書き。運営だけが使う。
//
// onsite_notes は RLS を有効にしたうえでポリシーを作っていないため、
// ブラウザからは一切触れない。サービスロールを持つここだけが読み書きできる。
// （supabase/migrations/20260905_onsite_notes.sql 参照）
//
// 呼び出し元は app/lib/apiAuth.ts の requireAdmin で、必ずアクセストークンから確かめる。
// body に入っているIDは信用しない（名乗るだけで運営になれてしまうため）。

// この出店枠のメモを、古い順に返す
export async function GET(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const applicationId = new URL(req.url).searchParams.get('applicationId') || ''
  if (!applicationId) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  const { data, error } = await db
    .from('onsite_notes')
    .select('id, body, author_id, created_at, updated_at, profiles:author_id(name)')
    .eq('application_id', applicationId)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'メモの取得に失敗: ' + error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const notes = (data || []).map((n: any) => {
    const r = n
    return {
      id: r.id,
      body: r.body,
      authorName: r.profiles?.name || '運営',
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }
  })
  return NextResponse.json({ notes })
}

// メモを1件足す
export async function POST(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db, uid } = ctx

  const { applicationId, body } = await req.json()
  const text = typeof body === 'string' ? body.trim() : ''
  if (!applicationId || !text) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  // 対象の出店枠が実在するか確かめてから入れる。
  // 存在しないIDで書き込まれると、どこからも見えないメモが溜まる
  const { data: app } = await db
    .from('applications')
    .select('id')
    .eq('id', applicationId)
    .maybeSingle()
  if (!app) return NextResponse.json({ error: '対象の出店が見つかりません' }, { status: 404 })

  const { data, error } = await db
    .from('onsite_notes')
    .insert({ application_id: applicationId, body: text, author_id: uid })
    .select('id, body, created_at, updated_at')
    .single()
  if (error) return NextResponse.json({ error: 'メモの保存に失敗: ' + error.message }, { status: 500 })

  return NextResponse.json({ note: { id: data.id, body: data.body, createdAt: data.created_at, updatedAt: data.updated_at } })
}

// メモを直す
export async function PATCH(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const { id, body } = await req.json()
  const text = typeof body === 'string' ? body.trim() : ''
  if (!id || !text) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  const { error } = await db.from('onsite_notes').update({ body: text }).eq('id', id)
  if (error) return NextResponse.json({ error: 'メモの更新に失敗: ' + error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

// メモを消す
export async function DELETE(req: Request) {
  const ctx = await requireAdmin(req)
  if (ctx instanceof NextResponse) return ctx
  const { db } = ctx

  const id = new URL(req.url).searchParams.get('id') || ''
  if (!id) return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })

  const { error } = await db.from('onsite_notes').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'メモの削除に失敗: ' + error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
