import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

const recentStatusSends = new Map<string, number>()

export async function POST(req: Request) {
  try {
    const { applicationId, status } = await req.json()
    if (!applicationId || !status) {
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

    // 申込 → 出店者・案件を解決
    const { data: app, error: aErr } = await db
      .from('applications').select('seller_id, place_id, apply_date').eq('id', applicationId).single()
    if (aErr || !app) {
      return NextResponse.json({ error: '申込取得失敗' }, { status: 500 })
    }
    const { data: seller, error: sErr } = await db
      .from('profiles').select('name, email').eq('id', app.seller_id).single()
    if (sErr || !seller || !seller.email) {
      return NextResponse.json({ error: '出店者取得失敗' }, { status: 500 })
    }
    const placeRes = await db.from('places').select('title').eq('id', app.place_id).single()
    const placeTitle = placeRes.data?.title || '案件'
    const sellerName = seller.name || '出店者'
    const approved = status === 'approved'

    const subject = approved
      ? '【出店コネクトナビ】「' + placeTitle + '」への申込が承認されました'
      : '【出店コネクトナビ】「' + placeTitle + '」への申込結果のお知らせ'

    const lines = approved
      ? [
          sellerName + ' 様',
          '',
          'ご申込いただいた「' + placeTitle + '」への出店が承認されました。',
          '',
          '担当者とメッセージでやり取りを進め、当日に向けてご準備ください。',
          'https://app.connect-navi.com/dashboard/seller',
        ]
      : [
          sellerName + ' 様',
          '',
          'ご申込いただいた「' + placeTitle + '」への出店は、今回は見送りとなりました。',
          '',
          'また他の案件へのご応募をお待ちしております。',
          'https://app.connect-navi.com/places',
        ]
    const text = lines.join('\n')

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
