// 出店者の表示名の決め方を1か所にまとめる。
//
// 【なぜ要るか】
//   2026-09-19 に出店者ご本人から「公開ページに本名が出ている」と申し出があった。
//   原因は「屋号（shop_name）が空なら本名（profiles.name）で埋める」という
//   書き方が、公開ページ・募集者の画面・施設へ出すExcelに散らばっていたこと。
//   埋める先が1か所ずつ違うと、また同じことが起きる。
//
// 【決めごと】
//   ・本名は、運営（profiles.role='admin'）の画面だけで使う。
//     取得も /api/admin/seller-names を通す（adminSellerNames.ts）。
//   ・出店者・募集者に見せる名前は屋号だけ。空なら下の定型文にする。
//   ・公開用ビュー public_sellers は本名の列を持たない
//     （supabase/migrations/20260919_public_sellers_no_name.sql）。

/**
 * 屋号が未登録の出店者を、人に見せるときの言い方。
 * 公開ページ（app/sellers/[id]/page.tsx の NO_SHOP_NAME）と同じ言葉に揃えている。
 */
export const NO_SHOP_NAME = 'キッチンカー出店者'

/**
 * 施設へ出す書類（提出用Excel・売上報告Excel）で、屋号が埋められなかったときの書き方。
 *
 * 画面用の「キッチンカー出店者」は使わない。書類に並ぶと本当の屋号に見えてしまい、
 * そのまま施設へ渡ってしまうため。「未登録」と書いて、出す前に気づけるようにする。
 */
export const UNSET_SHOP_NAME = '(屋号未登録)'

/**
 * id の配列から「id → 本名」を引く関数の型。
 *
 * 運営の画面だけが渡す。渡されなければ本名は使わず、屋号だけで組み立てる。
 * 提出用Excel・売上報告Excelは募集者も実行するので、この形で分けている。
 */
export type SellerNameResolver = (ids: string[]) => Promise<Map<string, string>>

/**
 * 会社名として公開してよい名前。
 *
 * 屋号（shop_name）が空でも、氏名の欄に会社名を入れている出店者がいる。
 * 会社名は個人情報ではないので公開してよい、という運営の判断（2026-09-24）。
 * 一覧で「（店名未登録）」ばかり並ぶのを減らすのが目的。
 *
 * 判定は「法人を表す語が入っているか」だけ。
 * 「株式会社 H・K FOODS」のように空白入りの会社名も出すため、厳しくしていない。
 *
 * ★残る危うさ（運営に伝えてある）:
 *   氏名の欄に「株式会社ABC 田中」のように会社名と個人名を続けて書いた人がいると、
 *   その個人名もそのまま公開される。2026-09-19 に出店者ご本人から
 *   「公開ページに本名が出ている」と申し出があったのと同じことが起きうる。
 *   見つけたら運営が屋号の欄を直す（そちらが優先されるので表示から消える）。
 */
const CORPORATE_MARKERS = [
  '株式会社', '合同会社', '有限会社', '合資会社', '合名会社',
  '(株)', '（株）', '(有)', '（有）', '(合)', '（合）',
  '一般社団法人', '一般財団法人', '特定非営利活動法人', 'NPO法人',
]

export function corporateNameOrEmpty(raw: string | null | undefined): string {
  const name = (raw ?? '').trim()
  if (!name) return ''
  return CORPORATE_MARKERS.some(m => name.includes(m)) ? name : ''
}

/**
 * 施設へ出す書類の店舗名。
 * 屋号 → （運営のときだけ）本名 → 「(屋号未登録)」の順に決める。
 */
export function submissionShopName(
  shopName: string | null | undefined,
  realName?: string | null,
): string {
  return (shopName ?? '').trim() || (realName ?? '').trim() || UNSET_SHOP_NAME
}
