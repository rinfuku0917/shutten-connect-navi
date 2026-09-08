import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMailStandalone, MAIL_DEF_BY_KEY } from '../../lib/mailTemplates'
import { adminRecipients } from '../../lib/notifyRecipients'

// 公開ページ（/contact）から届くお問い合わせ。
//
// まず contacts に記録し、そのあと運営へメールを送る。この順番が大事で、
// これまではメールを送るだけだったため、届かなかった問い合わせは
// あったことすら分からなかった。記録の正本は表のほうで、
// メールは「届いたことを知らせるもの」という位置づけにする。
//
// メールの送信に失敗しても、お客様には成功を返す。
// こちらの都合で「送信に失敗しました」と出すと、同じ内容を
// 何度も送り直させることになる。記録は残っているので、
// 管理画面の一覧には出る（送信に失敗した印つきで）。

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
// お問い合わせ本文の上限。フォーム側（app/contact/page.tsx）と同じ数字にする
const MAX_MESSAGE = 5000

// contacts の表がまだ作られていないときのエラー。
// PostgREST は 42P01（テーブルが無い）と PGRST205（スキーマキャッシュに無い）を返す
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isMissingTable(error: any) {
  const code = String(error?.code ?? '')
  const msg = String(error?.message ?? '')
  return code === '42P01' || code === 'PGRST205' || msg.includes('public.contacts')
}
const MISSING_TABLE_MSG =
  'お問い合わせを保存する表がまだ作られていません。'
  + 'Supabase の SQL Editor で supabase/migrations/20260908_contacts.sql を実行してください。'

