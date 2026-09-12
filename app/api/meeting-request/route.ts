import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { CONTACT_SOURCES, CONTACT_HISTORIES, asksRepName } from '../../lib/signupSource'

// 募集者からの打ち合わせ希望。
//   action 未指定 … 申し込みの登録（募集者が使う）
//   action='list' … 一覧の取得（管理者のみ）
//   action='status' … 対応状況の更新（管理者のみ）
// meeting_requests は RLS でクライアントから触れないため、すべてここを通す。

const METHODS = ['zoom', 'in_person', 'both']

// 呼び出し元が本当に運営としてログインしているかを、アクセストークンで確かめる。
//
// 以前は body に入ったIDを profiles で引くだけだったが、それだと
// 管理者のUUIDを知っているだけで、ログインしていない誰でも
// 打ち合わせ希望の一覧（ご担当者名・会社名・メール・電話・ご相談内容）を読めた。
// 管理者のUUIDは出店者が自分の売上行（sales.accepted_by）から拾える。
//
// app/api/admin/sales-accept/route.ts と同じやり方に揃える。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(req: Request, admin: any): Promise<true | NextResponse> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: userData, error: uErr } = await admin.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

  const { data: me } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: '運営のみが操作できます' }, { status: 403 })

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
      const auth = await requireAdmin(req, admin)
      if (auth instanceof NextResponse) return auth
      const { data, error } = await admin
        .from('meeting_requests').select('*').order('created_at', { ascending: false })
      if (error) return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
      return NextResponse.json({ items: data || [] })
    }

    // ===== 管理者：対応状況の更新 =====
    if (body.action === 'status') {
      const auth = await requireAdmin(req, admin)
      if (auth instanceof NextResponse) return auth
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
      const auth = await requireAdmin(req, admin)
      if (auth instanceof NextResponse) return auth
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
    const { hostId, name, company, email, phone, method, preferredDates, message, foundVia, foundNote, contactHistory, repName } = body
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: 'ご担当者名を入力してください' }, { status: 400 })
    }
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email).trim())) {
      return NextResponse.json({ error: 'メールアドレスをご確認ください' }, { status: 400 })
    }
    if (!METHODS.includes(method)) {
      return NextResponse.json({ error: '打ち合わせの方法をお選びください' }, { status: 400 })
    }

    // ---- きっかけとやり取りの履歴 ----
    //
    // 画面から来た文字をそのまま入れない。一覧にある値だけを受け付ける。
    // 一覧に無い値は「未回答」として扱い、相談そのものは通す
    // （選択肢を変えたあとに古い画面から送られても、相談を落とさないため）。
    const via = CONTACT_SOURCES.some(o => o.value === foundVia) ? String(foundVia) : null
    const hist = CONTACT_HISTORIES.some(o => o.value === contactHistory) ? String(contactHistory) : null
    const note = typeof foundNote === 'string' ? foundNote.trim().slice(0, 200) : ''
    // 担当者名は、たずねる選択のときだけ残す。
    // 画面で切り替えたあとの取り残しをここでも落とす
    const rep = (hist && asksRepName(hist) && typeof repName === 'string')
      ? repName.trim().slice(0, 100) : ''

    const { error } = await admin.from('meeting_requests').insert({
      host_id: hostId || null,
      name: String(name).trim(),
      company: company ? String(company).trim() : null,
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      method,
      preferred_dates: preferredDates ? String(preferredDates).trim() : null,
      message: message ? String(message).trim() : null,
      found_via: via, found_note: note || null,
      contact_history: hist, rep_name: rep || null,
    })
    if (error) {
      // 列がまだ無い環境（20260912_meeting_source.sql を実行する前）でも
      // 相談を落とさない。経路なしで入れ直す
      console.error('相談の記録に失敗しました', error.message)
      const { error: e2 } = await admin.from('meeting_requests').insert({
        host_id: hostId || null,
        name: String(name).trim(),
        company: company ? String(company).trim() : null,
        email: String(email).trim(),
        phone: phone ? String(phone).trim() : null,
        method,
        preferred_dates: preferredDates ? String(preferredDates).trim() : null,
        message: message ? String(message).trim() : null,
      })
      if (e2) {
        return NextResponse.json({ error: '送信に失敗しました: ' + e2.message }, { status: 500 })
      }
    }

    // 運営へ通知（失敗しても申し込みは成功扱い）
    try {
      await fetch(new URL('/api/notify/new-seller', req.url).toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: 'host', name: String(name).trim(),
          shop_name: company || null, email: String(email).trim(), phone: phone || null,
          // どこ経由で来たか・すでに関係がある方かを通知にも載せる。
          // 折り返す前に分かっているほうが、話の入り方が変わる
          found_via: via, found_note: note || null,
          contact_history: hist, rep_name: rep || null,
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
