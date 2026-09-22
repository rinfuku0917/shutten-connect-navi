// docs/blog/*.md を、posts テーブルに入れるSQLに変換する。
//
//   npm run blog:sql -- docs/blog/kitchen-car-fee-market-rate.md
//
// 出力されたSQLを Supabase の SQL Editor に貼って実行する。
// front matter に publish_at が無ければ「下書き（draft）」として入るので、
// 管理画面で見た目を確かめてから公開ボタンを押すこと。
// publish_at があれば「公開・予約」として入り、その日時まではサイトに出ない
// （まとめて書いた記事を1日1本ずつ出すため。app/lib/postSchedule.ts）。
//
// 同じ slug で2回流すと、本文だけが上書きされる（公開状態は変えない）。
// 書き直したときも同じ手順でよい。

import fs from 'fs'
import path from 'path'

const file = process.argv[2]
if (!file) {
  console.error('使い方: npm run blog:sql -- docs/blog/<ファイル名>.md')
  process.exit(1)
}

const raw = fs.readFileSync(file, 'utf8')
const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
if (!m) {
  console.error(`${file} の先頭に --- で囲んだ設定がありません。docs/blog/TEMPLATE.md を見てください。`)
  process.exit(1)
}

const meta = {}
for (const line of m[1].split(/\r?\n/)) {
  const i = line.indexOf(':')
  if (i < 0) continue
  meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
}
const content = m[2].trim()

for (const key of ['slug', 'title', 'category', 'meta_description']) {
  if (!meta[key]) {
    console.error(`${key} が空です。docs/blog/TEMPLATE.md を見てください。`)
    process.exit(1)
  }
}
if (meta.slug !== path.basename(file, '.md')) {
  console.error(`slug（${meta.slug}）とファイル名（${path.basename(file, '.md')}）を合わせてください。`)
  process.exit(1)
}

// 文字数の目安を知らせる。止めはしない
const md = meta.meta_description.length
if (md > 130) console.error(`※ meta_description が ${md} 文字です。検索結果では120文字前後で切れます。`)
if (content.length < 1500) console.error(`※ 本文が ${content.length} 文字です。既存の記事は2,400〜4,200文字です。`)

// SQLの文字列に入れる。' は '' にする
const q = v => (v === undefined || v === '' ? 'null' : `'${String(v).split("'").join("''")}'`)

// 予約公開（app/lib/postSchedule.ts）。
// front matter に publish_at（日本時間。例 2026-09-23T10:20）があれば、
// 下書きではなく「公開・公開日つき」で入れる。公開日が来るまでサイトには出ない。
// 無ければ、これまでどおり下書きで入る（管理画面で見てから公開ボタンを押す）。
// 形式は管理画面の公開日の欄と同じ。日付だけなら朝9時として扱う
let publishAt = null
if (meta.publish_at) {
  const s = meta.publish_at.replace(/^['"]|['"]$/g, '')
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T09:00:00+09:00'
    : /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(s) ? s + '+09:00'
    : null
  if (!iso || isNaN(new Date(iso).getTime())) {
    console.error(`publish_at（${meta.publish_at}）が読めません。2026-09-23T10:20 の形にしてください。`)
    process.exit(1)
  }
  publishAt = new Date(iso).toISOString()
}

const cols = {
  slug: meta.slug,
  title: meta.title,
  content,
  excerpt: meta.excerpt,
  category: meta.category,
  cover_emoji: meta.cover_emoji,
  meta_description: meta.meta_description,
  target_keyword: meta.target_keyword,
  related_prefecture: meta.related_prefecture,
  related_category: meta.related_category,
}
const names = Object.keys(cols)

// 同じ slug の記事があれば書き換え、なければ下書きとして足す。
// posts.slug に一意制約があるとは限らないので on conflict は使わない。
const sql = `-- ${meta.title}
-- ${file} から作成。書き直したときは、同じ手順でもう一度流せばよい。
--
-- 同じURL（${meta.slug}）の記事がすでにあれば、本文を書き換える。
--   → その記事が公開中なら、実行した時点で公開ページの中身が変わる。
--   → 差し替え前の本文は docs/blog/${meta.slug}.previous.md に控えてある（あれば）。
-- なければ「下書き」として入る。管理画面（/admin の記事）で見てから公開すること。

${publishAt ? `-- ★予約公開：${meta.publish_at}（日本時間）まで、サイトのどこにも出ない。
--   その日時を過ぎると人の操作なしで出る（app/lib/postSchedule.ts）。
` : ''}
update posts set
${names.filter(n => n !== 'slug').map(n => `  ${n} = ${q(cols[n])}`).join(',\n')},
${publishAt ? `  status = 'published',\n  published_at = ${q(publishAt)},\n` : ''}  updated_at = ${publishAt ? q(publishAt) : 'now()'}
where slug = ${q(meta.slug)};

insert into posts (${names.join(', ')}, status${publishAt ? ', published_at, updated_at' : ''})
select ${names.map(n => q(cols[n])).join(', ')}, ${publishAt ? `'published', ${q(publishAt)}, ${q(publishAt)}` : `'draft'`}
where not exists (select 1 from posts where slug = ${q(meta.slug)});

-- 結果の確認
select slug, title, status, published_at, length(content) as 本文の文字数, updated_at
from posts where slug = ${q(meta.slug)};
`

const out = path.join('docs/blog', `${meta.slug}.sql`)
fs.writeFileSync(out, sql)
console.log(`${out} を作りました（本文 ${content.length}文字）。Supabase の SQL Editor に貼って実行してください。`)
