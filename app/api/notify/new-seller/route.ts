import { NextResponse } from 'next/server'
import { notifyNewSeller } from '../../../lib/notifyNewSeller'
import { callerIp, createRateLimiter } from '../../../lib/rateLimit'

// 新しい会員の登録を運営へ知らせ、「何を見て知ったか」を記録する。
// 中身は app/lib/notifyNewSeller.ts にある（この入口はブラウザ用の受け口）。
//
// 【認証を付けられない理由】
//   呼ばれるのは会員登録（app/register）の直後。そのときはまだ
//   メールの確認が済んでいないので、本人としてログインできない。
//   アクセストークンを要求すると登録の導線が壊れる。
//
// 【代わりに連打を止める】
//   認証が無いままだと、URLを知った相手に
//     ・運営の受信箱（info@ ＋ notify_recipients の追加宛先）を埋められる
//     ・signup_sources に偽の行を積まれ、集計（管理画面の「何を見て知ったか」）が汚れる
//   という2つの害がある。個人情報は漏れない（読み出しはせず、記録とメールだけ）。
//   権限で止められないので、発信元ごとの回数で止める。
//   同じ理由で /api/auth/check-email・/api/meeting-request・/api/contact にも
//   それぞれ別の上限が付いている（記憶は関門ごとに別）。
//
// 【上限の決め方】
//   ふつうの登録は1人1回。登録し直しを入れても数回で終わる。
//   打ち合わせ希望からの通知は、HTTPではなく notifyNewSeller() を直に呼ぶので
//   この枠を使わない（サーバーのIPに集まって枠を食い潰す筋は消してある）。
//
//   ★上限に当たっても登録は止めない。
//   429 を返すが、呼び出し側は応答を見ずに先へ進む作りにしてある
//   （通知が1通届かないだけで、会員登録そのものは成立する）
const isTooMany = createRateLimiter([
  { ms: 60 * 1000, max: 5 },
  { ms: 60 * 60 * 1000, max: 30 },
])

export async function POST(req: Request) {
  try {
    // 認証が無い入口なので、中身を見るより先に回数で切る。
    // 記録もメールもしないまま返す
    if (isTooMany(callerIp(req))) {
      // 呼び出し側（app/register）は応答を見ずに先へ進むので、
      // ここで残さないと「通知が落ちた」という事実がどこにも残らない。
      // 上限が実際に何回働いているかを Vercel のログで数えられるようにする。
      // アドレスや氏名はまだ読んでいないので、個人情報は出ない
      console.warn('新規登録の通知が連打の上限に当たりました', callerIp(req))
      return NextResponse.json(
        { error: '送信が続いています。少し時間をおいてからお試しください' },
        { status: 429 },
      )
    }

    const body = await req.json()
    const res = await notifyNewSeller(body)
    if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })

    return NextResponse.json({ success: true })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
