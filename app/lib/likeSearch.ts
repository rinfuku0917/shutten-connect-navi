// ilike のパターンに、利用者・運営が打った文字をそのまま埋めないための下ごしらえ。
//
// 【なぜ要るか】
//   PostgREST の ilike は、渡した文字列をそのままパターンとして送る（何も逃がさない）。
//   そのため素のままだと「1件の一致」ではなく「パターンに合う行」を答えてしまう。
//     %  … 何文字にでも合う
//     *  … PostgREST が % に読み替える
//     \  … Postgres の逃がし記号
//     _  … 任意の1文字。メールアドレスや屋号に普通に現れる
//   上の3つは本来の値に現れないので弾き、_ は逃がす（弾くと
//   taro_yamada@… が探せなくなる）。
//
//   大文字小文字を無視したい場面が多いので eq には変えられない
//   （登録時の表記が揃っていないため）。
//
//   2026-09-21 までは app/api/auth/check-email と
//   app/api/admin/mail-templates/send に同じものが書かれていた。
//   app/admin/page.tsx の取り込み名簿の検索だけ抜けていた（.or() の中の
//   ilike は `.ilike(` を grep しても見つからなかった）ので、写さずにここへ出した。

/** ilike のパターンとして効いてしまう記号（弾く対象） */
const LIKE_WILDCARD = /[%*\\]/

/** パターンとして効く記号が入っているか。入っていたら受け付けない */
export function hasLikeWildcard(v: string): boolean {
  return LIKE_WILDCARD.test(v)
}

/**
 * _（任意の1文字）を「文字そのもの」に逃がす。
 * 逃がさないと taro_yamada@… が taroXyamada@… にも合う。
 * hasLikeWildcard を通したあとに使うこと（\ が残っていると二重に効く）
 */
export function likePattern(v: string): string {
  return v.replace(/_/g, '\\_')
}

/**
 * .or() の項に埋めるときに、さらに使えない記号。
 *
 * .or() は `列.演算子.値,列.演算子.値` の形なので、値にカンマが入ると
 * PostgREST が別の項として分解し、問い合わせが壊れる。
 * かっこと二重引用符も、項のまとめ方・値の囲み方として読まれる。
 * （ドットと @ は値の中に入っていても読み分けられるので、ここには入れない）
 */
const OR_RESERVED = /[,()"]/

/** .or() の項に埋められない記号が入っているか */
export function hasOrReservedChar(v: string): boolean {
  return OR_RESERVED.test(v)
}

/** 検索語に使えない記号を知らせる文面（画面・APIで同じ言い方にする） */
export const LIKE_SEARCH_NG_MESSAGE =
  '検索に使えない記号が入っています（% * \\ , ( ) "）。取り除いてお試しください'
