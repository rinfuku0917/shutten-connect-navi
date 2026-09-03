-- 当日の進行を5段階にする。
--
-- 昨夜（20260903_onsite_workflow.sql）で入れたのは3段階だった。
--   前日確認 / 受付完了 / 営業準備完了
-- 実際に運用しているLINEのやり取りは5段階なので、そちらに合わせる。
--   車両の搬入 / 営業準備中 / 営業開始 / 営業終了 / 撤収
--
-- 名前の整理:
--   昨夜の「受付完了」は出店者が押すものだったが、運営が押す
--   「受付完了」（全工程がそろってから運営が確認する操作）と名前がぶつかる。
--   同じ画面に「受付完了」の列とボタンが並ぶことになるため、
--   出店者側は「搬入」に改める。列名 checked_in_at はそのまま使う
--   （すでに本番で動いており、入っているデータの意味も「現場に着いた」で
--     変わらないため。列名を変えると当日の記録が消える危険がある）。
--
--   列と画面上の呼び名の対応:
--     confirmed_at    … 前日確認   （出店者）
--     checked_in_at   … 車両の搬入 （出店者）※昨夜は「受付完了」と呼んでいた
--     ready_at        … 営業準備中 （出店者）※昨夜は「営業準備完了」
--     opened_at       … 営業開始   （出店者）★今回追加
--     closed_at       … 営業終了   （出店者）★今回追加
--     left_at         … 撤収       （出店者）★今回追加
--     checkin_seen_at … 受付完了   （運営）  ※昨夜は「確認」ボタンだった

alter table public.applications
  add column if not exists opened_at timestamptz,   -- 営業開始
  add column if not exists closed_at timestamptz,   -- 営業終了
  add column if not exists left_at   timestamptz;   -- 撤収

comment on column public.applications.confirmed_at    is '当日の進行: 前日確認を押した時刻';
comment on column public.applications.checked_in_at   is '当日の進行: 車両の搬入を押した時刻';
comment on column public.applications.ready_at        is '当日の進行: 営業準備中を押した時刻';
comment on column public.applications.opened_at       is '当日の進行: 営業開始を押した時刻';
comment on column public.applications.closed_at       is '当日の進行: 営業終了を押した時刻';
comment on column public.applications.left_at         is '当日の進行: 撤収を押した時刻';
comment on column public.applications.checkin_seen_at is '運営が受付完了を押した時刻。押すまで管理画面で目立たせ、押すと出店者の画面にも出る';

-- 管理画面は「その日の承認済み」を毎分引く。撤収が日をまたぐことがあるため、
-- 前日ぶんも拾えるよう apply_date だけの索引に変える。
create index if not exists applications_onsite_day_idx
  on public.applications (apply_date, status)
  where status = 'approved';
