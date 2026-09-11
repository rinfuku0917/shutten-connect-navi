// 完全に消した記録の控え。
//
// 出店の取消しは、行ごと消す方針にしている（運営の判断）。
// 行が無くなると「いつ・どの案件の・どの日の出店を消したのか」が
// どこにも残らないので、消す直前にここへ1行だけ残す。
// キャンセル料の請求や、繰り返す出店者の把握で必要になったときに、
// これだけでも手がかりが残る。
//
// 控えを残せなくても本体の削除は止めない。
// purge_log の表がまだ作られていない環境で、
// 取り消し自体ができなくなるほうが困るため。
//
// 使う側:
//   app/api/applications/cancel-approved/route.ts … 取り消したその場で消すとき
//   app/api/admin/purge/route.ts                 … 運営が手で消すとき
// 同じ文面の作り方を2か所に書くと食い違うので、ここを唯一の正とする。

export type PurgeKind = 'application' | 'invoice'

export type PurgeLogRow = {
  kind: PurgeKind
  target_id: string
  deleted_by: string
  summary: string
  /** 出店者ごとに引くための列。キャンセル料の請求と、繰り返しの数え上げに使う */
  seller_id?: string | null
  place_id?: string | null
  apply_date?: string | null
  cancelled_at?: string | null
  /** 消す直前の中身（形態・金額・やり取り・当日の記録・取り消し理由） */
  detail?: unknown
}

/**
 * 控えを1行残す。
 *
 * 同じものを二度書かないよう upsert にしている（取り消しの再送・画面の二重押し）。
 * purge_log_target_uniq（kind, target_id）が前提。
 * その索引がまだ無い環境では upsert が通らないので、insert で入れ直す。
 *
 * @returns 残せたかどうか（残せなくても呼び出し側は処理を続けてよい）
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writePurgeLog(db: any, row: PurgeLogRow): Promise<boolean> {
  try {
    const { error } = await db.from('purge_log')
      .upsert(row, { onConflict: 'kind,target_id' })
    if (!error) return true
    // 索引や列がまだ無い環境のための逃げ道。
    // 控えを残せないことと、取り消しができないことは別なので、
    // ここで諦めても本体の削除は止めない
    const { error: e2 } = await db.from('purge_log').insert(row)
    if (e2) {
      console.error('purge_log への記録に失敗しました', error.message, '/', e2.message)
      return false
    }
    return true
  } catch (e) {
    console.error('purge_log への記録に失敗しました', e)
    return false
  }
}

/**
 * 控えに載せる一行の説明を作る。
 * 案件名 / 出店日 / 出店者（ID） / 取り消した理由 の順。空の項目は詰める。
 *
 * なぜ出店者まで載せるのか:
 *   /cancel-policy に「出店が確定（承認）した後は、理由・時期を問わず、
 *   いかなる場合もキャンセル料が発生します」と書いてある。さらに
 *   「事前のご連絡なく出店されなかった場合は、キャンセル料に加え、
 *   以後の応募制限またはアカウント停止の対象となることがあります」とも書いてある。
 *   どちらも「誰が」が分からないと実行できない。
 *   申込の行を消すのだから、ここに残す以外に手がかりが無くなる。
 *
 *   名前は変わることがあるので、ID も併せて残す。
 *   purge_log は運営APIからしか読めない（RLS 有効・ポリシー0）。
 */
export function purgeSummary(parts: {
  placeTitle?: string | null
  applyDate?: string | null
  sellerName?: string | null
  sellerId?: string | null
  reason?: string | null
}): string {
  const seller = parts.sellerName || parts.sellerId
    ? [parts.sellerName || '(名前なし)', parts.sellerId ? '(' + parts.sellerId + ')' : '']
      .filter(Boolean).join('')
    : ''
  return [
    parts.placeTitle || '(案件名なし)',
    parts.applyDate || '(日付なし)',
    seller,
    parts.reason || '',
  ].filter(Boolean).join(' / ')
}

/**
 * 取り消しの応答から、運営に出す一行を作る。
 *
 * 取り消しは「行ごと消す」のが既定だが、消せないことがある
 * （ほかの操作で状態が変わった、外部キーで止まった、直前に売上が入った）。
 * そのときは取消し済みのまま残るので、運営がそれに気づけるようにする。
 * 控えを残せなかった場合も伝える（キャンセル料の請求ができなくなるため）。
 *
 * 同じ文を3つの画面に書くと食い違うので、ここで作る。
 */
export function cancelResultMessage(res: {
  purged?: boolean
  purgeLogged?: boolean
  messagesPurged?: boolean
} | null | undefined): string {
  const parts: string[] = []
  parts.push(res?.purged === false
    ? '申込を取り消しました。ただし記録の削除ができなかったため、運営の一覧には取消し済みとして残ります。'
    : '申込を取り消し、記録を削除しました。')
  if (res?.purgeLogged === false) {
    parts.push('削除の控えを残せませんでした。キャンセル料を請求する場合は、先に控えの記録をご確認ください。')
  }
  if (res?.messagesPurged === false) {
    parts.push('やり取りの削除に失敗しています。')
  }
  return parts.join('\n')
}
