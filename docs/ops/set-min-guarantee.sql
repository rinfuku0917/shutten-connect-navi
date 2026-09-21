-- 最低保証を、実際の案件に入れるSQL（下書き）。
--
-- 【流す前に必ず】
--   ・先に supabase/migrations/20260921_min_guarantee.sql を流して
--     places.min_guarantee の列を作ること（列が無いと ③ 以降が失敗する）。
--   ・金額と配分は、この下の「確認してほしいこと」を運営で決めてから流すこと。
--     配分（施設へ渡す額：弊社の取り分）は歩合と同じ比を素案にしてある。
--   ・Supabase の SQL Editor は最後の結果しか出さないので、番号ごとに1本ずつ流すこと。
--   ・最低保証が効くのは歩合のある側だけ。固定額の出店料は売上が低くても高くても
--     同じ額なので、最低保証という考え方が無い（2026-09-21 の指示）。
--     欄は自由入力なので固定額だけの案件にも入れられるが、計算では使わない。
--   ・記録済みの売上（sales）は再計算されない。最低保証は、これから記録する売上にだけ効く。
--     先月分を出し直したい場合は、売上を削除して再登録する運用のまま。
--
-- 【確認してほしいこと】
--   1. 与野・富谷の「平日2,000円・休日7,500円」は、施設へ渡す額と弊社の取り分に
--      どう割るか。素案は歩合と同じ比（15：5）＝平日 1,500／500、休日 5,625／1,875。
--      比が歩合と違うと、売上によっては出店者の合計が
--      「売上の20%」も「最低保証2,000円」も上回る日が出る（画面でも警告を出している）。
--   2. 富谷は歩合そのものが未登録（計算設定が空）。20% をどう割るか（素案は 15：5）。
--   3. Coming soon の「歩率15％・最低保証 平日3万/土日祝7万（税抜）」は、
--      案件名が仮なので、公開する案件名が決まってから入れるかどうか。
--   4. 最低保証を入れた案件は、places.fee の自由文と二重に見える。
--      設定を入れたら自由文は短くする（または消す）運用にすること。


-- ============================================================
-- ① 流す前の確認（いまの設定と自由文）
-- ============================================================
select id, title, price_fixed, price_share_pct, company_fixed_amount, company_share_pct,
       day_type_fees, format_fees, min_guarantee, fee
  from public.places
 where id in (
   '91260daf-e1a2-471c-9bd5-b5b391a5c905',  -- イオンモール与野
   '43c4bcae-6d96-4b43-b56b-570878886c69',  -- イオンモール富谷
   '8568c968-540f-4dd4-8988-74bbea33cfbf',  -- Coming soon
   '5c6264df-3012-487d-b453-b401bb51f624',  -- レゾナックFamilyDay（今回は対象外）
   '968526df-4db9-4788-96cf-196d37ff5bb1'   -- Olympic 国立店（歩合の誤入力の直し）
 );


-- ============================================================
-- ② Olympic 国立店「催事PR」の歩合の誤入力を直す（最低保証とは別件・先に直す）
-- ============================================================
--
-- いま format_fees の催事PR が
--   {"placeFee":13000,"sharePct":18000,"companyFee":5000,"companySharePct":7000}
-- になっている。土日祝の金額（18,000円・7,000円）を歩合の欄に入れた誤入力で、
-- この形態で売上を記録すると「売上の18000%」で計算される（売上5,000円で126万円）。
-- 金額と%の欄は自由入力のままにしてあるので（2026-09-21 の指示）、
-- 画面では範囲の外を知らせない。計算側で範囲の外の%を捨てて案件全体の設定に
-- 落とすため請求額は壊れないが、設定に数字が残ったままだと紛らわしいのでここで消す。
--
-- 歩合を消すと、催事PR は固定額（平日 13,000＋5,000＝18,000円）だけになる。
-- 土日祝も同額でよいかは運営で確認すること（違うなら weekend を足す）。
--
-- 流す前の値
select format_fees -> '催事PR' as 催事PRのいまの設定
  from public.places where id = '968526df-4db9-4788-96cf-196d37ff5bb1';

-- 直す（歩合の2項目だけを抜く。固定額はそのまま）
-- update public.places
--    set format_fees = jsonb_set(format_fees, '{催事PR}',
--          (format_fees -> '催事PR') - 'sharePct' - 'companySharePct')
--  where id = '968526df-4db9-4788-96cf-196d37ff5bb1';

-- 流したあとの確認（sharePct / companySharePct が消えていること）
-- select format_fees -> '催事PR' as 催事PRの設定
--   from public.places where id = '968526df-4db9-4788-96cf-196d37ff5bb1';


