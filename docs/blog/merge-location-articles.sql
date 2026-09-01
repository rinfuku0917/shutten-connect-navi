-- 「出店場所の探し方」の記事の統合（2026-09-02）
--
-- ★ このSQLは docs/blog/kitchen-car-location-guide.sql を実行した「あと」に流すこと。
--   先にこちらを流すと、統合先の本文が古いまま統合元だけが消える。
--
-- 何が起きていたか:
--   同じ検索語「キッチンカー 出店場所 探し方」を、3本の記事で取り合っていた。
--     /blog/kitchen-car-location-guide        出店場所の探し方は？（2026-07-02）
--     /blog/how-to-find-food-truck-spots      出店場所はどう探す？7つの方法（2026-07-15）
--     /blog/choose-profitable-food-truck-location  売上が伸びる選び方（2026-07-15）
--   検索エンジンはどれを出せばよいか決められず、3本とも評価が分散する。
--
-- どうするか:
--   ・kitchen-car-location-guide に内容をまとめる（古いほうを残す。URLの評価が長い）
--   ・how-to-find-food-truck-spots は下書きに戻す
--     → 記事一覧とサイトマップから自動で消える
--     → URL自体は next.config.ts の301で統合先へ転送する（リンクは切れない）
--   ・choose-profitable-food-truck-location は残す
--     「探し方（どこにあるか）」と「選び方（どれを選ぶか）」で読者の疑問が違うため。
--     統合先の本文から内部リンクを張ってつなげた
--
-- 元の本文は docs/blog/*.previous.md に控えてある。

-- 実行前の確認
select slug, status, title, length(content) as 本文の文字数
from posts
where slug in (
  'kitchen-car-location-guide',
  'how-to-find-food-truck-spots',
  'choose-profitable-food-truck-location'
)
order by slug;

-- 統合元を下書きに戻す。本文は消さない（あとで見返せるように）
update posts
set status = 'draft', updated_at = now()
where slug = 'how-to-find-food-truck-spots';

-- 実行後の確認
-- kitchen-car-location-guide が published で4,500字前後、
-- how-to-find-food-truck-spots が draft になっていれば成功。
select slug, status, title, length(content) as 本文の文字数, updated_at
from posts
where slug in (
  'kitchen-car-location-guide',
  'how-to-find-food-truck-spots',
  'choose-profitable-food-truck-location'
)
order by slug;
