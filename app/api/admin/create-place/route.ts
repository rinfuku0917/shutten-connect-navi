import { NextResponse } from 'next/server'
import { getAdminClient, requireAdmin, serverConfigResponse, type AdminClient } from '../../../lib/apiAuth'
import { verifyCronCaller, looksLikeCronKeyCall } from '../../../lib/cronAuth'

// 管理者が案件を新規登録する。
// places に管理者向けの INSERT ポリシーがあるとは限らず、クライアントから
// 直接入れると RLS で無言のうちに弾かれるおそれがあるため、
// 承認処理と同じくサービスロールで実行する。
//
// 通す相手は2つ。
//   1. ログイン中の運営（Authorization: Bearer のアクセストークン）
//   2. 移行作業などのスクリプト（運用の鍵 CRON_SECRET）
// 以前は「body に requesterId があれば運営として扱う」判定だったが、
// requesterId は呼び出し側が自由に書ける値で、持ち主である証明が無い。
// status='published' の公開ページを作れる入口なので、
// 運営のUUIDを知られただけでSEOスパムを量産できる状態だった。

export async function POST(req: Request) {
  try {
    // 鍵での呼び出しかどうかを先に見分ける。
    //
    // 鍵の突き合わせはサーバー内の文字列比較で終わる。先に requireAdmin を
    // 通すと、Authorization に載った CRON_SECRET がアクセストークンとして
    // Supabase の /auth/v1/user へ送られ、鍵の生の値が認証ログに残ってしまう。
    // でたらめな Authorization で叩かれたときに GoTrue を2回呼ぶことにもなる。
    let admin: AdminClient | null
    if (looksLikeCronKeyCall(req)) {
      const cron = await verifyCronCaller(req)
      // 鍵で呼んでいる相手には鍵側の理由を返す。
      // 運営側の 401 だけを返すと、移行スクリプトから
      // 「鍵が未設定」「鍵が違う」の区別が付かない
      if (!cron.ok) return NextResponse.json({ error: cron.error }, { status: cron.status })
      admin = getAdminClient()
    } else {
      const auth = await requireAdmin(req)
      if (auth instanceof NextResponse) return auth
      admin = auth.db
    }
    if (!admin) return serverConfigResponse()

    const body = await req.json()
    const { place } = body
    if (!place) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }
    if (!place.title || !String(place.title).trim()) {
      return NextResponse.json({ error: '案件タイトルを入力してください' }, { status: 400 })
    }
    if (place.status !== 'published' && place.status !== 'draft') {
      return NextResponse.json({ error: '公開状態が不正です' }, { status: 400 })
    }

    const num = (v: unknown) => {
      const n = parseInt(String(v ?? ''), 10)
      return Number.isFinite(n) ? n : null
    }
    const row = {
      title: String(place.title).trim(),
      host_id: place.host_id || null,
      description: place.description || null,
      recruit: place.recruit || null,
      prefecture: place.prefecture || null,
      address: place.address || null,
      place_type: place.place_type === 'event' ? 'event' : 'regular',
      genres: Array.isArray(place.genres) && place.genres.length > 0 ? place.genres : null,
      open_days: Array.isArray(place.open_days) && place.open_days.length > 0 ? place.open_days : null,
      // 開催日。日付が入っている行だけを残す
      schedule: Array.isArray(place.schedule)
        ? place.schedule.filter((d: unknown) => d && typeof (d as { date?: unknown }).date === 'string' && (d as { date: string }).date)
        : null,
      open_time: place.open_time || null,
      close_time: place.close_time || null,
      fee: place.fee || null,
      max_slots: num(place.max_slots),
      reminder_days: num(place.reminder_days) ?? 7,
      image_url: place.image_url || null,
      images: Array.isArray(place.images) ? place.images : [],
      // 出店条件（開催時間・電源・ガスなど）。案件フォームと同じ形で入れる
      details: place.details && typeof place.details === 'object' ? place.details : null,
      latitude: typeof place.latitude === 'number' ? place.latitude : null,
      longitude: typeof place.longitude === 'number' ? place.longitude : null,
      status: place.status,
      posted_at: new Date().toISOString(),
      // 手数料まわりは既定値のみ入れ、細かい設定は既存の「手数料設定」から行う
      share_tax_basis: 'as_entered',
      share_tax_rate: 8,
    }

    const { data, error } = await admin.from('places').insert(row).select('id, title')
    if (error) {
      return NextResponse.json({ error: '登録に失敗しました: ' + error.message }, { status: 500 })
    }
    return NextResponse.json({ success: true, place: data?.[0] ?? null })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
