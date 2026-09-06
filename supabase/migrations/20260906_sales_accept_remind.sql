-- 売上報告の「受理」と「1件ずつの督促」を扱えるようにする。
--
-- 運営が出店管理スケジュールから、
--   ・売上の報告を受理したことを記録する（出店者の画面にも「受理済み」と出る）
--   ・まだ報告が無い出店者へ、その場から催促を送る
-- ようにするためのもの。


-- ═══════════════════════════════════════════════
-- 1. 受理
-- ═══════════════════════════════════════════════
--
-- ★ sales は運営専用のテーブルではない。
--    出店者は自分の行を読める（20260623_rls_hardening.sql の
--    「sellers read own sales」）。募集者の画面にも売上報告Excelがあり、
--    ブラウザから sales を読んでいる（app/dashboard/host/page.tsx）。
--    そのため、ここに運営だけのメモを置いてはいけない。
--    受理のメモが要る場合は onsite_notes（運営専用）に書く。
--
--    置くのは「いつ受理したか」と「誰が受理したか」だけ。
--    受理日は出店者に見せる前提の値で、担当者IDは連絡先ではない。

alter table public.sales
  add column if not exists accepted_at timestamptz,
  add column if not exists accepted_by uuid references public.profiles(id) on delete set null;

comment on column public.sales.accepted_at is
  '運営が売上報告を受理した時刻。null は未受理。出店者の画面にも「受理済み」と出る。
   sales は出店者・募集者も読むため、ここに運営だけの情報は書かないこと';
comment on column public.sales.accepted_by is
  '受理した運営担当者。担当者の登録が消えても受理の事実は残したいので on delete set null';

-- まだ受理していない売上を引くための索引。
-- accepted_at is null だけだと導入直後は全行が該当して絞り込みにならないため、
-- 売上日でも並べられるようにしておく
create index if not exists sales_unaccepted_idx
  on public.sales (sale_date desc)
  where accepted_at is null;


-- ═══════════════════════════════════════════════
-- 2. 督促
-- ═══════════════════════════════════════════════
--
-- ★ すでにある applications.sales_reminded_at は使えない。
--    あの列は「催促を送った」ときだけでなく、
--    「もう報告済みだったので対象から外した」ときにも入る
--    （app/api/cron/sales-reminder/route.ts の done の処理）。
--
--    出店者は自分の売上を削除でき、削除すると未報告に戻る。
--    そのとき sales_reminded_at は入ったままなので、
--    あの列を根拠に画面へ出すと、催促を一度も受けていない人に
--    「運営から催促がありました」と表示してしまう。
--
--    そこで「本当にメールを送れたときだけ」入る列を分けて作る。

alter table public.applications
  add column if not exists sales_reminder_sent_at timestamptz;

comment on column public.applications.sales_reminder_sent_at is
  '売上報告の督促を実際に送れた日時。対象から外しただけの sales_reminded_at とは別物。
   出店者の画面に「運営から催促がありました」と出すのはこちらを根拠にする。
   ※ applications は募集者も更新できるため、督促の記録の正本は sales_reminder_log。
     この列は出店者に見せるための写しという位置づけ';


-- 督促の記録。何度でも送れるようにするため、送った回数と日時を残す。
-- 画面に「前回いつ送ったか」を出して、連打を防ぐためにも使う。
--
-- 読み書きは管理者用のAPI（サービスロール）を通す。
-- RLS を有効にしたうえでポリシーを作らない＝ブラウザからは触れない。
-- onsite_notes・password_notice_log と同じ方針。
--
-- ★ 出店者に読ませるポリシーは作らない。
--    RLS は行ごとの制御で、列を隠すことはできない。
--    ポリシーを付けると、送信先アドレスも失敗理由も、
--    押した運営担当者のIDまで出店者のブラウザから読めてしまう。
create table if not exists public.sales_reminder_log (
  id uuid primary key default gen_random_uuid(),

  -- どの出店枠への督促か。申込が消えても記録は残す
  -- （誰にいつ送ったかは、申込が消えても追えるようにしておく）
  application_id uuid references public.applications(id) on delete set null,
  seller_id uuid references public.profiles(id) on delete set null,

  -- 送った時点のアドレス。あとで変更されても追えるように、そのまま残す
  email text not null,

  -- auto=毎朝の自動送信 ／ manual=運営が画面から1件ずつ送ったもの
  kind text not null default 'manual',

  status text not null default 'sent',
  error text,

  -- 押した運営担当者。登録が消えても記録は残す
  sent_by uuid references public.profiles(id) on delete set null,
  sent_at timestamptz not null default now()
);

