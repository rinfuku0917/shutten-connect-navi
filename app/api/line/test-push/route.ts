import { NextResponse } from 'next/server'
import { requireAdmin } from '../../../lib/apiAuth'

// LINE連携の確認用に、運営の LINE へテスト配信を1通出す。
//
// 宛先も文面も環境変数と固定文字列なので他人へは送れないが、
// 認証が無いままだと、URLを知った相手が回数の制限なく運営あてに
// テスト配信を送りつけられ、チャネルの送信数（無料枠）も減っていく。
// 運営しか使わない入口なので、2026-09-21 の関門（app/lib/apiAuth.ts）で運営に絞る。
// 手で叩くときは、運営でログインしたときのアクセストークンを
// Authorization: Bearer で付けること
export async function POST(req: Request) {
  try {
    const ctx = await requireAdmin(req)
    if (ctx instanceof NextResponse) return ctx

    const token = process.env.LINE_CHANNEL_ACCESS_TOKEN
    const userId = process.env.LINE_TEST_USER_ID
    if (!token || !userId) {
      return NextResponse.json({ error: '設定不足（トークンまたはユーザーID）' }, { status: 500 })
    }

    const res = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token,
      },
      body: JSON.stringify({
        to: userId,
        messages: [
          {
            type: 'text',
            text: '【出店コネクトナビ】テスト配信です。この通知が届いていれば、LINE連携は成功しています。',
          },
        ],
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      return NextResponse.json({ error: 'LINE送信失敗', detail: errText }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
