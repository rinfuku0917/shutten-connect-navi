-- 募集者向けの記事が、出店者向けのカテゴリに入っているのを直す。
--
-- 記事一覧（/blog）はカテゴリで絞り込めるようにしたが、
-- 「出店場所の探し方」を選ぶと、場所を貸す側に向けた記事まで混ざって出てくる。
-- 中身は募集者向けなので、カテゴリだけを付け替える。
--
-- 本文もURLも変えないので、検索順位への影響はない。
-- 変わるのは記事一覧での並びと、記事上部に出るカテゴリの札だけ。

-- 実行前の確認
select slug, category, title from posts
where slug in (
  'vacant-space-food-truck',
  'host-fee-setting-guide',
  'host-fee-setting-guide2',
  'auto-mta8z1w9-vazfy1',
  'auto-mtarczbg-37pazo',
  'auto-mtgh64lh-jwwkxe'
)
order by slug;

-- 付け替え
update posts set category = '募集者向け', updated_at = now()
where slug in (
  'vacant-space-food-truck',   -- 遊休スペースの活用にキッチンカー誘致という選択肢
  'host-fee-setting-guide',    -- 商業施設・オフィスビルにキッチンカーを導入する効果とは
  'host-fee-setting-guide2',   -- キッチンカーの出店料はどう決める？場所を貸す側の料金設定ガイド
  'auto-mta8z1w9-vazfy1',      -- 商業施設でキッチンカーを定期開催するときの曜日と時間帯の決め方
  'auto-mtarczbg-37pazo',      -- 駐車場をキッチンカーに貸す前に確認すべき注意点と必要な手続き
  'auto-mtgh64lh-jwwkxe'       -- 駐車場の一角をキッチンカーに貸すときの注意点と必要な手続き
);

-- 「キッチンカー開業で失敗しないための5つのコツ」は開業の話なので、こちらへ
update posts set category = '開業・許可', updated_at = now()
where slug = 'kitchen-car-avoid-failure';

-- 結果の確認
select category, count(*) as 記事数 from posts where status = 'published'
group by category order by 記事数 desc;
