-- 承認後の出店取消しを、記録を残す形で行えるようにする。
--
-- なぜ削除ではないのか:
--   公開しているキャンセルポリシー（app/cancel-policy/page.tsx）に
--   「出店が確定（承認）した後は、理由・時期を問わず、いかなる場合も
--   キャンセル料が発生します」と書いてある。承認後の取消しは請求が
--   発生する出来事なので、行を消すと請求の根拠が残らない。
--
--   さらに sales.application_id は ON DELETE SET NULL で張られている。
--   申込を消すと売上の行は残るが「どの出店の売上か」を失い、金額だけが
--   浮いた状態になる。これも消してはいけない理由。
--
-- 押せるのは運営だけ。出店者と募集者には取消しの入口を作らない。
-- 「連絡すれば消せる」と分かるとキャンセルが増えるため、運営が
-- 連絡を受けて処理する形をそのまま画面に載せる。

-- ============================================================
-- ⑴ status に 'cancelled' を許可する
-- ============================================================
-- 既存の制約は pending / approved / rejected の3値。
-- 付け替えなので、いまのデータに3値以外が入っていれば
-- この alter は失敗する（黙って壊れるより落ちるほうがよい）。
alter table public.applications
  drop constraint if exists applications_status_check;

alter table public.applications
  add constraint applications_status_check
  check (status in ('pending', 'approved', 'rejected', 'cancelled'));

-- ============================================================
-- ⑵ 誰が・いつ・なぜ取り消したかを残す
-- ============================================================
alter table public.applications
  add column if not exists cancelled_at   timestamptz,
  add column if not exists cancelled_by   uuid references public.profiles(id),
  add column if not exists cancel_reason  text;

comment on column public.applications.cancelled_at   is '出店取消しを行った時刻';
comment on column public.applications.cancelled_by   is '取消しを行った運営のユーザーID';
comment on column public.applications.cancel_reason  is '取消しの理由。キャンセル料の判断と、繰り返す出店者の把握に使う';

-- ============================================================
-- ⑶ 一意制約を「取消し済みを除く」形に置き換える
-- ============================================================
-- 元は UNIQUE (place_id, seller_id, apply_date)。
-- 取消した行を残すと、同じ出店者が同じ日に申し込み直せなくなる
-- （体調不良で取消したあと回復した、募集者がまた呼びたい、など）。
-- 取消し済みを対象から外した部分一意インデックスに置き換えて、
-- 二重申込は今までどおり防ぎつつ、取消したぶんは申し込み直せるようにする。
alter table public.applications
  drop constraint if exists applications_place_id_seller_id_apply_date_key;

create unique index if not exists applications_active_unique_idx
  on public.applications (place_id, seller_id, apply_date)
  where status <> 'cancelled';

-- 取消し済みを除いた絞り込みが、あちこちのクエリに入る。
-- 同じテーブルの applications_checkin_unseen_idx と同じ考え方で支える。
create index if not exists applications_not_cancelled_idx
  on public.applications (place_id, status)
  where status <> 'cancelled';

-- 取消しは /api/applications/cancel-approved（サービスキー）を通す。
-- 募集者にも applications の UPDATE 権限があるため、RLS だけでは
-- 運営限定にできない。APIの中で role='admin' を確かめている。
