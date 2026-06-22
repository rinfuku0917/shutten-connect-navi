import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const FROM_EMAIL = 'noreply@connect-navi.com'

export async function POST(req: Request) {
  try {
    const { applicationId, senderId } = await req.json()
    if (!applicationId || !senderId) {
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

    // 申込 → 出店者・案件・ホストを解決
    const { data: app, error: aErr } = await db
      .from('applications').select('seller_id, place_id').eq('id', applicationId).single()
    if (aErr || !app) {
      return NextResponse.json({ error: '申込取得失敗' }, { status: 500 })
    }
    const { data: place } = await db
      .from('places').select('title, host_id').eq('id', app.place_id).single()
    const hostId = place?.host_id || null
    const placeTitle = place?.title || '案件'

    // 送信者から受信者を決定
    let recipientId: string | null
    let recipientIsHost = false
    if (senderId === app.seller_id) {
      recipientId = hostId
      recipientIsHost = true
    } else if (hostId && senderId === hostId) {
      recipientId = app.seller_id
    } else {
      recipientId = app.seller_id
    }
    if (!recipientId) {
      return NextResponse.json({ success: true, skipped: 'no_recipient' })
    }

    // 連投抑制: 送信者からの未読が既に複数あるなら追い通知しない
    const { count } = await db
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('application_id', applicationId)
      .eq('sender_id', senderId)
      .is('read_at', null)
    if (count && count > 1) {
      return NextResponse.json({ success: true, skipped: 'throttled' })
    }

    const { data: recipient, error: rErr } = await db
      .from('profiles').select('name, email').eq('id', recipientId).single()
    if (rErr || !recipient || !recipient.email) {
      return NextResponse.json({ error: '受信者取得失敗' }, { status: 500 })
    }

    const dashUrl = recipientIsHost
      ? 'https://shutten-connect-navi-bakv.vercel.app/dashboard/host/messages'
      : 'https://shutten-connect-navi-bakv.vercel.app/dashboard/seller'

    const subject = '【出店コネクトナビ】「' + placeTitle + '」に新しいメッセージが届きました'
    const text = [
      (recipient.name || 'ご担当者') + ' 様',
      '',
      '「' + placeTitle + '」のやり取りに、新しいメッセージが届きました。',
      '',
      'ログインしてご確認ください。',
      dashUrl,
    ].join('\n')

    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: '出店コネクトナビ <' + FROM_EMAIL + '>',
      to: recipient.email,
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
