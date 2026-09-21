import { NextResponse } from 'next/server'
import { requireCaller, roleCheckFailedResponse } from '../../../lib/apiAuth'

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
//
// 運営（profiles.role = 'admin'）はこの制限を受けない。
// 運営は出店者・募集者からの問い合わせを受けて文面を直すことがあり、
// 60分を過ぎた連絡も消す必要がある（2026-09-21 に運営から要望）。
// 出店者・募集者は60分のままにする（相手が読んだ後の記録が消えないようにするため）。
const RETRACT_LIMIT_MINUTES = 60

export async function POST(req: Request) {
  try {
    // 押した本人をアクセストークンで確かめる。body のIDは信用しない。
    // 「送信者本人か運営か」で分かれるので requireAdmin では足切りできない。
    // 引数の検査より先に見る（名乗っていない相手に「パラメータ不足」と
    // 返すと、メッセージIDの当たり外れを教えることになる）
    const ctx = await requireCaller(req, undefined, 'ログインが必要です')
    if (ctx instanceof NextResponse) return ctx
    const { caller, db: admin } = ctx
    const requesterId = caller.uid
    // 運営は取り消しの時間制限を受けない（下で使う）
    const isAdmin = caller.isAdmin

    const { messageId } = await req.json()
    if (!messageId) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
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
    if (!isAdmin && sentAt && passedMinutes > RETRACT_LIMIT_MINUTES) {
      // 時間を過ぎたあとは運営だけが通る枝。役割が読めていなければ、
      // 「運営ではない」と決めつけずに 503 を返す
      if (caller.roleError) return roleCheckFailedResponse()
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
