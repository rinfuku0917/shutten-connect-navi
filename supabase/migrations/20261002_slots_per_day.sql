-- 1日あたりの募集台数を、案件ごとに設定できるようにする。
--
-- なぜ要るか（2026-10-02 の運営からの指摘）:
--   案件詳細に「募集台数 5台」と出ていて、5日間の案件を見た出店者から
--   「1日に5台出店できる（合計25台）ということですか？」と問い合わせが来た。
--   別の案件でも「4台も出店するんですか？」と聞かれている。
--
--   調べると、その 5 は入力された数ではなかった。
--   places.max_slots に列の既定値 5 が付いていて、290件のうち262件が
--   入力されないまま 5 になっていた（下の確認用の問い合わせ）。
--   施設ごとの本当の台数（1日1台、1日3〜5台など）を入れる欄も無かった。
--
-- 何を足すか:
--   slots_per_day_min … 1日あたりの台数（幅があるときは下限）
--   slots_per_day_max … 幅があるときの上限。無ければ空
--
--   「1日1台」は min=1。「1日3〜5台」は min=3, max=5。
--   画面に出す文（「1日あたり3〜5台」）は app/lib/placeSlots.ts が作る。
--
-- 既にある max_slots から写さない:
--   262件の 5 は既定値で、事実ではない。「1日あたり5台」と読み替えると、
--   実際は5台ではない案件に、いまより強い言い方で誤りを告知することになる。
--   入力された7件（1・2・3・4・6台）も、1日あたりなのか全体なのかが
--   案件ごとに違うので、機械的には写さない。運営が案件ごとに入れる。
--
-- max_slots の列は消さない（入力された7件を運営が見返せるように）。
-- ただし、もうどこからも読まないし書かない。
alter table public.places
  add column if not exists slots_per_day_min smallint,
  add column if not exists slots_per_day_max smallint;

-- max_slots の既定値 5 を外す。
--   募集者の案件作成は max_slots を書かないので、既定値があるかぎり
--   新しい案件にも入力されていない 5 が入り続ける。
--   既にある行の値は変えない（既定値を外すだけ）。
alter table public.places alter column max_slots drop default;

comment on column public.places.slots_per_day_min is
  '1日あたりの募集台数。幅があるときは下限。空なら案件詳細に台数を出さない';
comment on column public.places.slots_per_day_max is
  '1日あたりの募集台数の上限（「1日3〜5台」の5）。幅が無ければ空';

-- 権限について:
--   places は表ごとの grant（authenticated に select/insert/update/delete）で
--   動いていて、列ごとの grant は使っていない。そのため、この列のための
--   grant は要らない（20260926_min_apply_days.sql と同じ判断）。

-- 確認
--   select max_slots, count(*) from public.places group by 1 order by 2 desc;
--   → 5 が262件（既定値のまま）
--   select count(*) from public.places where slots_per_day_min is not null;
--   → 0 から始まる（設定した案件だけ増える）
