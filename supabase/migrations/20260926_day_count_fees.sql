-- 日数ごとの出店料（「2日なら6万円、3日なら8万円」）。
--
-- なぜ要るか（2026-09-26 の運営からの相談）:
--   美食EXPO のような催しは、1日だけの出店を受け付けず、2日間か3日間で出る。
--   しかも日数で金額が変わる。
--   これまでの設定は「1日あたりいくら」か「期間で1回いくら」の2つしかなく、
--   ・1日あたり … 2日で6万にすると3日で9万になり、8万にできない
--   ・期間で1回 … 2日でも3日でも同じ額になる
--   どちらでも表せなかった。日数と金額の対応を直接持たせる。
--
-- 形:
--   {"2": {"placeFee": 45000, "companyFee": 15000},
--    "3": {"placeFee": 60000, "companyFee": 20000}}
--   キーは出店する日数（文字列の整数）。値は取引先へ渡す額と弊社の固定額。
--   ほかの金額（format_fees / schedule の日額 / day_type_fees）と同じく、
--   内訳は出店者に見せず、合計だけを出す。
--
-- 決めごと:
--   ・この表が入っている案件は、表にある日数だけが選べる
--     （「2日間または3日間のみ」がそのまま決まりになる）。
--     そのため min_apply_days とは併用しない
--   ・表が空（null）の案件は、これまでどおり
--     「1日あたり／期間で1回」＋ min_apply_days で動く
--   ・日ごとの金額（schedule の placeFee など）とは混ぜない。
--     混ざっている案件は、入力の画面で警告を出す
alter table public.places
  add column if not exists day_count_fees jsonb;

comment on column public.places.day_count_fees is
  '日数ごとの出店料。{"2":{"placeFee":45000,"companyFee":15000},"3":{...}}。キーは出店日数。入っていればその日数だけ選べる';

-- 権限について:
--   places は表ごとの grant（authenticated に select/insert/update/delete）で
--   動いていて、列ごとの grant は使っていない。この列のための grant は要らない。

-- 確認
--   select count(*) from public.places where day_count_fees is not null;
--   → 0 から始まる（設定した案件だけ増える）
