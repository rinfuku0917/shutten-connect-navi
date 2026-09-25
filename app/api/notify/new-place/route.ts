import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { requireCaller } from '../../../lib/apiAuth'
import { sendAdminMail, ADMIN_EMAIL } from '../../../lib/notifyRecipients'
import { SITE_URL } from '../../../lib/seo'

// 募集者が案件を登録したことを運営へ知らせる。
//
// 【なぜ要るか】
//   2026-09-25 から募集者の案件は下書きで入る（承認制。
//   app/dashboard/host/new-place/page.tsx のコメント）。
//   誰も気づかないと下書きのまま埋もれ、掲載の機会をそのまま逃す。
//   「誰が公開ボタンを押すか」を人の記憶に頼らないよう、登録のたびに知らせる。
//
// 【権限】
//   呼ぶのはログイン済みの募集者なので、アクセストークンで名乗らせる
//   （AGENTS.md：呼び出し元のIDを body から受け取って権限判定に使わない）。
//   案件名などは本文から受け取るが、それは「メールに書く内容」だけで、
//   権限の判定には使わない。送り主が誰かはトークンから引く。
//
// 【失敗しても登録は止めない】
//   呼び出し側は応答を見ずに先へ進む。通知が1通落ちても案件は登録済み。

const FROM_EMAIL = 'info@connect-navi.com'

export async function POST(req: Request) {
  try {
    // 名乗りを確かめる。役割は見ない（登録できた本人が知らせるだけなので、
    // 所有だけで足りる）。db は requireCaller が用意したものを使う
    const ctx = await requireCaller(req)
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx

    const body = await req.json().catch(() => ({}))
    const title = String(body.title ?? '').trim().slice(0, 120) || '(無題)'
    const prefecture = String(body.prefecture ?? '').trim().slice(0, 20) || '(未設定)'
    const days = Number.isFinite(Number(body.days)) ? Number(body.days) : 0

    // 送り主の名前は、本文ではなくデータベースから引く（なりすまし防止）
    const { data: me } = await db
      .from('profiles')
      .select('name, shop_name, email, phone')
      .eq('id', caller.uid)
      .maybeSingle()
    const who = String(me?.shop_name || me?.name || '(名前未登録)').slice(0, 80)

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      // 鍵が無い環境では、案件の登録そのものは成功しているので 200 を返す。
      // 気づけるようにログだけ残す
      console.warn('新規案件の通知を送れませんでした（RESEND_API_KEY が未設定）', title)
      return NextResponse.json({ success: true, mailed: false })
    }

    const lines = [
      '募集者が案件を登録しました。承認制のため、まだ公開されていません。',
      '',
      `案件名　　：${title}`,
      `都道府県　：${prefecture}`,
      `日程　　　：${days}日`,
      `登録した方：${who}（${me?.email ?? 'メール未登録'} / ${me?.phone ?? '電話未登録'}）`,
      '',
      '出店料の内訳（施設の受取分・弊社の手数料）を打ち合わせのうえ、',
      '管理画面の案件一覧から「公開する」を押してください。',
      '',
      `${SITE_URL}/admin`,
    ]

    // 種別は 'contact'（運営の受信箱へ届く既存の宛先）を使う。
    // 新しい種別を足すと notify_recipients 側の設定も要るため、ここでは増やさない
    const { error } = await sendAdminMail(new Resend(apiKey), 'contact', {
      from: `出店コネクトナビ <${FROM_EMAIL}>`,
      replyTo: ADMIN_EMAIL,
      subject: `【承認待ち】募集者が案件を登録しました：${title}`,
      text: lines.join('\n'),
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, mailed: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