-- ============================================================
-- ③ イオンモール与野：売上の20%（形態 キッチンカー 15％＋5％）に最低保証を足す
-- ============================================================
--
-- 自由文：「売上の20%(売上が悪くても平日2000円、休日7500円の出店料は必須)」
-- 歩合は形態（キッチンカー）側に 15％／5％ で入っているので、
-- 最低保証も形態側（format_fees の min）に入れる。
-- 平日 2,000円＝1,500／500、休日 7,500円＝5,625／1,875（歩合と同じ比）。
--
-- places 側に残っている company_share_pct = 20 は旧設定の名残。
-- 形態側が優先されるので計算には効かないが、案件一覧の表示には出るため、
-- 20％のままにしておく（一覧の「売上の20%（最低保証あり）」の表記に使われる）。
--
-- update public.places
--    set format_fees = jsonb_set(format_fees, '{キッチンカー}',
--          (format_fees -> 'キッチンカー') || jsonb_build_object('min', jsonb_build_object(
--            'placeFee', 1500, 'companyFee', 500,
--            'weekend', jsonb_build_object('placeFee', 5625, 'companyFee', 1875)
--          )))
--  where id = '91260daf-e1a2-471c-9bd5-b5b391a5c905';
--
-- 流したあとの確認（平日 2,000円・土日祝 7,500円になること）
-- select format_fees -> 'キッチンカー' -> 'min' as 最低保証,
--        (format_fees -> 'キッチンカー' -> 'min' ->> 'placeFee')::int
--          + (format_fees -> 'キッチンカー' -> 'min' ->> 'companyFee')::int as 平日の合計,
--        (format_fees -> 'キッチンカー' -> 'min' -> 'weekend' ->> 'placeFee')::int
--          + (format_fees -> 'キッチンカー' -> 'min' -> 'weekend' ->> 'companyFee')::int as 土日祝の合計
--   from public.places where id = '91260daf-e1a2-471c-9bd5-b5b391a5c905';


-- ============================================================
-- ④ イオンモール富谷：歩合20％の登録と、最低保証（平日2,000円・休日7,500円）
-- ============================================================
--
-- 自由文は与野と同じだが、計算設定が空（歩合も入っていない）。
-- 歩合と最低保証を一緒に入れる。形態ごとの設定が無い案件なので、
-- 案件全体（places の列と min_guarantee）に入れる＝運営が /admin の「料金」から
-- 同じ内容を入れてもよい（このSQLはまとめて入れるためのもの）。
--
-- update public.places
--    set price_share_pct   = 15,   -- 施設へ渡す歩合
--        company_share_pct = 5,    -- 弊社の歩合（合計20%）
--        min_guarantee = jsonb_build_object(
--          'weekday', jsonb_build_object('placeFee', 1500, 'companyFee', 500),
--          'weekend', jsonb_build_object('placeFee', 5625, 'companyFee', 1875)
--        )
--  where id = '43c4bcae-6d96-4b43-b56b-570878886c69';
--
-- 流したあとの確認
-- select title, price_share_pct, company_share_pct, min_guarantee
--   from public.places where id = '43c4bcae-6d96-4b43-b56b-570878886c69';


-- ============================================================
-- ⑤ Coming soon：歩率15％・最低保証 平日30,000円／土日祝70,000円（税抜）
-- ============================================================
--
-- 自由文：「歩率：15％　最低保証額：平日3万円/土日祝7万円（税抜）」
-- 15％の内訳（施設と弊社の取り分）が決まってから入れること。
-- 下の素案は「全額を施設へ渡す歩合」として置いてある（弊社の取り分が別途あるなら直す）。
--
-- update public.places
--    set price_share_pct   = 15,
--        company_share_pct = 0,
--        min_guarantee = jsonb_build_object(
--          'weekday', jsonb_build_object('placeFee', 30000, 'companyFee', 0),
--          'weekend', jsonb_build_object('placeFee', 70000, 'companyFee', 0)
--        )
--  where id = '8568c968-540f-4dd4-8988-74bbea33cfbf';


-- ============================================================
-- ⑥ レゾナックFamilyDay：今回は入れない
-- ============================================================
--
-- 自由文：「ご相談/売上が満たない場合の最低保証料として8万円程度を予定」
-- これは期間まとめ（イベント1回）の最低保証で、1日あたりの下限ではない。
-- いまの作りは1日ごとに比べるため表現できない。これまでどおり手作業で請求する。
-- （入れてしまうと、出店日の数だけ8万円がかかる）


-- ============================================================
-- ⑦ 入れたあとの全体確認
-- ============================================================
-- select count(*) as 案件全体の最低保証あり from public.places where min_guarantee is not null;
-- select count(*) as 形態ごとの最低保証あり from public.places where format_fees::text like '%"min"%';
-- select id, title, min_guarantee, fee from public.places where min_guarantee is not null;
--
-- 画面でも確かめる:
--   ・/places の一覧に「売上の20%（最低保証あり）」が出ること
--   ・/places/<id> の「出店料」が「売上の20%（最低 平日2,000円/日・土日祝7,500円/日）」になること
--   ・申込の画面で、形態カードと各日の行に最低保証が出ること
--   ・/admin の「料金」を開くと、最低保証の欄に入れた額が表示されること


-- ============================================================
-- 元に戻すSQL
-- ============================================================
--
-- ③ 与野（形態ごとの最低保証を抜く）
-- update public.places
--    set format_fees = jsonb_set(format_fees, '{キッチンカー}', (format_fees -> 'キッチンカー') - 'min')
--  where id = '91260daf-e1a2-471c-9bd5-b5b391a5c905';
--
-- ④ 富谷（歩合と最低保証を元の「未設定」に戻す）
-- update public.places
--    set price_share_pct = null, company_share_pct = 0, min_guarantee = null
--  where id = '43c4bcae-6d96-4b43-b56b-570878886c69';
--
-- ⑤ Coming soon
-- update public.places
--    set price_share_pct = null, company_share_pct = 0, min_guarantee = null
--  where id = '8568c968-540f-4dd4-8988-74bbea33cfbf';
--
-- ② Olympic 国立店（誤入力の歩合を戻す。戻す意味はほぼ無いが、控えとして）
-- update public.places
--    set format_fees = jsonb_set(format_fees, '{催事PR}',
--          (format_fees -> '催事PR') || '{"sharePct":18000,"companySharePct":7000}'::jsonb)
--  where id = '968526df-4db9-4788-96cf-196d37ff5bb1';
