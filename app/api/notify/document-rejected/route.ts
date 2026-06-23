import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const FROM_EMAIL = 'noreply@connect-navi.com'

export async function POST(req: Request) {
  try {
    const { documentId, reason } = await req.json()
    if (!documentId) {
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

    const { data: doc, error: dErr } = await db
      .from('seller_documents').select('seller_id, doc_type').eq('id', documentId).single()
    if (dErr || !doc) {
      return NextResponse.json({ error: '書類取得失敗' }, { status: 500 })
    }

    const { data: seller, error: sErr } = await db
      .from('profiles').select('name, email').eq('id', doc.seller_id).single()
    if (sErr || !seller || !seller.email) {
      return NextResponse.json({ error: '出店者取得失敗' }, { status: 500 })
    }

    const docLabel = doc.doc_type || '提出書類'
    const reasonText = (reason && String(reason).trim()) ? String(reason).trim() : '記載なし'

    const subject = '【出店コネクトナビ】提出書類について再提出のお願い'
    const text = [
      (seller.name || 'ご担当者') + ' 様',
      '',
      'ご提出いただいた書類「' + docLabel + '」を確認いたしましたが、',
      '今回は受理を見送らせていただきました。',
      '',
      '【理由】',
      reasonText,
      '',
      'お手数ですが、内容をご確認のうえ、再度ご提出をお願いいたします。',
      'https://shutten-connect-navi-bakv.vercel.app/dashboard/seller',
    ].join('\n')

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
