import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'

// 案件の公開／下書きを管理者が切り替える。
// places の UPDATE も RLS で無言のうちに弾かれるおそれがあるため、
// 登録・承認と同じくサービスロールで実行する。
//
// 呼び出し元の判定は body の requesterId をやめ、アクセストークンに変えた。
// 公開中の案件を下書きに落とせる入口なので、申告されたIDを信じると
// 応募導線を止める（サービス妨害）ことができてしまう。

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
    const admin = auth.db

    const { placeId, status } = await req.json()
    if (!placeId || !status) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }
    if (status !== 'published' && status !== 'draft') {
      return NextResponse.json({ error: '公開状態が不正です' }, { status: 400 })
    }

    const patch: { status: string; posted_at?: string } = { status }
    // 公開に切り替えたときは掲載日を更新し、一覧の新着順で上に出るようにする
    if (status === 'published') patch.posted_at = new Date().toISOString()

    const { data, error } = await admin
      .from('places')
      .update(patch)
      .eq('id', placeId)
      .select('id')
    if (error) {
      return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '対象の案件が見つかりませんでした' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
