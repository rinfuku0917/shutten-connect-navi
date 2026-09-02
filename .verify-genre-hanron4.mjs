import fs from 'node:fs'
const env = Object.fromEntries(
  fs.readFileSync(new URL('./.env.local', import.meta.url), 'utf8')
    .split('\n').filter(l => l.includes('=')).map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const U = env.NEXT_PUBLIC_SUPABASE_URL, K = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// サーバ側でだけ数える（自分のJSパースを一切通さない別経路）
async function count(qs) {
  const r = await fetch(`${U}/rest/v1/public_sellers?select=id&${qs}`,
    { headers: { apikey: K, Authorization: `Bearer ${K}`, Range: '0-0', Prefer: 'count=exact' } })
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`)
  return Number((r.headers.get('content-range') || '/?').split('/')[1])
}

console.log('=== サーバ側 count（PostgREST が数える） ===')
console.log('全件                    :', await count(''))
console.log('genre is null           :', await count('genre=is.null'))
console.log('genre = "[]"            :', await count('genre=eq.%5B%5D'))
console.log('genre like %"食事"%     :', await count('genre=like.*%22' + encodeURIComponent('食事') + '%22*'))
console.log('genre like %"スイーツ"% :', await count('genre=like.*%22' + encodeURIComponent('スイーツ') + '%22*'))
console.log('genre like %"ドリンク"% :', await count('genre=like.*%22' + encodeURIComponent('ドリンク') + '%22*'))
console.log('genre like %"物販"%     :', await count('genre=like.*%22' + encodeURIComponent('物販') + '%22*'))
console.log('genre like %"サービス"% :', await count('genre=like.*%22' + encodeURIComponent('サービス') + '%22*'))
console.log('genre = "キッチンカー"  :', await count('genre=eq.' + encodeURIComponent('キッチンカー')))
console.log('genre like %菓子%       :', await count('genre=like.*' + encodeURIComponent('菓子') + '*'))

// 「食事 or スイーツ」を持つ実店舗数（サーバ側 or フィルタ）
const or = 'or=(genre.like.*%22' + encodeURIComponent('食事') + '%22*,genre.like.*%22' + encodeURIComponent('スイーツ') + '%22*)'
console.log('\n食事 or スイーツ を持つ実店舗数 :', await count(or))
const and = 'and=(genre.like.*%22' + encodeURIComponent('食事') + '%22*,genre.like.*%22' + encodeURIComponent('スイーツ') + '%22*)'
console.log('食事 and スイーツ（両方）        :', await count(and))
console.log('→ 本文「食事とスイーツで1,100店を超えます」の検証')

// 「スイーツ」は「菓子・スイーツ」にも部分一致しないか確認（"スイーツ" は引用符で囲んで一致させている）
console.log('\n注: like は \\"ジャンル\\" と引用符ごと一致させているので、菓子・スイーツ は スイーツ に混入しない')
console.log('genre like %"菓子・スイーツ"% :', await count('genre=like.*%22' + encodeURIComponent('菓子・スイーツ') + '%22*'))
