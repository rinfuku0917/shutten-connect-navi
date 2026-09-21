// まだ足していない列を select に混ぜても画面が壊れないようにする。
//
// なぜ要るか:
//   places.min_guarantee（最低保証）のように、移行SQLを流すまで
//   存在しない列がある。PostgREST は存在しない列を1つでも select に
//   含めると 42703（column ... does not exist）を返し、data は null になる。
//   案件一覧や承認済み申込の読み込みがまるごと空になり、
//   「案件が1件も無い」画面になってしまう。
//
//   そこで「新しい列あり」で1回試し、42703 のときだけ
//   「新しい列なし」でもう一度読む。列を足したあとは1回目で通るので、
//   余分な問い合わせは発生しない。
//
// 列を足し終えてしばらく経ったら、この包みは外して素の select に戻してよい。

type Result<T> = { data: T | null; error: { code?: string } | null }

// 列が無いときに返るコードは、読み書きで違う。
//   読み出し（select）… 42703（PostgreSQL の column ... does not exist）
//   書き込み（insert / update）… PGRST204
//     （PostgREST が schema cache の列一覧で body を検査して弾くため。
//      "Could not find the 'min_guarantee' column of 'places' in the schema cache"）
// 42703 だけを見ていたため、保存側の作り直し（最低保証を落として再実行）が
// 一度も発動せず、移行SQLを流すまで案件の登録・編集・料金設定が
// まるごと失敗していた。
// 移行SQLを流したあとも schema cache が更新されるまでは PGRST204 が返るので、
// 列を足したあともしばらくは両方を見る必要がある。
export const MISSING_COLUMN_CODES = ['42703', 'PGRST204'] as const

/** その失敗が「列がまだ無い」ことによるものか */
export function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return !!error?.code && (MISSING_COLUMN_CODES as readonly string[]).includes(error.code)
}

export async function selectWithOptionalColumn<T>(
  run: (withColumn: boolean) => PromiseLike<Result<T>>,
): Promise<Result<T>> {
  const first = await run(true)
  if (isMissingColumn(first.error)) return await run(false)
  return first
}
