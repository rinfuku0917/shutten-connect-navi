import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 送信したメッセージを取り消す（打ち間違いの取り消し用）。
// 取り消せるのは自分が送ったメッセージのみ。相手のメッセージは消せない。
// messages に対する DELETE のポリシーが無い可能性があるため、
// 他の管理系処理と同じくサービスロールで実行し、送信者の照合はここで行う。
//
// 誰が押したかは、ログイン中のアクセストークンで確かめる。
// 以前は body の requesterId をそのまま送信者と比べていたが、それだと
// 受け取った側が「メッセージのID」と「送り主のID」を画面から拾えるため、
// ログインしていなくても、届いた連絡を消せてしまう状態だった。

// 送信から取り消せる時間（分）。やり取りの記録が後から書き換わりすぎないよう区切る。
const RETRACT_LIMIT_MINUTES = 60

export async function POST(req: Request) {
  try {
    const { messageId } = await req.json()
    if (!messageId) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }
    const admin = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 押した本人をアクセストークンで確かめる。body のIDは信用しない
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await admin.auth.getUser(token)
    const requesterId = userData?.user?.id
    if (uErr || !requesterId) {
      return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    }

    const { data: msg, error: mErr } = await admin
      .from('messages')
      .select('id, sender_id, sent_at, file_url')
      .eq('id', messageId)
      .maybeSingle()
    if (mErr) {
      return NextResponse.json({ error: 'メッセージの取得に失敗しました' }, { status: 500 })
    }
    if (!msg) {
      return NextResponse.json({ error: 'メッセージが見つかりませんでした' }, { status: 404 })
    }
    if (msg.sender_id !== requesterId) {
      return NextResponse.json({ error: '自分が送信したメッセージのみ取り消せます' }, { status: 403 })
    }

    const sentAt = msg.sent_at ? new Date(msg.sent_at).getTime() : 0
    const passedMinutes = (Date.now() - sentAt) / 60000
    if (sentAt && passedMinutes > RETRACT_LIMIT_MINUTES) {
      return NextResponse.json(
        { error: `送信から${RETRACT_LIMIT_MINUTES}分を過ぎたメッセージは取り消せません` },
        { status: 400 },
      )
    }

    // 添付ファイルも残さない。
    // ただし消すのは自分がアップロードしたものだけ。パスは
    // <ユーザーID>/msg-... の形なので、そこで確かめる。
    // ここを見ないと、他人のファイルのパスを貼ったメッセージを取り消すことで
    // 相手のファイルを消せてしまう
    if (msg.file_url && String(msg.file_url).startsWith(requesterId + '/')) {
      await admin.storage.from('message-attachments').remove([msg.file_url])
    }

    const { error: dErr } = await admin.from('messages').delete().eq('id', messageId)
    if (dErr) {
      return NextResponse.json({ error: '取り消しに失敗しました: ' + dErr.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
