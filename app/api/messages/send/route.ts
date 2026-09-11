import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// まとめて連絡（broadcast）と同じ上限にそろえる。
// 画面側にも同じ数字を出しているので、片方だけ変えないこと
const MAX_BODY = 2000

export async function POST(req: Request) {
  try {
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    // 送信者をアクセストークンで確かめる。body のIDは信用しない
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

    const { applicationId, body, fileUrl } = await req.json()
    const text = String(body ?? '').trim()
    if (!applicationId) return NextResponse.json({ error: '送り先が指定されていません' }, { status: 400 })

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

    const hostId = (app as { places?: { host_id?: string } }).places?.host_id || null
    const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
    const isAdmin = me?.role === 'admin'
    const canSend = isAdmin || uid === app.seller_id || (hostId && uid === hostId)
    if (!canSend) {
      return NextResponse.json({ error: 'このやり取りに書き込む権限がありません' }, { status: 403 })
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
