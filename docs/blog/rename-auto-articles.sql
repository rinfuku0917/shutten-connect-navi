-- 自動生成された3本のURLを、意味のあるものに変える（2026-09-02）
--
-- ★ このSQLを先に流し、そのあとに docs/blog/renting-parking-space.sql を流すこと。
--   順番が逆だと、本文の差し替え先が見つからず何も起きない。
--
-- 何が起きていたか:
--   記事の自動投稿が slug を「auto-」＋時刻＋乱数で作っていたため、
--   /blog/auto-mtgh64lh-jwwkxe のような、中身の分からないURLで公開されていた。
--   さらに、テーマの重複判定が甘く、駐車場の記事がほぼ同じ内容で2本できていた。
--     auto-mtarczbg-37pazo  駐車場をキッチンカーに貸す前に確認すべき注意点（8/27）
--     auto-mtgh64lh-jwwkxe  駐車場の一角をキッチンカーに貸すときの注意点（8/31）
--
-- どうするか:
--   ・駐車場の2本を renting-parking-space に統合（古いほうのURLを引き継ぐ）
--   ・定期開催の1本は regular-event-schedule に改名（本文はそのまま）
--   ・古いURLは next.config.ts の転送で新しいURLへ送る（リンクは切れない）
--
-- 元の本文は docs/blog/auto-*.previous.md に控えてある。

-- 実行前の確認（3本とも published で出てくるはず）
select slug, status, title, length(content) as 本文の文字数
from posts where slug like 'auto-%' order by published_at;

-- 1. 駐車場の記事：古いほう（8/27）のURLを変える。本文はこのあと別のSQLで差し替える
update posts set slug = 'renting-parking-space', updated_at = now()
where slug = 'auto-mtarczbg-37pazo';

-- 2. 駐車場の記事：新しいほう（8/31）は統合したので下書きに戻す
--    本文は消さない。統合先に入れ込んだ内容の元として残しておく
update posts set status = 'draft', updated_at = now()
where slug = 'auto-mtgh64lh-jwwkxe';

-- 3. 定期開催の記事：URLだけ変える。本文はそのまま
update posts set slug = 'regular-event-schedule', updated_at = now()
where slug = 'auto-mta8z1w9-vazfy1';

-- 実行後の確認
--   renting-parking-space   … published（本文はこの時点ではまだ旧いまま）
--   regular-event-schedule  … published
--   auto-mtgh64lh-jwwkxe    … draft
--   auto- で始まる published の記事は 0 件になる
select slug, status, title, length(content) as 本文の文字数
from posts
where slug in ('renting-parking-space', 'regular-event-schedule', 'auto-mtgh64lh-jwwkxe')
order by slug;

select count(*) as 残っているauto記事
from posts where slug like 'auto-%' and status = 'published';
