-- 申込の出店日を、運営が振り替えられるようにする。
--
-- なぜ要るか:
--   「日程を間違えてエントリーした」という連絡が実際に来る。
--   これまでは取り消して入れ直してもらうしかなく、
--   出店者に再エントリーの手間をかけていた。
--   募集が終わっている案件では入れ直しもできない
--   （新しい申込は締切で弾かれる）。
--
--   運営が日付を振り替えられるようにする。誰がいつ、どの日から
--   どの日へ変えたのかを残す。
--
-- 出店者・募集者からは変えられない。運営が連絡を受けて処理する形を守る
-- （出店者が自由に日付を動かせると、募集者の準備と食い違う）。

alter table public.applications
  add column if not exists date_changed_at   timestamptz,
  add column if not exists date_changed_by   uuid references public.profiles(id) on delete set null,
  -- 変更前の出店日。取り違えの確認に使う
  add column if not exists date_changed_from date,
  add column if not exists date_change_reason text;

comment on column public.applications.date_changed_at   is '出店日を振り替えた時刻';
comment on column public.applications.date_changed_by   is '振り替えを行った運営のユーザーID';
comment on column public.applications.date_changed_from is '振り替える前の出店日';
comment on column public.applications.date_change_reason is '振り替えの理由（記録用）';

-- 確認
--   select column_name from information_schema.columns
--    where table_name = 'applications' and column_name like 'date_change%';
--   → 4件返れば想定どおり
