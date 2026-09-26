import { NextResponse } from 'next/server'
import { requireCaller, denyNotAdmin, roleCheckFailedResponse } from '../../../lib/apiAuth'

// メッセージを1通送る。
//
// なぜ API を通すか:
//   これまでは3つの画面（出店者・募集者・運営）がそれぞれ
//   supabase.from('messages').insert(...) を直接呼んでいた。
//   つまり送れるかどうかが messages の RLS の設定次第で、
//   「出店者から先に送られていないと、募集者からは送れない」
//   という状態になっていた。募集者から声をかけたい場面は実際にあるので、
//   権限の確認をここで行い、サービスロールで書き込む。
//
// 誰が誰に送れるか（申込1件＝スレッド1本）:
//   ・その申込の出店者本人
//   ・その案件の募集者
//   ・運営
//   それ以外は 403。相手から先に送られているかどうかは問わない。

// まとめて連絡（broadcast）と同じ上限にそろえる。
// 画面側にも同じ数字を出しているので、片方だけ変えないこと
const MAX_BODY = 2000

export async function POST(req: Request) {
  try {
    // 送信者をアクセストークンで確かめる。body のIDは信用しない。
    // 「やり取りの当事者（出店者・募集者）か運営か」で分かれるので
    // requireAdmin では足切りできない。403 の条件は申込を読んでからしか
    // 決まらないので、足切りは下に残す。
    // isAdmin は 403 のほか「取り消された申込でも運営だけは書ける」でも使う
    const ctx = await requireCaller(req, undefined, 'ログインが必要です')
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx
    const uid = caller.uid
    const isAdmin = caller.isAdmin

    const { applicationId, body, fileUrl, direct, receiverId } = await req.json()
    const text = String(body ?? '').trim()
    // 案件に紐づかない「運営 ↔ 募集者」の直接のやり取り（2026-09-26 の依頼）。
    //   運営 → 募集者 … direct: true, receiverId: 募集者のID
    //   募集者 → 運営 … direct: true（宛先は運営なので receiverId は無し）
    const isDirect = direct === true
    if (!isDirect && !applicationId) return NextResponse.json({ error: '送り先が指定されていません' }, { status: 400 })

    // 添付は「自分がアップロードしたもの」だけを受け付ける。
    // パスは <ユーザーID>/msg-... の形で保存している。ここを確かめないと、
    // 相手のメッセージに写っているパスを指定して他人のファイルを自分の
    // メッセージに貼れてしまい、そのまま取消しを押すと相手のファイルが消える
    let file: string | null = null
    if (fileUrl) {
      const raw = String(fileUrl)
      if (!raw.startsWith(uid + '/') || raw.includes('..')) {
        return NextResponse.json({ error: '添付ファイルの指定が不正です' }, { status: 400 })
      }
      file = raw
    }
    if (!text && !file) return NextResponse.json({ error: '本文を入力してください' }, { status: 400 })
    if (text.length > MAX_BODY) {
      return NextResponse.json(
        { error: '本文は' + MAX_BODY.toLocaleString() + '文字まででお願いします（現在 ' + text.length.toLocaleString() + '文字）' },
        { status: 400 },
      )
    }

    // ---- 直接のやり取り（案件に紐づかない） ----
    if (isDirect) {
      // 宛先を指定できるのは運営だけ。募集者が別の募集者へ送れてはいけない
      let to: string | null = null
      if (receiverId) {
        if (!isAdmin) return denyNotAdmin(caller, '宛先を指定して送れるのは運営だけです')
        // 宛先が本当に募集者かを確かめる。出店者へこの経路で送ると、
        // 相手の画面（案件ごとのやり取り）には出ないまま届いたことになる
        const { data: rcv, error: rErr } = await db
          .from('profiles').select('id, role').eq('id', String(receiverId)).maybeSingle()
        if (rErr) return NextResponse.json({ error: '宛先を読み込めませんでした' }, { status: 500 })
        if (!rcv) return NextResponse.json({ error: '宛先が見つかりません' }, { status: 404 })
        if (rcv.role !== 'host') return NextResponse.json({ error: 'この送り方は募集者あてだけです' }, { status: 400 })
        to = rcv.id
      } else {
        // 宛先なし＝運営あて。募集者からの返信に使う。
        // 運営が宛先なしで送ると誰にも届かないので止める
        if (isAdmin) return NextResponse.json({ error: '送り先の募集者を指定してください' }, { status: 400 })
      }

      const { data, error } = await db.from('messages')
        .insert({ application_id: null, sender_id: uid, receiver_id: to, body: text, file_url: file })
        .select('id').maybeSingle()
      if (error) return NextResponse.json({ error: '送信に失敗しました: ' + error.message }, { status: 500 })
      return NextResponse.json({ success: true, id: data?.id ?? null, direct: true })
    }

    // このスレッドに書き込んでよい人かを確かめる
    const { data: app, error: aErr } = await db
      .from('applications')
      .select('id, seller_id, place_id, status, places(host_id)')
      .eq('id', applicationId).maybeSingle()
    if (aErr) {
      console.error('申込の取得に失敗しました', aErr.message)
      return NextResponse.json({ error: '送り先を読み込めませんでした。時間をおいてお試しください' }, { status: 500 })
    }
    if (!app) return NextResponse.json({ error: '送り先が見つかりません' }, { status: 404 })

    const hostId = (app as unknown as { places?: { host_id?: string } }).places?.host_id || null
    const canSend = isAdmin || uid === app.seller_id || (hostId && uid === hostId)
    if (!canSend) {
      // 当事者なら役割を見ずに通る。運営でないと通らないと決まった今だけ、
      // 役割が読めていたかを確かめる（読めていなければ 403 ではなく 503）
      return denyNotAdmin(caller, 'このやり取りに書き込む権限がありません')
    }

    // 取り消した出店は、取り消したその場で行ごと消える
    // （app/api/applications/cancel-approved/route.ts）。やり取りも一緒に消え、
    // 消す直前に purge_log の控えへ写している。行が無くなったあとは
    // 上の404で止まるので、運営も送れない。
    //
    // ここに来るのは、削除だけ失敗して取消し済みで残った出店。
    // 当事者どうしで続けると、あとから運営が確認できないまま消えるので止める。
    // 運営は続けられる（キャンセル料の話などを残す必要がある）
    if (app.status === 'cancelled' && !isAdmin) {
      // ここから先は運営だけが通る枝。役割が読めていなければ、
      // 「運営ではない」と決めつけずに 503 を返す
      if (caller.roleError) return roleCheckFailedResponse()
      return NextResponse.json(
        { error: 'この出店は取り消されています。お手数ですが運営（info@connect-navi.com）へご連絡ください' },
        { status: 409 },
      )
    }

    const { data, error } = await db.from('messages')
      .insert({ application_id: applicationId, sender_id: uid, body: text, file_url: file })
      .select('id').maybeSingle()
    if (error) {
      return NextResponse.json({ error: '送信に失敗しました: ' + error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.id ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
