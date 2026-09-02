-- テスト売上を消す（2026-09-03・実行用）
--
-- 残すのは 井田 麻依子（ふくろうクレープ）さんの売上だけ。
--   seller_id = 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
--
-- 事前の確認では 売上7件（井田さん2件・消す5件・出店者が空の行は0件）だった。
--
-- 安全装置：入金済み（paid_status = 'paid'）の請求書は消さない。
--   お金が動いた記録なので、勝手に消さない。もし残ったら報告に出るので、
--   どう扱うかをそのとき決める。
--
-- まるごと貼って実行してよい。最後に結果が1つの表で出る。

begin;

-- 1. 請求書を消す（入金済みは除く）
delete from invoices
where seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
  and coalesce(paid_status, '') <> 'paid';

-- 2. 売上を消す
delete from sales
where seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369';

commit;


-- 3. 結果の確認
--    ・残った売上は、井田さんの分と同じ件数になっているはず
--    ・累計GMVと手数料収入は、管理画面のダッシュボードに出る数字と同じ
--    ・「消せなかった入金済みの請求書」が0でなければ、その扱いを相談する
select * from (
  select 1 as 並び, '残った売上（件）'      as 項目, count(*)::text as 値 from sales
  union all
  select 2, 'うち井田さんの売上（件）',
    count(*)::text from sales where seller_id = 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
  union all
  select 3, '累計GMV（ダッシュボード表示）',
    '¥' || to_char(coalesce(sum(revenue), 0), 'FM999,999,999') from sales
  union all
  select 4, '手数料収入（ダッシュボード表示）',
    '¥' || to_char(coalesce(sum(fee), 0), 'FM999,999,999') from sales
  union all
  select 5, '残った請求書（件）', count(*)::text from invoices
  union all
  select 6, '★消せなかった入金済みの請求書（件）',
    count(*)::text from invoices
    where seller_id is distinct from 'fbc01e9f-a45f-48c7-8f3b-da8cd5f47369'
) t order by 並び;
