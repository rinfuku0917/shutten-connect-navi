-- 1日だけの申込を受け付けない案件のための「最低出店日数」。
--
-- なぜ要るか（2026-09-26 の運営からの説明）:
--   美食EXPO は1日だけの出店を受け付けておらず、2日間か3日間でしか出られない。
--   ほかのイベントには「3日のうち2日でもよい」ところもある。
--   これまでは1日だけでも申し込めてしまい、出店料が期間ぶんの1つの額の案件では
--   その1日ぶんの請求額も出せなかった。
--
--   9月26日の時点では「期間で1回の案件は全日まとめて」という作りにしていたが、
--   それでは「3日のうち2日」を受け付けられない。日数の下限だけを持たせる形に変える。
--
-- 空（null）と 1 は「1日から申し込める」。これまでどおりの案件はすべてこれ。
-- 上限は置かない（日程に入っている日数が、そのまま上限になる）。
alter table public.places
  add column if not exists min_apply_days smallint;

comment on column public.places.min_apply_days is
  '1回の申込で選ばないといけない最低の日数。空か1なら1日から申し込める';

-- 権限について:
--   places は表ごとの grant（authenticated に select/insert/update/delete）で
--   動いていて、列ごとの grant は使っていない。そのため、この列のための
--   grant は要らない。AGENTS.md の「grant insert, update, delete を明示する」は
--   public に新しく作る表・ビューの話で、既にある表への列の追加は当たらない。

-- 確認
--   select count(*) from public.places where coalesce(min_apply_days, 1) > 1;
--   → 0 から始まる（設定した案件だけ増える）
