import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { ADMIN_EMAIL, isValidEmail } from '../../../lib/notifyRecipients'

// 運営あて通知メールの宛先の管理。
//
// これまで宛先は info@connect-navi.com の直書きだけで、担当者が
// 自分のアドレスでも受け取るにはメールサーバー側の転送に頼るしかなかった。
// ここで足したアドレスに、通知が直接届くようになる。
//
// notify_recipients は RLS 有効・ポリシー0のため、読み書きはすべてここを通す。

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// 呼び出し元をアクセストークンで確かめる。body のIDは信用しない
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(req: Request, db: any): Promise<true | NextResponse> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: userData, error: uErr } = await db.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

  const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: '運営のみが操作できます' }, { status: 403 })

  return true
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMissingTable(error: any) {
  const code = String(error?.code ?? '')
  const msg = String(error?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || msg.includes('public.notify_recipients')
}
const MISSING_TABLE_MSG =
  '通知の宛先を保存する表がまだ作られていません。'
  + 'Supabase の SQL Editor で supabase/migrations/20260908_notify_recipients.sql を実行してください。'

const FLAGS = ['on_contact', 'on_member', 'on_payment', 'on_cancel'] as const

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const auth = await requireAdmin(req, db)
    if (auth instanceof NextResponse) return auth

    // ===== 一覧 =====
    if (body.action === 'list') {
      const { data, error } = await db
        .from('notify_recipients').select('*').order('created_at', { ascending: true })
      if (error) {
        if (isMissingTable(error)) {
          return NextResponse.json({ error: MISSING_TABLE_MSG, needsSetup: true }, { status: 503 })
        }
        return NextResponse.json({ error: '取得に失敗しました: ' + error.message }, { status: 500 })
      }
      return NextResponse.json({ items: data || [] })
    }

    // ===== 追加 =====
    if (body.action === 'add') {
      const email = String(body.email ?? '').trim()
      const label = String(body.label ?? '').trim()
      // 書式は厳しめに見る。Resend は宛先の書式が不正だと送信を拒否するので、
      // ここで通してしまうと、その宛先への通知が黙って落ち続ける
      if (!isValidEmail(email)) {
        return NextResponse.json(
          { error: 'メールアドレスの形式が正しくありません。半角で「name@example.com」の形にしてください（前後の記号や全角文字は入れないでください）' },
          { status: 400 },
        )
      }
      // info@ は元から必ず届く固定の宛先。行として足すと、その行のチェックを
      // 外しても届き続けるので、画面と実際が食い違う
      if (email.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
        return NextResponse.json({ error: ADMIN_EMAIL + ' には元からすべての通知が届きます。追加は不要です' }, { status: 400 })
      }
      const { error } = await db.from('notify_recipients')
        .insert({ email, label: label ? label.slice(0, 100) : null })
      if (error) {
        if (isMissingTable(error)) {
          return NextResponse.json({ error: MISSING_TABLE_MSG, needsSetup: true }, { status: 503 })
        }
        // 一意制約。同じアドレスをもう一度足そうとしたとき
        if (String(error.code) === '23505') {
          return NextResponse.json({ error: 'そのメールアドレスはすでに登録されています' }, { status: 400 })
        }
        return NextResponse.json({ error: '追加に失敗しました: ' + error.message }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    // ===== 受け取る通知の切り替え =====
    if (body.action === 'update') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 })
      const patch: Record<string, boolean | string | null> = {}
      for (const f of FLAGS) {
        if (typeof body[f] === 'boolean') patch[f] = body[f]
      }
      if (typeof body.active === 'boolean') patch.active = body.active
      if (typeof body.label === 'string') patch.label = body.label.trim().slice(0, 100) || null
      if (Object.keys(patch).length === 0) {
        return NextResponse.json({ error: '更新する内容がありません' }, { status: 400 })
      }
      const { data, error } = await db
        .from('notify_recipients').update(patch).eq('id', id).select('id')
      if (error) return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
      if (!data || data.length === 0) return NextResponse.json({ error: '対象が見つかりませんでした' }, { status: 404 })
      return NextResponse.json({ success: true })
    }

    // ===== 削除 =====
    if (body.action === 'delete') {
      const { id } = body
      if (!id) return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 })
      const { error } = await db.from('notify_recipients').delete().eq('id', id)
      if (error) return NextResponse.json({ error: '削除に失敗しました: ' + error.message }, { status: 500 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'action が不正です' }, { status: 400 })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
