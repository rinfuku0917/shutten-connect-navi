import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
// 運営あての宛先。ほかの通知（新規登録・振込報告）と同じ。
const ADMIN_EMAIL = 'info@connect-navi.com'

// 二重送信抑制（notify系と同じ方式：dedupeKey + 10秒）
const recentSends = new Map<string, number>()

export async function POST(req: Request) {
  try {
    const { applicationId } = await req.json()
    if (!applicationId) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }

    const apiKey = process.env.RESEND_API_KEY
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !serviceKey) {
      return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    }

    const db = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // 呼び出し元をアクセストークンで検証（body の id は信用しない）
    const authHeader = req.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
    if (!token) {
      return NextResponse.json({ error: '認証が必要です' }, { status: 401 })
    }
    const { data: userData, error: uErr } = await db.auth.getUser(token)
    const uid = userData?.user?.id
    if (uErr || !uid) {
      return NextResponse.json({ error: '認証に失敗しました' }, { status: 401 })
    }

    // 対象の申込を取得し、本人の申込であることを確認
    const { data: app, error: aErr } = await db
      .from('applications')
      .select('id, seller_id, place_id, apply_date, status')
      .eq('id', applicationId)
      .single()
    if (aErr || !app) {
      return NextResponse.json({ error: '申込が見つかりません' }, { status: 404 })
    }
    if (app.seller_id !== uid) {
      return NextResponse.json({ error: '自分の申込のみキャンセルできます' }, { status: 403 })
    }
    // 出店が決まったあとの取り消しは受け付けない。
    // 募集者が会場や提出書類の準備を進めているため、画面を経由しない
    // 直接の呼び出しも含めてここで止める。
    if (app.status === 'approved') {
      return NextResponse.json(
        { error: '出店が決定しているため、この画面からは辞退できません。運営（info@connect-navi.com）までご連絡ください。' },
        { status: 409 },
      )
    }

    // 募集者への通知に必要な情報を、削除前に取得
    const { data: place } = await db
      .from('places').select('title, host_id').eq('id', app.place_id).single()
    const { data: host } = place?.host_id
      ? await db.from('profiles').select('name, email').eq('id', place.host_id).single()
      : { data: null }
    const { data: seller } = await db
      .from('profiles').select('name, shop_name').eq('id', uid).single()

    // 依存する messages を先に削除してから applications を削除（FK対策）
    await db.from('messages').delete().eq('application_id', applicationId)
    const { error: dErr } = await db.from('applications').delete().eq('id', applicationId)
    if (dErr) {
      return NextResponse.json({ error: 'キャンセルに失敗しました: ' + dErr.message }, { status: 500 })
    }

    // 通知メール（送れなくてもキャンセル自体は成功扱い）。
    //
    // ・運営には必ず知らせる。案件によっては募集者が紐づいていない
    //   （host_id が未設定の取り込み案件がある）ため、運営だけが
    //   気づける経路になる。
    // ・募集者が紐づいていれば、そちらにも知らせる。
    if (apiKey) {
      const dedupeKey = String(applicationId)
      const nowTs = Date.now()
      const lastTs = recentSends.get(dedupeKey)
      if (!(lastTs && nowTs - lastTs < 10000)) {
        recentSends.set(dedupeKey, nowTs)
        if (recentSends.size > 500) {
          for (const [k, t] of recentSends) { if (nowTs - t > 60000) recentSends.delete(k) }
        }
        const placeTitle = place?.title || '案件'
        const sellerName = seller?.name || '出店者'
        const shopName = seller?.shop_name ? '（' + seller.shop_name + '）' : ''
        const dateText = app.apply_date || '日程指定なし'
        const resend = new Resend(apiKey)

        // 運営あて
        try {
          await resend.emails.send({
            from: '出店コネクトナビ <' + FROM_EMAIL + '>',
            to: ADMIN_EMAIL,
            subject: '【辞退】「' + placeTitle + '」の出店申込が取り消されました',
            text: [
              '出店者が申込を辞退しました。',
              '',
              '案件: ' + placeTitle,
              '出店者: ' + sellerName + shopName,
              '対象日程: ' + dateText,
              '辞退前の状態: ' + (app.status === 'pending' ? '承認待ち' : String(app.status)),
              '募集者: ' + (host?.name || '（案件に募集者が紐づいていません）'),
              '',
              '管理画面で最新の申込状況をご確認ください。',
              'https://app.connect-navi.com/admin',
            ].join('\n'),
          })
        } catch (e) {
          console.error('運営への辞退通知に失敗しましたが、辞退は完了しました', e)
        }

        // 募集者あて（案件に募集者が紐づいている場合だけ）
        if (host && host.email) {
          try {
            await resend.emails.send({
              from: '出店コネクトナビ <' + FROM_EMAIL + '>',
              to: host.email,
              subject: '【出店コネクトナビ】「' + placeTitle + '」の出店申込がキャンセルされました',
              text: [
                (host.name || 'ご担当者') + ' 様',
                '',
                'あなたの案件「' + placeTitle + '」への出店申込が、出店者によりキャンセルされました。',
                '',
                '出店者: ' + sellerName + shopName,
                '対象日程: ' + dateText,
                '',
                'ダッシュボードで最新の申込状況をご確認ください。',
                'https://app.connect-navi.com/dashboard/host',
              ].join('\n'),
            })
          } catch (e) {
            console.error('募集者への辞退通知に失敗しましたが、辞退は完了しました', e)
          }
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
