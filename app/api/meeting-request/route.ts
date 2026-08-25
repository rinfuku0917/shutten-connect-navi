import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 募集者からの打ち合わせ希望。
//   action 未指定 … 申し込みの登録（募集者が使う）
//   action='list' … 一覧の取得（管理者のみ）
//   action='status' … 対応状況の更新（管理者のみ）
// meeting_requests は RLS でクライアントから触れないため、すべてここを通す。

const METHODS = ['zoom', 'in_person', 'both']

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function verifyAdmin(admin: any, requesterId: string) {
  if (!requesterId) return false
  const { data, error } = await admin.from('profiles').select('role').eq('id', requesterId).maybeSingle()
  if (error || !data || data.role !== 'admin') return false
  return true
}

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const admin = getAdmin()
    if (!admin) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    // ===== 管理者：一覧 =====
    if (body.action === 'list') {
      if (!(await verifyAdmin(admin, body.requesterId))) {
        return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
      }
      const { data, error } = await admin
        .from('meeting_requests').select('*').order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
      return NextResponse.json({ items: data || [] })
    }

    // ===== 管理者：対応状況の更新 =====
    if (body.action === 'status') {
      if (!(await verifyAdmin(admin, body.requesterId))) {
        return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
      }
      const { id, status, memo } = body
      if (!id || !['new', 'in_progress', 'done'].includes(status)) {
        return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 })
      }
      const patch: { status: string; admin_memo?: string } = { status }
      if (typeof memo === 'string') patch.admin_memo = memo
      const { data, error } = await admin
        .from('meeting_requests').update(patch).eq('id', id).select('id')
      if (error) return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
      if (!data || data.length === 0) return NextResponse.json({ error: '対象が見つかりませんでした' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    // ===== 管理者：削除 =====
    // ヒアリングが済んだ相談が溜まっていくため、不要になったものを消せるようにする。
    // 誤操作を防ぐため、対応が終わっていないものは削除できないようにしている。
    if (body.action === 'delete') {
      if (!(await verifyAdmin(admin, body.requesterId))) {
        return NextResponse.json({ error: '管理者権限がありません' }, { status: 403 })
      }
      const ids: string[] = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : [])
      if (ids.length === 0) return NextResponse.json({ error: '削除する対象がありません' }, { status: 400 })

      const { data: targets, error: tErr } = await admin
        .from('meeting_requests').select('id, status').in('id', ids)
      if (tErr) return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
      const notDone = (targets || []).filter(t => t.status !== 'done')
      if (notDone.length > 0) {
        return NextResponse.json(
          { error: '完了していない相談は削除できません（' + notDone.length + '件）。先に「完了にする」を押してください。' },
          { status: 400 },
        )
      }

      const { data: removed, error: dErr } = await admin
        .from('meeting_requests').delete().in('id', ids).select('id')
      if (dErr) return NextResponse.json({ error: '削除に失敗しました: ' + dErr.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: removed?.length ?? 0 })
    }

    // ===== 募集者：申し込みの登録 =====
    const { hostId, name, company, email, phone, method, preferredDates, message } = body
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'ご担当者名を入力してください' }, { status: 400 })
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) {
      return NextResponse.json({ error: 'メールアドレスをご確認ください' }, { status: 400 })
    }
    if (!METHODS.includes(method)) {
      return NextResponse.json({ error: '打ち合わせの方法をお選びください' }, { status: 400 })
    }

    const { error } = await admin.from('meeting_requests').insert({
      host_id: hostId || null,
      name: String(name).trim(),
      company: company ? String(company).trim() : null,
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      method,
      preferred_dates: preferredDates ? String(preferredDates).trim() : null,
      message: message ? String(message).trim() : null,
    })
    if (error) {
      return NextResponse.json({ error: '送信に失敗しました: ' + error.message }, { status: 500 })
    }

    // 運営へ通知（失敗しても申し込みは成功扱い）
    try {
      await fetch(new URL('/api/notify/new-seller', req.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'host', name: String(name).trim(),
          shop_name: company || null, email: String(email).trim(), phone: phone || null,
        }),
      })
    } catch (e) {
      console.error('打ち合わせ希望の通知に失敗しました', e)
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
