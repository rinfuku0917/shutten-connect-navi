import { createHmac, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { getAdminClient } from '../../../lib/apiAuth'

// LINE からの Webhook の受け口。
//
// 【なぜ署名を見るか】
//   この入口は誰でも叩ける。届いた本文の source.userId をそのまま
//   サービスロール（RLSを通さない）で line_debug に書いていたので、
//   URLを知った人が任意の user_id を好きなだけ流し込めた。
//   本当に LINE から来た通知かどうかは、LINE が付ける
//   x-line-signature を照合するしか確かめようがない。
//   LINE の仕様どおり、生の本文に対して HMAC-SHA256（鍵は Channel secret）を
//   計算し、base64 にしたものを比べる。
//
// 【鍵を入れると自動で厳しくなる作りにしている理由】
//   2026-09-21 時点で、本番の環境変数には LINE_CHANNEL_ACCESS_TOKEN と
//   LINE_TEST_USER_ID はあるが LINE_CHANNEL_SECRET が無い。
//   ここで署名を必須にすると全イベントが 401 になり、LINE 側は応答が続けて
//   失敗した Webhook を自分で無効化するので、連携が黙って止まってしまう。
//   そのため、
//     ・LINE_CHANNEL_SECRET がある → 合わないものは 401 で断る
//     ・無い                       → 従来どおり 200 で受け取るが、line_debug には書かず、
//                                    確認していないことをサーバーログ
//                                    （Vercel の Logs）に必ず残す
//   鍵を入れた時点で自動的に厳しくなる。
//   鍵が無いときに書き込みまでしないのは、環境変数が環境ごとの設定で、
//   Production だけに入れて Preview に入れ忘れる形があるため。
//   プレビューのURLは推測しやすく、同じ Supabase を指しているので、
//   「受け取るが書かない」にしておけば、連携を止めずに
//   確かめていない書き込みだけを塞げる。
//   その代わり、鍵を入れるまで line_debug には何も溜まらない
//   （user_id を控えたいときは、先に鍵を入れること）。
//
// 【鍵を入れる手順】
//   LINE Developers → 対象チャネル → Basic settings の Channel secret をコピーし、
//   Vercel の Settings → Environment Variables に LINE_CHANNEL_SECRET として追加、
//   その後デプロイし直す（環境変数は再デプロイまで反映されない）。
//   ・LINE_CHANNEL_ACCESS_TOKEN を発行したのと同じチャネルの Channel secret を入れること
//     （この案件には LINE の受け口が別にもある。経理シートの Apps Script が持つ
//     doPost は別のチャネルなので、そちらの secret を入れても合わない）
//   ・Preview でも使うなら、Production だけでなく Preview 側にも入れる
//   ・入れたあと、LINE Developers の Webhook settings の「検証」が
//     成功することを必ず確かめる（鍵が1文字違うと、正規の通知が全件 401 になる）

// node:crypto と生の本文が要るので Node ランタイムで動かす。
// 既定も nodejs だが、Edge に移すと壊れることを明示しておく
export const runtime = 'nodejs'

/**
 * x-line-signature を照合する。
 *
 * 中身の照合を1文字ずつの比較で早く抜けないよう、timingSafeEqual で比べる
 * （長さが違うときは timingSafeEqual が例外を投げるので、先に不一致として返す。
 * 長さが漏れるのは避けようがなく、署名の長さは常に同じなので実害はない）。
 *
 * base64 を復号したバイト列ではなく、base64 の文字列のまま比べている。
 * Buffer.from(s, 'base64') は詰め物（=）より後ろを黙って捨てるので、
 * バイト列で比べると、正しい署名の末尾に文字を足しただけのものまで
 * 通ってしまう（手元の確認で実際に通った）。
 * LINE が送ってくるのは詰め物付きの標準の base64 なので、
 * 文字列のまま比べるのがいちばん厳しい
 */
function verifySignature(rawBody: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(Buffer.from(rawBody, 'utf8')).digest('base64')
  const given = Buffer.from(signature, 'utf8')
  const want = Buffer.from(expected, 'utf8')
  if (given.length !== want.length) return false
  return timingSafeEqual(given, want)
}

type LineEvent = { source?: { userId?: string } }

export async function POST(req: Request) {
  // 署名は「送られてきた本文そのまま」に対して計算する決まりなので、
  // req.json() ではなく文字列で受け取り、JSON への変換は自分で行う
  let raw = ''
  try {
    raw = await req.text()
  } catch {
    return NextResponse.json({ ok: true })
  }

  // 前後の空白・改行を落としてから鍵として使う。
  // 環境変数に貼り付けるとき末尾に改行が残ることがあり、
  // 鍵が1文字汚れているだけで正規の通知が全件 401 になるため
  // （空白だけの値になった場合は、未設定と同じ扱いに落ちる）
  const secret = process.env.LINE_CHANNEL_SECRET?.trim()
  const signature = req.headers.get('x-line-signature') || ''
  let verified = false
  if (secret) {
    if (!verifySignature(raw, signature, secret)) {
      // 鍵の設定ミスと、外部からの叩きを切り分けられる材料を残す。
      // 署名そのものは秘密ではないが、全量を残す必要もないので長さと先頭だけ
      console.warn(
        'LINE Webhook の署名が一致しないため受け取りませんでした'
        + `（x-line-signature: ${signature ? signature.length + '文字 先頭 ' + signature.slice(0, 8) : 'ヘッダ無し'}）`
        + '。LINE からの通知が全件これになる場合は、鍵の貼り付け違い'
        + '（別チャネルの Channel secret・余計な文字）を疑うこと'
      )
      return NextResponse.json({ error: '署名を確認できません' }, { status: 401 })
    }
    verified = true
  } else {
    console.warn('LINE_CHANNEL_SECRET が未設定のため署名を確認していません（line_debug には書き込みません）')
  }

  // ここまで来たら、本文が壊れていても・書き込みに失敗しても 200 を返す。
  // エラーを返すと LINE が同じ通知を何度も送り直してくるため（従来どおり）。
  // 断るのは署名が合わないときだけ
  try {
    const body = JSON.parse(raw) as { events?: LineEvent[] }
    const events = Array.isArray(body?.events) ? body.events : []
    // 確かめられた通知だけを書く。鍵が無いときは 200 を返すだけで素通りさせる
    const db = verified ? getAdminClient() : null
    if (db) {
      for (const ev of events) {
        const uid = ev.source?.userId
        if (uid) {
          await db.from('line_debug').insert({ user_id: uid })
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook ready' })
}
