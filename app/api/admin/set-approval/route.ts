import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'

// 出店者プロフィールの公開可否を管理者が更新する。
// profiles には管理者用の UPDATE ポリシーが無くクライアントからの更新が
// RLS で無言のうちに弾かれるため、サービスロールで実行する。
//
// 呼び出し元の判定は body の requesterId をやめ、アクセストークンに変えた。
// 承認は公開一覧（public_sellers）への掲載可否そのものなので、
// 申告されたIDを信じると、審査を通していない出店者を無資格で公開できてしまう。

export async function POST(req: Request) {
  try {
    // 引数の検査より先に、運営かどうかを見る
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
    const admin = auth.db

    const { targetId, status } = await req.json()
    if (!targetId || !status) {
      return NextResponse.json({ error: 'パラメータ不足' }, { status: 400 })
    }
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'status が不正です' }, { status: 400 })
    }

    const patch: { approval_status: string; approved_at?: string | null } = { approval_status: status }
    if (status === 'approved') patch.approved_at = new Date().toISOString()

    const { data, error } = await admin
      .from('profiles')
      .update(patch)
      .eq('id', targetId)
      .select('id')
    if (error) {
      return NextResponse.json({ error: '更新に失敗しました: ' + error.message }, { status: 500 })
    }
    if (!data || data.length === 0) {
      return NextResponse.json({ error: '対象の出店者が見つかりませんでした' }, { status: 404 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
