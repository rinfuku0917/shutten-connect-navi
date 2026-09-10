-- 案件の日程を、毎月おなじ条件で自動的に足す設定。
--
-- なぜ要るか:
--   常設の案件（Olympic各店のように毎週末に出る場所）では、
--   毎月おなじ条件の日程を入れ直している。31日ぶんを毎月手で足すのは
--   手間で、入れ忘れると募集が止まる。
--
--   「毎月くり返す」を入れておくと、月初に翌月ぶんの日程が入る。
--
-- 危ないところと、その手当て:
--   ・勝手に募集が続くのを防ぐため、募集終了（closed）の案件には足さない
--   ・足したら募集者と運営に知らせる（気づかないまま公開されるのを防ぐ）
--   ・日程の上限（31日）は守る。溜まらないよう、足す前に
--     終わった日（今日より前）を日程から外す
--   ・いつ、何日ぶん足したかを残す（repeat_last_run_at / repeat_last_added）

alter table public.places
  -- くり返しを使うか
  add column if not exists repeat_monthly boolean not null default false,
  -- 出店する曜日（0=日曜 … 6=土曜）
  add column if not exists repeat_dows smallint[],
  -- 販売の時間帯
  add column if not exists repeat_start text,
  add column if not exists repeat_end   text,
  -- その日の料金。null なら案件全体の設定を使う
  add column if not exists repeat_place_fee   integer,
  add column if not exists repeat_company_fee integer,
  -- 最後に足したときの記録
  add column if not exists repeat_last_run_at timestamptz,
  add column if not exists repeat_last_added  integer;

comment on column public.places.repeat_monthly is '毎月おなじ条件で翌月の日程を足すか';
comment on column public.places.repeat_dows is 'くり返す曜日（0=日 … 6=土）';
comment on column public.places.repeat_start is 'くり返しで入れる販売開始の時刻';
comment on column public.places.repeat_end is 'くり返しで入れる販売終了の時刻';
comment on column public.places.repeat_place_fee is 'くり返しで入れる「取引先へ渡す額」';
comment on column public.places.repeat_company_fee is 'くり返しで入れる「弊社の固定額」';
comment on column public.places.repeat_last_run_at is 'くり返しを最後に実行した時刻';
comment on column public.places.repeat_last_added is 'そのとき足した日数';

create index if not exists places_repeat_idx on public.places (repeat_monthly)
  where repeat_monthly = true;

-- 確認
--   select count(*) from public.places where repeat_monthly = true;
--   → 0 から始まる（設定した案件だけ増える）
