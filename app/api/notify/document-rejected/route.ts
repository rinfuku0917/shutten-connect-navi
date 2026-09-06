import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { renderMail, MAIL_DEF_BY_KEY } from '../../../lib/mailTemplates'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'

export async function POST(req: Request) {
  try {
    const { documentId } = await req.json()
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

    // 呼び出し元を確かめる。
    //
    // 以前はここに認証が無く、書類のIDを当てられれば誰でも
    // 差戻しのメールを送れる状態だった。差戻しの理由は
    // データベースの値をそのまま載せるため文面の細工はできないが、
    // 出店者に身に覚えのない通知が届くのは避ける。
    //
    // 書類の審査は運営の仕事なので、運営だけが呼べるようにする。
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    const { data: me } = await db.from('profiles').select('role').eq('id', uid).maybeSingle()
    if (me?.role !== 'admin') {
      return NextResponse.json({ error: '運営のみが操作できます' }, { status: 403 })
    }

    const { data: doc, error: dErr } = await db
      .from('seller_documents').select('seller_id, doc_type, status, reject_reason').eq('id', documentId).single()
    if (dErr || !doc) {
      return NextResponse.json({ error: '書類取得失敗' }, { status: 500 })
    }

    // DB上で差戻し済みの書類のみ送信（偽通知・本文注入の防止）
    if (doc.status !== 'rejected') {
      return NextResponse.json({ error: '書類の状態と一致しません' }, { status: 409 })
    }

    const { data: seller, error: sErr } = await db
      .from('profiles').select('name, email').eq('id', doc.seller_id).single()
    if (sErr || !seller || !seller.email) {
      return NextResponse.json({ error: '出店者取得失敗' }, { status: 500 })
    }

    const docTypeLabels: Record<string, string> = { license_front: '運転免許証（表面）', license_back: '運転免許証（裏面）', food_hygiene: '食品衛生責任者証', liability_insurance: '損害賠償保険証書', other_permit: 'その他許可証', business_permit: '営業許可証', pl_insurance: 'PL保険証券', inspection_sample: '検体（検査結果）' }
    const docLabel = docTypeLabels[doc.doc_type] || doc.doc_type || '提出書類'
    const reasonText = (doc.reject_reason && String(doc.reject_reason).trim()) ? String(doc.reject_reason).trim() : '記載なし'

    // 文面は管理画面（メール文面タブ）で書き換えられる
    const def = MAIL_DEF_BY_KEY['document-rejected']
    const mail = await renderMail(db, 'document-rejected', { subject: def.subject, body: def.body }, {
      'お名前': seller.name || 'ご担当者',
      '書類の種類': docLabel,
      '差戻しの理由': reasonText,
    })
    const subject = mail.subject
    const text = mail.text

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
