-- 出店日の前に出す「出店料の請求」を扱えるようにする。
--
-- 大きなイベントでは、出店料を先に払ってもらって出店が確定し、
-- そのうえで当日の売上の◯％を別途いただくことがある。
-- 1つの出店に対して、性質の違う請求が2本立つ。
--
--   事前  出店料（固定額）      … 席を押さえる代金。売上とは関係しない
--   事後  売上の◯％            … 売れた分の取り分。売上報告から作る
--
-- いまの請求書は後者しか作れない。売上の記録から明細を組み立てる作りで、
-- 売上が1件も無いと「この月の売上記録がありません」で止まる
-- （app/api/admin/invoice/route.ts）。
--
-- 種類を持たせて、2本が同じ月に並んでも取り違えないようにする。
--   sales   … これまでどおり、売上から作る請求
--   advance … 出店日の前に出す、金額を手で決める請求
--
-- 既存の行はすべて sales。読み書きの側も kind で絞るようにしたので、
-- 事前請求を足しても、これまでの請求書の見え方は変わらない。

alter table public.invoices
  add column if not exists kind text not null default 'sales';

-- 既存データはすべて売上からの請求。制約は入っている値を確かめてから付ける
alter table public.invoices
  drop constraint if exists invoices_kind_check;
alter table public.invoices
  add constraint invoices_kind_check check (kind in ('sales', 'advance'));

comment on column public.invoices.kind is
  'sales=売上から作る請求（従来）／advance=出店日の前に出す出店料の請求';

-- どの出店に対する事前請求かを残す。
-- 事後の請求（sales）は sale_ids から辿れるが、事前請求は売上に紐づかないため
-- 申込を直接指しておく。取り消しや問い合わせのときにここから辿る。
alter table public.invoices
  add column if not exists application_id uuid references public.applications(id) on delete set null;

comment on column public.invoices.application_id is
  '事前請求のとき、対象の申込。売上に紐づかないため直接指す';

-- 同じ出店者・同じ月に2本並ぶようになるため、種類で引けるようにする
create index if not exists invoices_seller_period_kind_idx
  on public.invoices (seller_id, period, kind);

create index if not exists invoices_application_idx
  on public.invoices (application_id)
  where application_id is not null;
