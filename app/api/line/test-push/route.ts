import { NextResponse } from 'next/server'

export async function POST() {
  try {
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
