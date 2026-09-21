import { Resend } from 'resend'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'
import { NO_SHOP_NAME } from '../../../lib/sellerNames'
import { requireCaller, denyNotAdmin } from '../../../lib/apiAuth'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

export async function POST(req: Request) {
  try {
    // 誰からの呼び出しかを確かめる。
    //
    // ここはサービスキーで profiles と places を読み、募集者へメールを出す入口。
    // 以前は認証が無く、body の sellerId をそのまま信じていたため、
    // 自分が募集者になっている案件のIDと、誰かの出店者UUIDを投げるだけで、
    // その出店者の情報を自分あてのメールとして引き出せた
    // （出店者のUUIDは公開ページから拾える）。
    // body の id は信用せず、アクセストークンの uid と合っていることを確かめる。
    // 運営が代わりに申し込むことがあるので、運営は通す。
    //
    // 「本人か運営か」を見る入口なので requireAdmin では足切りできない。
    // requireCaller で uid と役割を受け取り、403 はここで決める。
    // 引数の検査より先に見る（名乗っていない相手に「パラメータ不足」と
    // 返すと、入力の当たり外れを教えることになる）
    const ctx = await requireCaller(req)
    if (ctx instanceof NextResponse) return ctx
    const { caller, db } = ctx

    const { placeId, sellerId, dates } = await req.json()

    if (caller.uid !== sellerId && !caller.isAdmin) {
      // 本人以外に案件の存在を匂わせない書き方にしている。
      // 本人なら役割を見ずに通るので、運営でないと通らないと決まった今だけ、
      // 役割が読めていたかを確かめる（読めていなければ 403 ではなく 503）
      return denyNotAdmin(caller, 'この申込の通知は送れません')
    }

    if (!placeId || !sellerId) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    // 「その案件に、その出店者の申込が実際にあるか」を確かめる。
    //
    // 上の 403 は「名乗った sellerId が本人（か運営）か」しか見ていない。
    // 案件IDは公開ページ /places/[id] のURLそのものなので、これだけだと
    // ログイン中の出店者なら誰でも、申し込んでいない任意の案件の募集者あてに、
    // 弊社の正規ドメイン（SPF/DKIM が通る noreply@mail.connect-navi.com）から
    // メールを送れてしまう。本物の画面は applications に入れてから
    // ここを呼ぶ（app/places/[id]/PlaceDetailClient.tsx）ので、
    // 行の有無を確かめても正規の導線は壊れない。
    //
    // 見つからないときの答えは 403 と同じ文面にする。
    // 「申込は無い」と返すと、案件IDの当たり外れを教えることになる
    const { data: applied, error: apErr } = await db
      .from('applications')
      .select('apply_date')
      .eq('place_id', placeId)
      .eq('seller_id', sellerId)
      .limit(200)
    if (apErr) {
      console.error('申込の確認に失敗しました', apErr.message)
      return NextResponse.json({ error: '申込を確認できませんでした。時間をおいてお試しください' }, { status: 503 })
    }
    if (!applied || applied.length === 0) {
      return NextResponse.json({ error: 'この申込の通知は送れません' }, { status: 403 })
    }

    const apiKey = process.env.RESEND_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    // 案件 → ホストを解決
    const { data: place, error: pErr } = await db
      .from('places').select('title, host_id').eq('id', placeId).single()
    if (pErr || !place) {
      return NextResponse.json({ error: '案件取得失敗' }, { status: 500 })
    }
    const { data: host, error: hErr } = await db
      .from('profiles').select('name, email').eq('id', place.host_id).single()
    if (hErr || !host || !host.email) {
      return NextResponse.json({ error: 'ホスト取得失敗' }, { status: 500 })
    }
    // 応募者の情報。募集者へ見せるのは屋号だけ。
    //
    // 以前は「本名（屋号）」の形で、本名を先頭にして送っていた。
    // 募集者に本名を渡さないと決めたなかで、いちばん本数の多いこの経路が
    // 残っていた（2026-09-19 に出店者ご本人から申し出。app/lib/sellerNames.ts）。
    // 屋号が未登録の人は定型文にする。運営が誰か知りたいときは
    // 管理画面（申込一覧）で引ける
    const { data: seller } = await db
      .from('profiles').select('shop_name').eq('id', sellerId).single()

    const shopName = (seller?.shop_name || '').trim() || NO_SHOP_NAME

    // 希望日程は、body の配列をそのまま差し込まない。
    // fillVars（app/lib/mailTemplates.ts）は素の置換で、長さも改行も見ない。
    // body を信じると、募集者へ届くメールの本文に任意の文章・URL・改行を
    // 仕込めてしまう。実際に申し込まれている日（applications.apply_date。
    // date 列なので YYYY-MM-DD しか入らない）だけを残す。
    //
    // body の dates で絞るのは、同じ案件に前回申し込んだ日まで
    // 一緒に並べてしまわないようにするため（今回送った分だけを載せる）。
    // 日付を持たない案件は apply_date が null なので「日程指定なし」になる
    const appliedDates = new Set(
      (applied as { apply_date: string | null }[])
        .map(r => r.apply_date).filter((d): d is string => !!d),
    )
    const wanted = Array.isArray(dates) ? dates.map(d => String(d)) : []
    const sendDates = [...new Set(wanted.filter(d => appliedDates.has(d)))].sort()
    const dateList = sendDates.length > 0 ? sendDates.join('、') : '日程指定なし'

    // 文面は管理画面（メール文面タブ）で書き換えられる
    const def = MAIL_DEF_BY_KEY['new-application']
    const mail = await renderMail(db, 'new-application', { subject: def.subject, body: def.body }, {
      '宛名': host.name || 'ホスト',
      '案件名': place.title,
      '申込者': shopName,
      '希望日程': dateList,
    })
    const subject = mail.subject
    const text = mail.text

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to: host.email,
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