alter table public.sales_reminder_log
  drop constraint if exists sales_reminder_log_kind_check;
alter table public.sales_reminder_log
  add constraint sales_reminder_log_kind_check check (kind in ('auto', 'manual'));

alter table public.sales_reminder_log
  drop constraint if exists sales_reminder_log_status_check;
alter table public.sales_reminder_log
  add constraint sales_reminder_log_status_check check (status in ('sent', 'failed'));

comment on table public.sales_reminder_log is
  '売上報告の督促の送信記録。何度でも送れるため、回数と日時を残す。
   運営だけが読み書きする（管理者用APIを通してのみ触れる）';

-- 「この出店枠へ前回いつ送ったか」を引くための索引
create index if not exists sales_reminder_log_application_idx
  on public.sales_reminder_log (application_id, sent_at desc);

alter table public.sales_reminder_log enable row level security;

-- ポリシーは作らない。サービスロールを持つ管理者用APIからだけ触れる


-- ═══════════════════════════════════════════════
-- 3. 売上報告を消せなくする条件
-- ═══════════════════════════════════════════════
--
-- 出店者は自分の売上報告を消せる（20260623_rls_hardening.sql の
-- 「sellers delete own sales」）。直す手段が削除しかないため、
-- 普段はそれでよい。
--
-- ただし、次の2つは消されると困る。
--   ・運営が受理したもの     … 受理を確定として扱うため
--   ・請求書の根拠になったもの … 消えると請求書の金額の根拠が無くなる
--
-- 請求書のほうは実際に起こりうる形だった。
-- 出店取消しでは請求書を確認して止めているのに、
-- 売上報告の削除では見ていなかった。
--   ① 出店者が売上を報告 → ② 運営が請求書を発行 → ③ 出店者が報告を削除
--   → 請求書だけが残り、金額の根拠が消える
--
-- ★ 画面のボタンを消すだけでは足りない。
--    売上の削除は画面から直接データベースへ行く（サーバを経由しない）ため、
--    ここで止める。申込期間の上限と同じ考え方。
--
-- 運営は消せる。間違いを直せる人がいなくなると詰むため。
-- 受理済みのものを直したいときは、先に受理を取り消してから消す運用でもよいが、
-- 運営はそのまま消せるようにしておく。

create or replace function public.check_sale_deletable()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  invoice_no_found text;
begin
  -- 運営はどれでも消せる
  if public.is_admin() then
    return old;
  end if;

  -- 受理済みは消せない
  if old.accepted_at is not null then
    raise exception
      'この売上報告は運営が受理済みのため、削除できません。修正が必要な場合は運営（info@connect-navi.com）までご連絡ください。'
      using errcode = 'check_violation';
  end if;

  -- 請求書の根拠になっているものは消せない。
  -- 取り消した請求書（voided_at あり）は数えない
  select i.invoice_no into invoice_no_found
  from public.invoices i
  where i.voided_at is null
    and i.sale_ids is not null
    and old.id = any (i.sale_ids)
  limit 1;

  if invoice_no_found is not null then
    raise exception
      'この売上をもとに請求書（%）を発行済みのため、削除できません。運営（info@connect-navi.com）までご連絡ください。', invoice_no_found
      using errcode = 'check_violation';
  end if;

  return old;
end;
$$;

comment on function public.check_sale_deletable() is
  '売上報告を消してよいか確かめる。受理済みと請求済みは出店者から消せない。運営は消せる';

drop trigger if exists sales_deletable on public.sales;
create trigger sales_deletable
  before delete on public.sales
  for each row
  execute function public.check_sale_deletable();


-- 入ったことの確認
select
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'sales'
      and column_name in ('accepted_at', 'accepted_by'))            as 受理の列,
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'applications'
      and column_name = 'sales_reminder_sent_at')                   as 督促日時の列,
  (select relrowsecurity from pg_class
    where relname = 'sales_reminder_log')                           as 督促記録のRLS,
  (select count(*) from pg_policies
    where schemaname = 'public' and tablename = 'sales_reminder_log') as ポリシーの数,
  (select count(*) from pg_trigger
    where tgname = 'sales_deletable')                                 as 削除制限のトリガー;
