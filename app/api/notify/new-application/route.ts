import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

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
    // 応募者の情報
    const { data: seller } = await db
      .from('profiles').select('name, shop_name').eq('id', sellerId).single()

    const sellerName = seller?.name || '出店者'
    const shopName = seller?.shop_name ? '（' + seller.shop_name + '）' : ''
    const dateList = Array.isArray(dates) && dates.length > 0 ? dates.join('、') : '日程指定なし'

    // 文面は管理画面（メール文面タブ）で書き換えられる
    const def = MAIL_DEF_BY_KEY['new-application']
    const mail = await renderMail(db, 'new-application', { subject: def.subject, body: def.body }, {
      '宛名': host.name || 'ホスト',
      '案件名': place.title,
      '申込者': sellerName + shopName,
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
