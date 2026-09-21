-- 歩合の案件に「最低保証」を持たせる。列の追加は1本（places.min_guarantee）だけ。
--
-- なぜ:
--   「売上の20%。ただし売上が悪くても平日2,000円・休日7,500円はいただく」
--   という案件（イオンモール与野・イオンモール富谷）がある。
--   これまでは places.fee の自由文に書いてあるだけで、
--     ・計算に入らない（請求のたびに運営が手で直す）
--     ・自由文は「固定額も歩合も0のときだけ」画面に出る作りなので、
--       歩合を登録した案件では、最低保証が出店者の画面から消えていた
--   という状態だった。
--
-- 決めごと（app/lib/placeFee.ts の dayFeeOf が唯一の実装）:
--   ・施設へ渡す額（placeFee）と弊社の取り分（companyFee）で別々に持つ。
--     それぞれ「固定額＋歩合」と「最低保証」を比べて高い方を使う（合算しない）。
--   ・最低保証は「その側の請求額の下限」。固定額の外側にかけるので、
--     最低保証を後から入れても金額が下がることはない（単調に上がるだけ）。
--     そのため既存の案件に後から入れても、過去の運用と矛盾しない。
--   ・最低保証を入れていない案件は、これまでどおり「固定額＋歩合」の合算。
--     この移行では1件も入れないので、金額は1円も変わらない。
--   ・平日と土日祝で額が違うので、曜日を区別する。
--     祝日・振替休日・国民の休日は土日と同じ扱い（app/lib/jpHoliday.ts）。
--   ・平日の額だけ入れた案件は、土日祝も平日の額が下限になる（形態ごとの min と同じ落ち方）。
--     土日祝だけ高い案件は、両方の額を入れる。
--   ・最低保証は税別で入れる（請求時に10%を足すのは今のまま）。
--   ・出店日ごとに比べる。月の合計に対してかけない
--     （与野の「売上が悪くても平日2,000円…は必須」は1日あたりの条件）。
--   ・0 は「下限なし」＝未設定と同じ扱い（画面の保存時に落とす）。
--
-- 持たせる場所は2つ:
--   1. 形態ごと … places.format_fees の各形態の "min"（jsonb の中身。列の追加なし）
--   2. 案件全体 … places.min_guarantee（この移行で足す列）
--   1 が入っていれば 1 が優先。項目ごとに独立して落ちる。
--
--   両方いるのは、形態ごとの料金は募集者側の編集画面（FormatFeesEditor）にしかなく、
--   運営の /admin の料金設定モーダルからは形態別を編集できないため。
--   与野は形態（キッチンカー）側に 15%/5% が入っているので 1 が要り、
--   運営が /admin だけで入れ切れるようにするには 2 が要る。
--
-- なぜ day_type_fees に相乗りさせないのか:
--   /admin の料金設定モーダルの buildDayTypeFees は、保存のたびに
--   day_type_fees を丸ごと作り直して上書きする。同じ JSON に別の意味の値を混ぜると
--   「平日と土日祝で金額を変える」のチェックを外した瞬間に最低保証も黙って消える。
--   列を分ければ、フォームの状態も保存も独立する。
--
-- 対象外（意図して持たない）:
--   ・日ごと（places.schedule の各日）の最低保証。
--     最低保証の実例はすべて平日／土日祝の2段階で、日ごとの実データが無い。
--     入れると入力欄が4か所に増えて、いまどの額で計算されているのか運営が追えなくなる。
--   ・期間でまとめた最低保証（per_event。レゾナックFamilyDay の「8万円程度」）。
--     日ごとの計算の外の話なので、これまでどおり手作業で請求する。


-- ============================================================
-- 流す前の確認（0件で始まる。すでに流してあれば列がある）
-- ============================================================
--
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'places' and column_name = 'min_guarantee';
--   → 0行なら未実行、1行（jsonb）なら実行済み


-- ============================================================
-- 本体
-- ============================================================

alter table public.places add column if not exists min_guarantee jsonb;

comment on column public.places.min_guarantee is
  '歩合が少ない日の最低保証（案件全体）。{"weekday":{"placeFee":0,"companyFee":2000},"weekend":{"placeFee":0,"companyFee":7500}}。'
  'day_type_fees と同じ形だが、落ち方だけ違う：weekday が平日の額で、weekend は土日祝だけ額が違うときの上書き。'
  '土日祝を入れない（または項目を空にする）と、平日の額がそのまま土日祝の下限になる（形態ごとの min と同じ）。'
  '祝日・振替休日・国民の休日は土日扱い。単位は円・税別で、1日あたり。'
  '施設へ渡す額（placeFee）と弊社の取り分（companyFee）を別々に持ち、'
  'それぞれ「固定額＋歩合」で計算した額と比べて高い方を使う（合算しない）。'
  '0 と未設定は同じ（下限なし）。形態ごとの最低保証（format_fees の min）が入っていればそちらが優先。'
  '日ごと（schedule）の最低保証と、期間まとめ（per_event）の最低保証は持たない。'
  '計算の実装は app/lib/placeFee.ts の dayFeeOf が唯一の正';

