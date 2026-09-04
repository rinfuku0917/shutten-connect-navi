-- 案件ごとに「何ヶ月先まで申し込めるか」の上限を持たせる。
--
-- 施設によって、受け付けられる先の予定が違う。
--   イオン系      1ヶ月先まで
--   Olympic・ドンキ 3ヶ月先まで
-- 半年先の日付で申し込まれても施設側が答えられず、
-- 出店者を待たせたまま宙に浮く。それを入口で止める。
--
-- なぜ画面だけでなくデータベースにも置くのか:
-- 申込は画面から直接 insert される（app/places/[id]/PlaceDetailClient.tsx の
-- supabase.from('applications').insert）。サーバを経由しないため、
-- 入力欄の max 属性は「選びにくくする」だけで、実際には止められない。
-- どの経路から入っても効くよう、テーブル側で弾く。
--
-- null は「上限なし」。既存の案件はすべて null になるので、
-- この移行だけでは今までの動きは何も変わらない。
-- 上限を入れるのは docs/ops/set-apply-window.sql のほう。

alter table public.places
  add column if not exists apply_within_months smallint;

alter table public.places
  drop constraint if exists places_apply_within_months_check;
alter table public.places
  add constraint places_apply_within_months_check
  check (apply_within_months is null or (apply_within_months >= 1 and apply_within_months <= 24));

comment on column public.places.apply_within_months is
  '何ヶ月先まで申し込めるか。null は上限なし。1〜24';


-- 上限を超えた申込を拒む。
--
-- security definer にしている理由:
-- この関数は places を読む。呼び出した出店者の権限のままだと、
-- RLS で行が見えなかったときに apply_within_months が null になり、
-- 上限が無いものとして素通りしてしまう。
-- 「見えないから制限なし」は事故になるため、確実に読める形にする。
--
-- 「今日」は日本時間で数える。サーバは UTC で動くため、
-- そのままだと日本の朝9時までは前日として扱われ、上限が1日ずれる。
--
-- 「1ヶ月先」は暦どおりに数える。interval を使うと Postgres が
-- 月末を丸めてくれる（1月31日 + 1ヶ月 = 2月28日）。
-- 30日と数えると月によってずれ、運営が説明しにくい。
create or replace function public.check_apply_window()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  months     smallint;
  limit_date date;
begin
  -- 日付を決めずに応募する案件（日程未定）は対象外
  if new.apply_date is null then
    return new;
  end if;

  select p.apply_within_months into months
  from public.places p
  where p.id = new.place_id;

  -- 上限が設定されていない案件は今までどおり
  if months is null then
    return new;
  end if;

  limit_date := ((now() at time zone 'Asia/Tokyo')::date
                 + (months || ' month')::interval)::date;

  if new.apply_date > limit_date then
    raise exception
      'この案件は % ヶ月先（%まで）のお申し込みとなります。', months, to_char(limit_date, 'YYYY/MM/DD')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.check_apply_window() is
  '申込の希望日が、案件に設定された上限（places.apply_within_months）を超えていないか確かめる';

-- 日付を後から書き換える経路も塞ぐ。
-- update of apply_date と絞ることで、当日の進行（checked_in_at など）の
-- 更新のたびに走らないようにしている。
drop trigger if exists applications_apply_window on public.applications;
create trigger applications_apply_window
  before insert or update of apply_date on public.applications
  for each row
  execute function public.check_apply_window();