function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// 呼び出し元が本当に運営としてログインしているかを、アクセストークンで確かめる。
//
// body に入れて送られてきたIDは信用しない。それを信じると、
// 管理者のUUIDを1つ知っているだけで、ログインしていない誰でも
// お問い合わせ全件（お名前・メールアドレス・相談内容）を読めてしまう。
// 管理者のUUIDは出店者が自分の売上行（sales.accepted_by）から拾える。
//
// app/api/admin/sales-accept/route.ts と同じやり方。
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function requireAdmin(req: Request, admin: any): Promise<{ uid: string } | NextResponse> {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })

  const { data: userData, error: uErr } = await admin.auth.getUser(token)
  const uid = userData?.user?.id
  if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

  const { data: me } = await admin.from('profiles').select('role').eq('id', uid).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: '運営のみが操作できます' }, { status: 403 })

  return { uid }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // ===== 管理者：一覧・対応状況の更新・削除 =====
    // お名前とメールアドレスが入るため contacts は RLS でクライアントから触れない。
    // 管理画面からの読み書きはすべてここ（サービスロール）を通す。
    if (body.action === 'list' || body.action === 'status' || body.action === 'delete') {
      const admin = getAdmin()
      if (!admin) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
      const auth = await requireAdmin(req, admin)
      if (auth instanceof NextResponse) return auth
      const uid = auth.uid

      if (body.action === 'list') {
        const { data, error } = await admin
          .from('contacts').select('*').order('created_at', { ascending: false }).limit(500)
        if (error) {
          // 表がまだ無いときは「取得に失敗しました」だけだと何をすればいいか分からない。
          // やることをそのまま画面に出す
          if (isMissingTable(error)) {
            return NextResponse.json({ error: MISSING_TABLE_MSG, needsSetup: true }, { status: 503 })
          }
          return NextResponse.json({ error: '取得に失敗しました: ' + error.message }, { status: 500 })
        }
        return NextResponse.json({ items: data || [] })
      }

      if (body.action === 'status') {
        const { id, status, memo } = body
        if (!id) return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 })
        const patch: { status?: string; admin_memo?: string; handled_by?: string | null; handled_at?: string | null } = {}
        if (typeof status === 'string') {
          if (!['new', 'in_progress', 'done'].includes(status)) {
            return NextResponse.json({ error: 'パラメータが不正です' }, { status: 400 })
          }
          patch.status = status
          // 誰がいつ手をつけたかを残す。未対応に戻したときは消す
          patch.handled_by = status === 'new' ? null : uid
          patch.handled_at = status === 'new' ? null : new Date().toISOString()
        }
        if (typeof memo === 'string') patch.admin_memo = memo.slice(0, 2000)
        if (Object.keys(patch).length === 0) {
          return NextResponse.json({ error: '更新する内容がありません' }, { status: 400 })
        }
        const { data, error } = await admin.from('contacts').update(patch).eq('id', id).select('id')
        if (error) return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
        if (!data || data.length === 0) return NextResponse.json({ error: '対象が見つかりませんでした' }, { status: 404 })
        return NextResponse.json({ success: true })
      }

      // 削除。対応が終わっていないものは消せないようにして、取りこぼしを防ぐ
      const ids: string[] = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : [])
      if (ids.length === 0) return NextResponse.json({ error: '削除する対象がありません' }, { status: 400 })
      const { data: targets, error: tErr } = await admin.from('contacts').select('id, status').in('id', ids)
      if (tErr) return NextResponse.json({ error: '取得に失敗しました' }, { status: 500 })
      const notDone = (targets || []).filter((t: { status: string }) => t.status !== 'done')
      if (notDone.length > 0) {
        return NextResponse.json(
          { error: '完了していないお問い合わせは削除できません（' + notDone.length + '件）。先に「完了にする」を押してください。' },
          { status: 400 },
        )
      }
      const { data: removed, error: dErr } = await admin.from('contacts').delete().in('id', ids).select('id')
      if (dErr) return NextResponse.json({ error: '削除に失敗しました: ' + dErr.message }, { status: 500 })
      return NextResponse.json({ success: true, deleted: removed?.length ?? 0 })
    }

    // ===== 公開ページ：お問い合わせの受付 =====
    const { name, email, message } = body

    if (!name || !email || !message) {
      return NextResponse.json({ error: '必須項目が未入力です' }, { status: 400 })
    }
    if (!String(email).includes('@')) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
    }

    const nm = String(name).trim()
    const em = String(email).trim()
    const msg = String(message).trim()

    // 長すぎるものは受け付けない。黙って切ると、お客様には「送信できた」と見えたまま
    // 末尾が消える。切るのではなく、その場で知らせて書き直してもらう
    if (nm.length > 200) {
      return NextResponse.json({ error: 'お名前は200文字まででお願いします' }, { status: 400 })
    }
    if (em.length > 200) {
      return NextResponse.json({ error: 'メールアドレスをご確認ください' }, { status: 400 })
    }
    if (msg.length > MAX_MESSAGE) {
      return NextResponse.json(
        { error: 'お問い合わせ内容は' + MAX_MESSAGE.toLocaleString() + '文字まででお願いします（現在 ' + msg.length.toLocaleString() + '文字）。お手数ですが、分けてお送りください。' },
        { status: 400 },
      )
    }

    // 先に記録する。メールより前に置くのは、
    // 送信に失敗しても問い合わせが消えないようにするため
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let db: any = null
    let rowId: string | null = null
    if (url && serviceKey) {
      db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
      const { data, error } = await db
        .from('contacts').insert({ name: nm, email: em, message: msg }).select('id').maybeSingle()
      if (error) {
        // 記録に失敗してもメールは送る。少なくとも運営には届く
        console.error('お問い合わせの記録に失敗しました', error.message)
      } else {
        rowId = data?.id ?? null
      }
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      // メールが送れない設定でも、記録できていれば受け付けたことにする。
      // お客様に入力し直させないため
      if (rowId) return NextResponse.json({ success: true })
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    // 文面は管理画面（メール文面タブ）で書き換えられる
    const def = MAIL_DEF_BY_KEY['contact']
    const mail = await renderMailStandalone('contact', { subject: def.subject, body: def.body }, {
      'お名前': nm,
      'メールアドレス': em,
      '内容': msg,
    })

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to: await adminRecipients('contact'),
      replyTo: em,
      subject: mail.subject,
      text: mail.text,
    })

    if (error) {
      const emsg = String(error.message || error)
      if (db && rowId) {
        await db.from('contacts').update({ mail_sent: false, mail_error: emsg.slice(0, 500) }).eq('id', rowId)
      }
      // 記録できているなら、お客様には受け付けたことを返す。
      // 管理画面の一覧には「メール未送信」の印つきで出る
      if (rowId) return NextResponse.json({ success: true })
      return NextResponse.json({ error: 'メール送信失敗: ' + emsg }, { status: 500 })
    }

    if (db && rowId) await db.from('contacts').update({ mail_sent: true }).eq('id', rowId)
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
