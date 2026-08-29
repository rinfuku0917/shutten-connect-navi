// 並べ替え用の見出し。タイトル先頭の【急募】【常設案件】などは
// 系列名より前に来てしまい、同じ店舗がバラバラになるため取り除く。
//   「【常設案件】イオンスタイル河辺」→「イオンスタイル河辺」
export function sortKey(title: string | null | undefined): string {
  const t = String(title || '')
  const stripped = t.replace(/^[\s\u3000]*[【\[（(][^】\]）)]*[】\]）)][\s\u3000]*/, '').trim()
  return stripped || t
}

// タイトルを日本語として自然な順に比べる
export function compareByTitle(a: string | null | undefined, b: string | null | undefined): number {
  return sortKey(a).localeCompare(sortKey(b), 'ja')
}
