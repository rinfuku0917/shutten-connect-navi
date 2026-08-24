import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 送信したメッセージを取り消す（打ち間違いの取り消し用）。
// 取り消せるのは自分が送ったメッセージのみ。相手のメッセージは消せない。
// messages に対する DELETE のポリシーが無い可能性があるため、
// 他の管理系処理と同じくサービスロールで実行し、送信者の照合はここで行う。

// 送信から取り消せる時間（分）。やり取りの記録が後から書き換わりすぎないよう区切る。
const RETRACT_LIMIT_MINUTES = 60

export async function POST(req: Request) {
  try {
    const { messageId, requesterId } = await req.json()
    if (!messageId || !requesterId) {
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

    // 添付ファイルも残さない
    if (msg.file_url) {
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
