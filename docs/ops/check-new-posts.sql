-- 新しく入れた3本が、下書きとして正しく入っているかを見る。
-- 期待する結果は3行。status がすべて draft で、本文の文字数が
-- 5,728 / 5,577 / 5,772 前後になっていれば取り込みは成功。
--
-- 表紙画像・目次に出る見出しの数・よくある質問の数もあわせて数えている。
-- 記事一覧のサムネイルは本文の1枚目の画像を使うため、
-- 表紙が入っていないと絵文字だけの見た目になる。
select
  slug,
  title,
  status,
  length(content)                                          as 本文の文字数,
  (length(content) - length(replace(content, E'\n## ', ''))) / 4   as 見出しの数,
  (length(content) - length(replace(content, E'\n### ', ''))) / 5  as 小見出しの数,
  content like '![%'                                       as 表紙あり,
  updated_at
from posts
where slug in (
  'invite-food-truck-free',
  'how-to-call-food-truck',
  'request-food-truck'
)
order by slug;
