import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'
import { NO_SHOP_NAME } from '../../../lib/sellerNames'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

export async function POST(req: Request) {
  try {
    const { placeId, sellerId, dates } = await req.json()
    if (!placeId || !sellerId) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!apiKey || !url || !serviceKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    const db = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 誰からの呼び出しかを確かめる。
    //
    // ここはサービスキーで profiles と places を読み、募集者へメールを出す入口。
    // 以前は認証が無く、body の sellerId をそのまま信じていたため、
    // 自分が募集者になっている案件のIDと、誰かの出店者UUIDを投げるだけで、
    // その出店者の情報を自分あてのメールとして引き出せた
    // （出店者のUUIDは公開ページから拾える）。
    // body の id は信用せず、アクセストークンの uid と合っていることを確かめる。
    // 運営が代わりに申し込むことがあるので、運営は通す
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    if (uid !== sellerId) {
      const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
      if (me?.role !== 'admin') {
        return NextResponse.json({ error: 'この申込の通知は送れません' }, { status: 403 })
      }
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
    const dateList = Array.isArray(dates) && dates.length > 0 ? dates.join('、') : '日程指定なし'

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
