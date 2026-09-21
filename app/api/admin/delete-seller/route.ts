import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'

// 出店者のアカウントを、運営が完全に削除する。
//
// この入口はいちばん壊すものが大きい（auth.users ごと消え、profiles は CASCADE。
// 取り消せない）。以前は body の requesterId を profiles.role='admin' と
// 照合するだけで、運営のUUIDを知られていればログインせずに任意の会員を
// 消せる状態だった。誰として呼んでいるかはアクセストークンだけで決める。

export async function POST(req: Request) {
  try {
    // 1) 呼び出し元がログイン中の運営かをサーバー側で確かめる
    const auth = await requireAdmin(req)
    if (auth instanceof NextResponse) return auth
    const { uid, db: admin } = auth

    const { id } = await req.json()
    if (!id) {
      return NextResponse.json({ error: 'id がありません' }, { status: 400 })
    }

    // 2) 自分自身は削除させない（誤操作防止）。
    //    比べる相手はトークンから取った uid。body の値と比べていたときは、
    //    ここの守りも呼び出し側の申告次第だった
    if (id === uid) {
      return NextResponse.json({ error: '自分自身は削除できません' }, { status: 400 })
    }

    // 3) auth.users を削除（profiles は CASCADE で自動削除される）
    const { error: delErr } = await admin.auth.admin.deleteUser(id)
    if (delErr) {
      return NextResponse.json({ error: '削除に失敗しました: ' + delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
