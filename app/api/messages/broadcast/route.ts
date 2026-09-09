import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

// 案件に応募している出店者へ、まとめて連絡する。
//
// なぜ要るか:
//   1対1のやり取りは前からできる（募集者のメッセージ画面）。
//   ただ「搬入時間が変わりました」「駐車場の場所が決まりました」のような
//   全員に同じことを伝えたい連絡を、応募者の数だけ書き写すのは現実的でない。
//   実際には公式LINEで流していて、サイトの中で完結していなかった。
//
// 送り先は、その案件に応募している出店者。ひとりずつのスレッドに
// 同じ本文を入れるので、受け取る側から見ればふだんのメッセージと変わらない
// （返信もそのまま1対1で返ってくる）。
//
// 送り先の決め方が大事:
//   ・申込は出店日ごとに1行できる。1つの案件が31日まで日程を持てるので、
//     status だけで拾うと「先月出店して終わった人」まで宛先に入る。
//     既定はこれからの出店日（今日以降）に限る。
//   ・同じ出店者が複数日に申し込んでいたら、いちばん近い出店日の
//     スレッドに入れる（並び順を決めておかないと、毎回違うスレッドに入る）。
//
// 誰が使えるか:
//   ・その案件の募集者
//   ・運営
//   出店者からは使えない（出店者どうしが繋がる経路を作らない）。

// 宛先の数だけメールを1通ずつ送るため、既定の実行時間では足りないことがある
export const maxDuration = 300

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
const MAX_BODY = 2000
// 送信の間隔。Resend には秒あたりの上限があり、続けて投げると弾かれる
const SEND_INTERVAL_MS = 600
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getAdmin(): any {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) return null
  return createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
}

// 日本時間の今日（YYYY-MM-DD）。出店日は日本の日付で入っている
function todayJst(): string {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  return jst.toISOString().slice(0, 10)
}

// 同じ本文を続けて送ってしまったときの取りこぼし防止。
// サーバーが入れ替わると消えるので、これだけに頼らない
const recentSends = new Map<string, number>()
const RESEND_WINDOW_MS = 60 * 1000

