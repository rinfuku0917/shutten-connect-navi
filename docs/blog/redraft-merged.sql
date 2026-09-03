-- 統合した記事が、また公開に戻っていた（2026-09-03・2回目）
--
-- 統合した5本が、今日 04:34〜04:35 にまとめて公開へ戻っていた。
-- 管理画面にも、こちらが用意したSQLにも、一括で公開する処理は無い。
-- 原因は特定できていない。
--
-- 読者への影響はない。
--   ・記事一覧にもサイトマップにも出ない（app/lib/mergedPosts.ts で除いている）
--   ・URLは統合先へ転送される（next.config.ts）
-- 本番で5本とも確認済み。
--
-- ただし管理画面の一覧では「公開中」に見えるので、状態をそろえておく。
-- あわせて、管理画面の記事一覧に「統合済み」の表示を出すようにした。

-- 実行前
select slug, status, updated_at from posts
where slug in (
  'how-to-find-food-truck-spots','auto-mtarczbg-37pazo','auto-mtgh64lh-jwwkxe',
  'choose-profitable-food-truck-location','host-fee-setting-guide2','event-food-truck-guide'
) order by slug;

update posts set status = 'draft', updated_at = now()
where slug in (
  'how-to-find-food-truck-spots',
  'auto-mtarczbg-37pazo',
  'auto-mtgh64lh-jwwkxe',
  'choose-profitable-food-truck-location',
  'host-fee-setting-guide2',
  'event-food-truck-guide'
) and status = 'published';

-- 実行後：公開中は16本になる（いま21本）
select count(*) as 公開中の記事 from posts where status = 'published';
