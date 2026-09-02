-- 統合した重複記事が、まだ公開のままになっている（2026-09-02）
--
-- rename-auto-articles.sql の2番目（下書きに戻す）が効いていない。
-- auto-mtgh64lh-jwwkxe「駐車場の一角をキッチンカーに貸すときの注意点」は
-- renting-parking-space に内容をまとめたので、公開の必要がない。
--
-- URL自体は next.config.ts の転送で renting-parking-space へ送られるため、
-- 読者が中身を見ることはない。ただし公開のままだと
--   ・記事一覧（/blog）にカードが出る（押すと転送されるので紛らわしい）
--   ・サイトマップに載る（転送されるURLを検索エンジンに申告してしまう）
-- という不都合が残る。

-- 実行前
select slug, status, title from posts where slug like 'auto-%';

update posts set status = 'draft', updated_at = now()
where slug = 'auto-mtgh64lh-jwwkxe';

-- 実行後：0件になれば成功
select count(*) as 公開のまま残っているauto記事
from posts where slug like 'auto-%' and status = 'published';
