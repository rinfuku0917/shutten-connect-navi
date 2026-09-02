-- 統合した記事が、また公開に戻っていた（2026-09-02）
--
-- 下書きに戻したはずの次の2本が、いつのまにか公開に戻っていた。
--   how-to-find-food-truck-spots  「出店場所はどう探す？7つの方法」
--   auto-mtgh64lh-jwwkxe          「駐車場の一角をキッチンカーに貸すときの注意点」
-- 管理画面で押されたのか、古いSQLを流し直したのかは分からない。
--
-- どちらもURLは転送されるので、読者が中身を見ることはない。
-- ただし公開のままだと記事一覧とサイトマップに載る。
--
-- コード側では app/lib/mergedPosts.ts に統合した記事の一覧を持たせ、
-- 公開状態に関係なく一覧・サイトマップから外すようにした。
-- そのため、このSQLを流さなくても表には出ない。
-- ただ、状態としては下書きが正しいので、そろえておく。

-- 実行前
select slug, status, title from posts
where slug in (
  'how-to-find-food-truck-spots','auto-mtarczbg-37pazo','auto-mtgh64lh-jwwkxe',
  'auto-mta8z1w9-vazfy1','choose-profitable-food-truck-location',
  'host-fee-setting-guide2','event-food-truck-guide'
) order by slug;

-- 統合元をすべて下書きに戻す（auto-mta8z1w9-vazfy1 は改名しただけなので対象外）
update posts set status = 'draft', updated_at = now()
where slug in (
  'how-to-find-food-truck-spots',
  'auto-mtarczbg-37pazo',
  'auto-mtgh64lh-jwwkxe',
  'choose-profitable-food-truck-location',
  'host-fee-setting-guide2',
  'event-food-truck-guide'
) and status = 'published';

-- 実行後：公開中は15本になる
select count(*) as 公開中の記事 from posts where status = 'published';
select slug, status from posts
where slug in (
  'how-to-find-food-truck-spots','auto-mtarczbg-37pazo','auto-mtgh64lh-jwwkxe',
  'choose-profitable-food-truck-location','host-fee-setting-guide2','event-food-truck-guide'
) order by slug;
