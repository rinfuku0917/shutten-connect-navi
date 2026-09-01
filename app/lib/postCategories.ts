// ブログ記事のカテゴリー。記事一覧の絞り込みと、admin の記事編集で共有する。
// docs/seo-keywords.md の章立て（B/D/C）に対応させている。
// 変えるときは supabase/migrations/20260901_post_seo_columns.sql の
// 既存記事の振り分けも見直すこと。
export const POST_CATEGORIES = [
  '出店場所の探し方',
  '開業・許可',
  '書類・保険',
  '募集者向け',
] as const

export type PostCategory = (typeof POST_CATEGORIES)[number]
