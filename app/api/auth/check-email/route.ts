import { NextResponse } from 'next/server'
import { getAdminClient } from '../../../lib/apiAuth'
import { callerIp, createRateLimiter } from '../../../lib/rateLimit'
import { hasLikeWildcard, likePattern } from '../../../lib/likeSearch'

// 登録済みメールアドレスかどうかを返す。
// Supabase の signUp は「アドレスの存在を外部に知らせない」方針のため
// 既存アドレスでもエラーを返さず成功したように見える（メールは届かない）。
// そのままだと利用者が「登録できた」と誤解するので、登録前にここで判定する。
//
// 【連打を抑える理由】
//   この入口は認証なしで呼べる（登録前・パスワード再設定前に使うので、
//   ログインを求めるわけにいかない）。1件ずつなら問題ないが、
//   アドレスを次々に投げれば「このサイトに登録があるか」を外から
//   名簿化できてしまう。そこで同じ発信元からの連打だけを抑える。
//
//   ★上限に当たっても登録・再設定を止めないこと。
//   429 を返すが、呼び出し側（app/register, app/reset-password）は
//   判定不能として扱い、そのまま先へ進む作りにしてある。

// 窓と上限。
// ふつうの登録では、1つのアドレスを1〜2回確かめるだけで終わる
// （入力し直し・戻ってやり直しを入れても数回）。1分10件・1時間60件なら
// 手で操作していて当たることはない。
// 一方、総当たりで名簿を作ろうとすると1時間に60件しか試せないので、
// 1つのIPからでは実用にならない。
//
// 数え方そのものは app/lib/rateLimit.ts にある
// （/api/notify/new-seller・/api/meeting-request・/api/contact と共通）。
// 記憶は関門ごとに別なので、ほかの入口の連打でここが止まることはない
const isTooMany = createRateLimiter([
  { ms: 60 * 1000, max: 10 },
  { ms: 60 * 60 * 1000, max: 60 },
])

export async function POST(req: Request) {
  try {
    if (isTooMany(callerIp(req))) {
      // 呼び出し側は checked:false を見て「判定できなかった」として先へ進む。
      // 文面は、万一画面に出しても意味が通るようにしておく。
      //
      // 落ちたことを1行だけ残す。上限が実際に何回働いているかを
      // Vercel のログで数えられると、上限の値を決め直す材料になる
      // （アドレスはまだ読んでいないので、個人情報は出ない）
      console.warn('メールアドレスの確認が連打の上限に当たりました', callerIp(req))
      return NextResponse.json({
        exists: false,
        checked: false,
        error: 'メールアドレスの確認が続いています。少し時間をおいてからお試しください',
      }, { status: 429 })
    }

    const { email } = await req.json()
    const addr = typeof email === 'string' ? email.trim().toLowerCase() : ''
    if (!addr) return NextResponse.json({ error: 'メールアドレスが空です' }, { status: 400 })

    // 下の .ilike は、渡した文字列をそのままパターンとして送る（何も逃がさない）。
    // そのため素のままだと、この入口は「1件のアドレスの有無」ではなく
    // 「パターンに合う行の有無」を答えてしまう。
    // 例：'%' だけ送れば必ず exists:true、'%@（企業のドメイン）' なら
    // そのドメインの登録の有無が1回で分かり、上の連打の上限をかいくぐって
    // 名簿を作れてしまう（上の「総当たりでは実用にならない」前提が崩れる）。
    //
    //   %  … 何文字にでも合う
    //   *  … PostgREST が % に読み替える
    //   \  … Postgres の逃がし記号
    // この3つはメールアドレスに本来現れず、かつ「文字そのもの」として
    // 送る手がないので、含まれていたら断る。
    // 断っても呼び出し側は exists / checked が付かないので
    // 「判定できなかった」として先へ進む（登録・再設定は止まらない）
    // 判定そのものは app/lib/likeSearch.ts にある
    // （メール文面の送信・管理画面の取り込み名簿の検索と共通）
    if (hasLikeWildcard(addr)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
    }
    // _（任意の1文字）は正規のアドレスにも現れるので、逃がして文字そのものにする。
    // 逃がさないと taro_yamada@… が taroxyamada@… にも合ってしまう
    const pattern = likePattern(addr)

    const admin = getAdminClient()
    if (!admin) {
      // 設定不備で登録自体を止めないよう、判定不能として扱う
      return NextResponse.json({ exists: false, checked: false })
    }

    const { data, error } = await admin
      .from('profiles')
      .select('id, role')
      .ilike('email', pattern)
      .limit(1)
    if (error) return NextResponse.json({ exists: false, checked: false })

    const hit = data && data.length > 0 ? data[0] : null
    // 役割は出店者・募集者のときだけ返す。
    //
    // 登録画面は「（出店者として登録済みです）」と添えるためにこれを使う。
    // ただし運営（admin）まで返すと、この入口は認証なしで呼べるので、
    // アドレスを順に試して運営アカウントを見つける材料になる。
    // 運営のアドレスは、登録しようとした人に伝える必要がない
    const role = hit?.role === 'seller' || hit?.role === 'host' ? hit.role : null
    return NextResponse.json({
      exists: !!hit,
      checked: true,
      role,
    })
  } catch {
    return NextResponse.json({ exists: false, checked: false })
  }
}