-- 形態ごとの設定（format_fees）に "min" が増えたので、コメントを付け直す。
-- 20260911_format_fees_weekend.sql と同じやり方で、コメントだけを再設定する。
--
-- 形（app/lib/placeFee.ts の FormatFees が唯一の正）:
--   {
--     "キッチンカー": {
--       "placeFee": 3000,        平日に取引先へ渡す額（土日祝を入れないときは全日）
--       "companyFee": 0,         平日の弊社の固定額
--       "weekend": {             土日祝だけ額が違うときに入れる。祝日も土日と同じ扱い
--         "placeFee": 4500,      空欄にした項目は、上の平日の額がそのまま使われる
--         "companyFee": null
--       },
--       "sharePct": 15,          取引先の歩合（売上の%）。0〜100
--       "companySharePct": 5,    弊社の歩合（売上の%）。0〜100
--       "min": {                 歩合が少ない日の最低保証（円・税別。1日あたり）
--         "placeFee": 1500,      平日に取引先へ渡す最低保証（土日祝を入れないときは全日）
--         "companyFee": 500,     平日の弊社の最低保証
--         "weekend": {           土日祝だけ額が違うときに入れる
--           "placeFee": 5625,    空欄にした項目は、上の平日の額がそのまま使われる
--           "companyFee": 1875
--         }
--       },
--       "note": "3m×5m・電源あり", 区画の条件（画面にそのまま出す）
--       "dows": [0, 6]           出られる曜日。空なら案件の日程すべて
--     },
--     "物販": { ... }, "催事PR": { ... }, "テント・ブース": { ... }
--   }
--
-- なぜ min を weekend の中に混ぜず、入れ子で独立させたのか:
--   FormatFeesEditor の「固定額を平日と土日祝で分ける」を外すと、weekend は
--   丸ごと削除される（画面に出ていない額で計算されるのを防ぐため）。
--   最低保証をそこに入れると、固定額の分け方を変えただけで最低保証が消える。
--
-- 金額の優先順位（計算・画面・請求件名はすべて app/lib/placeFee.ts を呼ぶ）:
--   固定額: 形態ごとの額 → 日程の各日（schedule） → 案件の平日土日（day_type_fees） → 案件全体の列
--   歩合  : 形態ごと（sharePct / companySharePct） → 案件全体の列
--   最低保証: 形態ごと（min） → 案件全体（min_guarantee）

comment on column public.places.format_fees is
  '形態ごとの出店料と条件。{"キッチンカー":{placeFee,companyFee,weekend:{placeFee,companyFee},sharePct,companySharePct,min:{placeFee,companyFee,weekend:{placeFee,companyFee}},note,dows},...}。'
  '形態は キッチンカー／物販／催事PR／テント・ブース。placeFee は平日（weekend 未設定なら全日）、'
  'weekend は土日祝だけ額が違うときに入れる。min は歩合が少ない日の最低保証（円・税別。'
  '歩合で計算した額と比べて高い方を使い、合算しない。土日祝で空欄の項目は平日の額に落ちる）。'
  '優先順位は 形態→日程の各日→案件の平日土日→案件全体。最低保証は 形態の min→案件の min_guarantee';


-- ============================================================
-- 流したあとの確認
-- ============================================================
--
-- ① 列ができたか（1行返る）
-- select column_name, data_type from information_schema.columns
--  where table_schema = 'public' and table_name = 'places' and column_name = 'min_guarantee';
--
-- ② 最低保証が入っている案件の数（この移行の直後は 0 件）
-- select count(*) as 案件全体の最低保証あり from public.places where min_guarantee is not null;
--
-- ③ 形態ごとの最低保証が入っている案件の数（この移行の直後は 0 件）
-- select count(*) as 形態ごとの最低保証あり from public.places
--  where format_fees::text like '%"min"%';
--
-- ④ コメントが付いたか
-- select col_description('public.places'::regclass, attnum) as 説明, attname as 列
--   from pg_attribute
--  where attrelid = 'public.places'::regclass and attname in ('min_guarantee', 'format_fees');
--
-- ⑤ 金額が変わっていないこと（記録済みの売上は再計算しないので、そのまま）
-- select count(*) as 売上の記録 from public.sales;
--   → 件数も金額も変わらない。最低保証は、これから記録する売上にだけ効く
--
-- データの移行（backfill）は不要。既存の案件は min 未設定＝これまでどおりの合算。
-- RLS も places の既存ポリシーのままで足りる（列単位の制限は無い）。
-- 実際に最低保証を入れるSQLは docs/ops/set-min-guarantee.sql（運営が確認してから流す）。


-- ============================================================
-- 元に戻すSQL（列を消す。入れた最低保証も一緒に消える）
-- ============================================================
--
-- 列が無い状態でも画面は動く（読み出しは列が無ければ「最低保証なし」として扱う）。
-- ただし列を消すと、入れた最低保証の額は戻せない。消す前に控えを取ること。
--
-- begin;
-- -- 控え（消す前に中身を見ておく）
-- -- select id, title, min_guarantee from public.places where min_guarantee is not null;
-- alter table public.places drop column if exists min_guarantee;
-- -- format_fees のコメントを、最低保証を足す前の文に戻す
-- comment on column public.places.format_fees is
--   '形態ごとの出店料と条件。{"キッチンカー":{placeFee,companyFee,weekend:{placeFee,companyFee},sharePct,companySharePct,note,dows},...}。'
--   '形態は キッチンカー／物販／催事PR／テント・ブース。placeFee は平日（weekend 未設定なら全日）、'
--   'weekend は土日祝だけ額が違うときに入れる。優先順位は 形態→日程の各日→案件の平日土日→案件全体';
-- commit;
--
-- 形態ごとの最低保証（format_fees の min）は列ではなく jsonb の中身なので、
-- 消すときは値を抜く:
--   update public.places
--      set format_fees = (
--        select jsonb_object_agg(k, v - 'min') from jsonb_each(format_fees) as t(k, v)
--      )
--    where format_fees::text like '%"min"%';
