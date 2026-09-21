import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { requireCaller, serverConfigResponse, denyNotAdmin } from '../../../lib/apiAuth'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

const recentStatusSends = new Map<string, number>()

export async function POST(req: Request) {
  try {
    const { applicationId, status } = await req.json()
    if (!applicationId || !status) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    // 誰からの呼び出しかを確かめる。
    //
    // 承認・不採用のメールを出す入口で、DBの状態と一致するときだけ送るので
    // 偽の通知は作れないが、以前は認証が無く、申込のIDを知っていれば
    // 第三者が本物の承認・不採用メールを出店者に何度でも出させられた。
    // 状態を決めるのは運営か、その案件の募集者だけなので、そこまでに絞る。
    //
    // 判定は app/lib/apiAuth.ts の関門に寄せる（各入口に書き写すと食い違う。
    // 見る順もそのまま：トークン無し→401、鍵無し→500、検証失敗→401、
    // 検証失敗→401）。役割を読めなかったのを「運営ではない」＝403 にしないため、
    // 下の 403 は denyNotAdmin を通す）
    const ctx = await requireCaller(req)
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx
    const uid = caller.uid

    // メールの鍵は、名乗った相手だと分かってから見る
    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) return serverConfigResponse()

    // 申込 → 出店者・案件を解決
    const { data: app, error: aErr } = await db
      .from('applications').select('seller_id, place_id, apply_date, status').eq('id', applicationId).single()
    if (aErr || !app) {
      return NextResponse.json({ error: '申込取得失敗' }, { status: 500 })
    }
    // DB上の実際のステータスと一致する場合のみ送信（偽通知の防止）
    if (app.status !== status) {
      return NextResponse.json({ error: '申込の状態と一致しません' }, { status: 409 })
    }

    const placeRes = await db.from('places').select('title, host_id').eq('id', app.place_id).single()
    const placeTitle = placeRes.data?.title || '案件'

    // 運営か、その案件の募集者だけ。出店者本人には出させない（受け取る側なので）。
    // 募集者なら役割を見ずに通る。運営でないと通らないと決まった今だけ、
    // 役割が読めていたかを確かめる（読めていなければ 403 ではなく 503）
    if (uid !== placeRes.data?.host_id && !caller.isAdmin) {
      return denyNotAdmin(caller, 'この申込の通知は送れません')
    }

    const { data: seller, error: sErr } = await db
      .from('profiles').select('name, email').eq('id', app.seller_id).single()
    if (sErr || !seller || !seller.email) {
      return NextResponse.json({ error: '出店者取得失敗' }, { status: 500 })
    }
    const sellerName = seller.name || '出店者'
    const approved = status === 'approved'

    // 申込は出店希望日ごとに1件なので、どの日の結果かを本文に入れる。
    // 1社が複数日申し込むことがあり、日付が無いとどの申込か分からない。
    const dayText = (() => {
      if (!app.apply_date) return ''
      const d = new Date(app.apply_date + 'T00:00:00')
      if (Number.isNaN(d.getTime())) return String(app.apply_date)
      const w = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()]
      return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${w}）`
    })()

    // 文面は管理画面（メール文面タブ）で書き換えられる。
    // 承認と不採用で内容がまったく違うので、別々に編集できるようにしている
    const key = approved ? 'application-approved' : 'application-rejected'
    const def = MAIL_DEF_BY_KEY[key]
    const mail = await renderMail(db, key, { subject: def.subject, body: def.body }, {
      'お名前': sellerName,
      '案件名': placeTitle,
      '出店日': dayText ? '（' + dayText + '）' : '',
    })
    const subject = mail.subject
    const text = mail.text

    const dedupeKey = applicationId + '|' + status
    const prevSend = recentStatusSends.get(dedupeKey)
    if (prevSend && Date.now() - prevSend < 10000) {
      return NextResponse.json({ ok: true, deduped: true })
    }
    recentStatusSends.set(dedupeKey, Date.now())

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to: seller.email,
      subject,
      text,
    })
    if (error) {
      return NextResponse.json({ error: 'メール送信失敗: ' + error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
