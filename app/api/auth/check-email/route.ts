import { NextResponse } from 'next/server'
import { getAdminClient } from '../../../lib/apiAuth'

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
// 1つのIPからでは実用にならない
const RATE_WINDOWS = [
  { ms: 60 * 1000, max: 10 },
  { ms: 60 * 60 * 1000, max: 60 },
]
const LONGEST_WINDOW_MS = Math.max(...RATE_WINDOWS.map(w => w.ms))

// 発信元ごとの、直近の呼び出し時刻。
//
// 【限界】Vercel のサーバーレスは実行インスタンスごとに別の記憶を持ち、
// インスタンスは増えたり作り直されたりする。つまりこの数え方は
// 「インスタンス1つあたりの上限」で、全体の厳密な上限にはならない。
// それでも連打は1つのインスタンスに集まりやすいので、
// 素のままより格段に投げにくくなる。
// 外部（Redis 等）を持ち込むほどの入口ではないと判断した
const recentChecks = new Map<string, number[]>()

// 覚えておく発信元の数の上限と、掃除の間隔。
//
// 掃除を「呼ばれるたび」にすると、発信元が多い時間帯は
// 通した1件ごとに Map 全体を見に行くことになり、
// 発信元が増えるほど1件あたりが重くなる。1分に1回で十分。
// また、捨てられるのは1時間まったく来ていない発信元だけなので、
// それだけでは上限にならない（直近1時間の発信元の数がそのまま大きさになる）。
// 掃除のあとも多すぎるときは、古い順に落として天井を作る
const MAX_TRACKED_IPS = 500
const SWEEP_INTERVAL_MS = 60 * 1000
let lastSweep = 0

/**
 * 発信元のキー。Vercel では x-forwarded-for の先頭が利用者のIP。
 *
 * IPv6 は /64（先頭4ブロック）に丸める。IPv6 では下位が日常的に変わる
 * （プライバシー拡張）ので、そのまま使うと同じ利用者が何枠にも散って
 * 上限として働かない。契約者に割り当てられるのは通常 /64 以上なので、
 * そこで束ねるのがちょうどよい。
 * 省略表記（:: を含む形）はそのまま前から4つを取るだけなので、
 * できるキーは厳密なプレフィックスではない。同じ相手が同じキーになれば
 * 数えるには足りるので、展開まではしない。
 *
 * 【前提】x-forwarded-for は Vercel がプラットフォーム側で書き換えるので信頼できる。
 * ヘッダが無い環境（手元の開発など）は全員まとめて 'unknown' の1枠に入る。
 * 上限に当たっても 429 は「判定できなかった」扱いで、登録・再設定は止まらないため、
 * 枠を共有しても利用者を締め出すことにはならない（だから外していない）
 */
function callerIp(req: Request): string {
  const first = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  if (!first) return 'unknown'
  if (first.includes(':')) return first.split(':').slice(0, 4).join(':') + '::/64'
  return first
}

/**
 * 記憶が育ちすぎないよう、古い発信元を捨てる。ふだんは1分に1回だけ走る。
 * ただし1分のあいだに上限の倍を超えて増えたときは、間隔を待たずに走らせる
 * （そうしないと、1分に現れた発信元の数だけは際限なく増えてしまう）
 */
function sweep(now: number) {
  if (recentChecks.size <= MAX_TRACKED_IPS) return
  if (now - lastSweep < SWEEP_INTERVAL_MS && recentChecks.size <= MAX_TRACKED_IPS * 2) return
  lastSweep = now
  for (const [k, ts] of recentChecks) {
    if (ts.every(t => now - t >= LONGEST_WINDOW_MS)) recentChecks.delete(k)
  }
  // それでも多いときは、いちばん古い記録を持つ発信元から落とす。
  // 落としても、その発信元の数え直しが始まるだけで実害はない
  if (recentChecks.size > MAX_TRACKED_IPS) {
    const byOldest = [...recentChecks.entries()]
      .sort((a, b) => Math.max(...a[1]) - Math.max(...b[1]))
    for (const [k] of byOldest.slice(0, recentChecks.size - MAX_TRACKED_IPS)) {
      recentChecks.delete(k)
    }
  }
}

/** 上限に達していれば true。達していなければ今回の分を記録する */
function isTooMany(ip: string): boolean {
  const now = Date.now()
  // いちばん長い窓より古い記録は、もう数える必要がない
  const hits = (recentChecks.get(ip) || []).filter(t => now - t < LONGEST_WINDOW_MS)
  for (const w of RATE_WINDOWS) {
    if (hits.filter(t => now - t < w.ms).length >= w.max) {
      // 当たった分は記録しない。記録すると、叩き続けるほど
      // 待ち時間が際限なく伸びてしまう
      recentChecks.set(ip, hits)
      // 叩き続けている相手だけが来ている時間帯にも掃除の機会を作る
      sweep(now)
      return true
    }
  }
  hits.push(now)
  recentChecks.set(ip, hits)
  sweep(now)
  return false
}

export async function POST(req: Request) {
  try {
    if (isTooMany(callerIp(req))) {
      // 呼び出し側は checked:false を見て「判定できなかった」として先へ進む。
      // 文面は、万一画面に出しても意味が通るようにしておく
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
    if (/[%*\\]/.test(addr)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません' }, { status: 400 })
    }
    // _（任意の1文字）は正規のアドレスにも現れるので、逃がして文字そのものにする。
    // 逃がさないと taro_yamada@… が taroxyamada@… にも合ってしまう
    const pattern = addr.replace(/_/g, '\\_')

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