export async function POST(req: Request) {
  try {
    const db = getAdmin()
    if (!db) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })

    // 呼び出し元をアクセストークンで確かめる
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })

    const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
    const isAdmin = me?.role === 'admin'

    const { placeId, body, target, scope, preview } = await req.json()
    const text = String(body ?? '').trim()
    if (!placeId) return NextResponse.json({ error: '案件が指定されていません' }, { status: 400 })
    // 宛先の下見のときは本文が空でもよい
    if (!preview) {
      if (!text) return NextResponse.json({ error: '本文を入力してください' }, { status: 400 })
      if (text.length > MAX_BODY) {
        return NextResponse.json(
          { error: '本文は' + MAX_BODY.toLocaleString() + '文字まででお願いします（現在 ' + text.length.toLocaleString() + '文字）' },
          { status: 400 },
        )
      }
    }

    // その案件の募集者か、運営だけが送れる
    const { data: place, error: pErr } = await db
      .from('places').select('id, title, host_id').eq('id', placeId).maybeSingle()
    if (pErr) {
      console.error('案件の取得に失敗しました', pErr.message)
      return NextResponse.json({ error: '案件を読み込めませんでした。時間をおいてお試しください' }, { status: 500 })
    }
    if (!place) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    if (!isAdmin && place.host_id !== uid) {
      return NextResponse.json({ error: 'この案件の募集者だけが送れます' }, { status: 403 })
    }

    // 送り先。
    //   target: 'approved'（承認した出店者だけ）/ 'all'（審査中も含む）
    //   scope:  'upcoming'（これからの出店日。既定）/ 'past'（終わった日も含む）
    const wantAll = target === 'all'
    const statuses = wantAll ? ['approved', 'pending'] : ['approved']
    const includePast = scope === 'past'

    let q = db
      .from('applications')
      .select('id, seller_id, status, apply_date')
      .eq('place_id', placeId)
      .in('status', statuses)
      // 出店日の近い順。並び順を決めておかないと、
      // 同じ人が複数日に申し込んでいるとき毎回違うスレッドに入る
      .order('apply_date', { ascending: true })
    if (!includePast) q = q.gte('apply_date', todayJst())
    const { data: apps, error: aErr } = await q
    if (aErr) {
      console.error('申込の取得に失敗しました', aErr.message)
      return NextResponse.json({ error: '送り先を読み込めませんでした。時間をおいてお試しください' }, { status: 500 })
    }
    if (!apps || apps.length === 0) {
      return NextResponse.json({
        error: '送り先がありません（'
          + (includePast ? '' : 'これから出店予定の')
          + (wantAll ? '応募' : '承認済みの出店') + 'が見つかりません）',
      }, { status: 400 })
    }

    // 同じ出店者が複数日に申し込んでいることがある。
    // 全部のスレッドに入れると同じ文が何通も並ぶので、出店者ごとに1つに絞る。
    // 上で出店日の近い順に並べているので、いちばん近い日のスレッドに入る
    const oneBySeller = new Map<string, string>()
    const daysBySeller = new Map<string, string[]>()
    for (const a of apps) {
      if (!a.seller_id) continue
      if (!oneBySeller.has(a.seller_id)) oneBySeller.set(a.seller_id, a.id)
      const list = daysBySeller.get(a.seller_id) || []
      if (a.apply_date) list.push(a.apply_date)
      daysBySeller.set(a.seller_id, list)
    }
    const sellerIds = Array.from(oneBySeller.keys())

    // 宛先の下見。送る前に「誰に届くか」を画面で確かめてもらう
    if (preview) {
      const { data: profs } = await db
        .from('public_sellers').select('id, shop_name, name').in('id', sellerIds)
      const nameOf = new Map((profs || []).map((p: { id: string; shop_name?: string; name?: string }) =>
        [p.id, p.shop_name || p.name || '（名称未設定）']))
      return NextResponse.json({
        preview: true,
        placeTitle: place.title || '',
        count: sellerIds.length,
        recipients: sellerIds.map(id => ({
          name: nameOf.get(id) || '出店者',
          days: (daysBySeller.get(id) || []).slice(0, 6),
        })),
      })
    }

    // 同じ本文を続けて送ってしまうのを止める
    const dedupeKey = String(placeId) + '|' + String(uid) + '|' + text.slice(0, 200)
    const nowTs = Date.now()
    const lastTs = recentSends.get(dedupeKey)
    if (lastTs && nowTs - lastTs < RESEND_WINDOW_MS) {
      return NextResponse.json({
        error: '同じ内容を直前に送っています。重ねて届くのを防ぐため、1分ほどおいてからお試しください',
      }, { status: 429 })
    }
    recentSends.set(dedupeKey, nowTs)
    if (recentSends.size > 300) {
      for (const [k, t] of recentSends) if (nowTs - t > RESEND_WINDOW_MS) recentSends.delete(k)
    }

    const rows = Array.from(oneBySeller.values()).map(appId => ({
      application_id: appId, sender_id: uid, body: text,
    }))
    const { error: iErr } = await db.from('messages').insert(rows)
    if (iErr) {
      recentSends.delete(dedupeKey)
      return NextResponse.json({ error: '送信に失敗しました: ' + iErr.message }, { status: 500 })
    }

    // 受け取った人へメールで知らせる。
    // 1通ずつ送る（宛先をまとめると、誰に送ったかが相手に見えてしまう）
    let mailed = 0
    const failed: string[] = []
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      // メッセージは入っているので、送信そのものは成功として返す。
      // ただしメールが0通であることは画面に出す
      return NextResponse.json({
        success: true, sent: rows.length, mailed: 0, mailSkipped: true,
        placeTitle: place.title || '',
      })
    }

    const { data: profs } = await db
      .from('profiles').select('id, name, email').in('id', sellerIds)
    const resend = new Resend(apiKey)
    const def = MAIL_DEF_BY_KEY['new-message']
    let first = true
    for (const p of profs || []) {
      if (!p.email) { failed.push(p.name || '(名前なし)'); continue }
      if (!first) await sleep(SEND_INTERVAL_MS)
      first = false
      try {
        const mail = await renderMail(db, 'new-message', { subject: def.subject, body: def.body }, {
          '宛名': p.name || 'ご担当者',
          '案件名': place.title || '案件',
          '案内文': '下のリンクを開くと、マイページの「メッセージ」が開きます。',
          'メッセージ画面のURL': 'https://app.connect-navi.com/dashboard/seller?tab=messages',
        })
        const { error } = await resend.emails.send({
          from: '出店コネクトナビ <' + FROM_EMAIL + '>',
          to: p.email, subject: mail.subject, text: mail.text,
        })
        if (error) {
          failed.push(p.name || p.email)
          console.error('まとめて連絡の通知に失敗しました', p.email, error.message)
        } else {
          mailed += 1
        }
      } catch (e) {
        failed.push(p.name || p.email)
        console.error('まとめて連絡の通知に失敗しました', p.email, e)
      }
    }

    return NextResponse.json({
      success: true, sent: rows.length, mailed,
      failed: failed.slice(0, 20), failedCount: failed.length,
      placeTitle: place.title || '',
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
