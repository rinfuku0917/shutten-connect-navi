// 同じ発信元からの連打を抑える仕掛け。
//
// 【なぜ要るか】
//   認証を付けられない公開の入口がいくつかある。
//     ・/api/auth/check-email … 登録前・パスワード再設定前に使う
//     ・/api/notify/new-seller … 登録の直後はメールの確認が済んでおらず、
//                                本人としてログインできない
//     ・/api/meeting-request  … 打ち合わせ希望。募集者はまだ会員ではない
//     ・/api/contact          … 公開ページからのお問い合わせ
//   1件ずつなら問題ないが、URLを知られたまま投げ続けられると、
//   名簿を作られる・運営の受信箱を埋められる・偽の行を積まれる、
//   といった害が出る。権限で止められないので、発信元ごとの回数で止める。
//
//   2026-09-21 までは check-email の中だけに書いてあった。
//   ほかの3本にも同じものが要るので、写さずにここへ出した。
//
// 【限界（大事）】
//   Vercel のサーバーレスは実行インスタンスごとに別の記憶を持ち、
//   インスタンスは増えたり作り直されたりする。つまりこの数え方は
//   「インスタンス1つあたりの上限」で、全体の厳密な上限にはならない。
//   それでも連打は1つのインスタンスに集まりやすいので、
//   素のままより格段に投げにくくなる。
//   外部（Redis 等）を持ち込むほどの入口ではないと判断した。
//
// 【使う側の約束】
//   上限に当たっても、利用者の用事そのもの（登録・再設定）を止めないこと。
//   429 は「判定できなかった」「通知は送れなかった」として扱い、
//   画面の流れは先へ進める。

export type RateWindow = {
  /** 窓の長さ（ミリ秒） */
  ms: number
  /** その窓のなかで許す回数 */
  max: number
}

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
 * 上限に当たっても利用者の用事は止めない作りにしてあるので、
 * 枠を共有しても締め出すことにはならない（だから外していない）
 */
export function callerIp(req: Request): string {
  const first = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim()
  if (!first) return 'unknown'
  if (first.includes(':')) return first.split(':').slice(0, 4).join(':') + '::/64'
  return first
}

// 覚えておく発信元の数の上限と、掃除の間隔。
//
// 掃除を「呼ばれるたび」にすると、発信元が多い時間帯は
// 通した1件ごとに Map 全体を見に行くことになり、
// 発信元が増えるほど1件あたりが重くなる。1分に1回で十分。
// また、捨てられるのはいちばん長い窓のあいだ何も来ていない発信元だけなので、
// それだけでは上限にならない（直近の発信元の数がそのまま大きさになる）。
// 掃除のあとも多すぎるときは、古い順に落として天井を作る
const DEFAULT_MAX_TRACKED_IPS = 500
const SWEEP_INTERVAL_MS = 60 * 1000

/**
 * 発信元ごとの回数を数える関門を作る。
 *
 * 記憶（Map）は関門ごとに別にする。入口ごとに窓と上限が違うので、
 * 数を共有すると片方の連打で、もう片方の正しい呼び出しまで止まる。
 *
 * 返る関数は「上限に達していれば true」。
 * false のときは今回の分を記録してから返る（数えるのは通した分だけ）。
 */
export function createRateLimiter(
  windows: RateWindow[],
  maxTrackedIps: number = DEFAULT_MAX_TRACKED_IPS,
): (ip: string) => boolean {
  const longestWindowMs = Math.max(...windows.map(w => w.ms))
  // 発信元ごとの、直近の呼び出し時刻
  const recent = new Map<string, number[]>()
  let lastSweep = 0

  /**
   * 記憶が育ちすぎないよう、古い発信元を捨てる。ふだんは1分に1回だけ走る。
   * ただし1分のあいだに上限の倍を超えて増えたときは、間隔を待たずに走らせる
   * （そうしないと、1分に現れた発信元の数だけは際限なく増えてしまう）
   */
  function sweep(now: number) {
    if (recent.size <= maxTrackedIps) return
    if (now - lastSweep < SWEEP_INTERVAL_MS && recent.size <= maxTrackedIps * 2) return
    lastSweep = now
    for (const [k, ts] of recent) {
      if (ts.every(t => now - t >= longestWindowMs)) recent.delete(k)
    }
    // それでも多いときは、いちばん古い記録を持つ発信元から落とす。
    // 落としても、その発信元の数え直しが始まるだけで実害はない
    if (recent.size > maxTrackedIps) {
      const byOldest = [...recent.entries()]
        .sort((a, b) => Math.max(...a[1]) - Math.max(...b[1]))
      for (const [k] of byOldest.slice(0, recent.size - maxTrackedIps)) {
        recent.delete(k)
      }
    }
  }

  return function isTooMany(ip: string): boolean {
    const now = Date.now()
    // いちばん長い窓より古い記録は、もう数える必要がない
    const hits = (recent.get(ip) || []).filter(t => now - t < longestWindowMs)
    for (const w of windows) {
      if (hits.filter(t => now - t < w.ms).length >= w.max) {
        // 当たった分は記録しない。記録すると、叩き続けるほど
        // 待ち時間が際限なく伸びてしまう
        recent.set(ip, hits)
        // 叩き続けている相手だけが来ている時間帯にも掃除の機会を作る
        sweep(now)
        return true
      }
    }
    hits.push(now)
    recent.set(ip, hits)
    sweep(now)
    return false
  }
}
