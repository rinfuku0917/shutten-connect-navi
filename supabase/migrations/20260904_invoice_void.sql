-- 発行した請求書を「取り消し」にできるようにする。
--
-- なぜ削除ではないのか:
--
-- 請求書の番号は「年-4桁連番」で採番していて、次の番号は
-- 「その年でいちばん大きい番号 + 1」で決めている
-- （app/api/admin/invoice/route.ts）。
-- 行を消すと、その番号が空くだけでなく、消したものが最大値だった場合に
-- 次の発行で同じ番号が使い回される。既に先方へ送ったあとだと、
-- 同じ番号の請求書が2枚存在することになる。
--
-- 適格請求書（登録番号 T-6010601064156 で発行している）でもあるため、
-- 出したものを無かったことにはできない。取り消した記録を残すのが正しい。
--
-- そこで、行はそのまま残して「取り消した」印だけを付ける。
--   ・番号は残る（使い回されない）
--   ・誰がいつ、なぜ取り消したかが残る
--   ・出店者の画面からは消える
--   ・入金の集計からも外れる

alter table public.invoices
  add column if not exists voided_at   timestamptz,
  add column if not exists voided_by   uuid,
  add column if not exists void_reason text;

comment on column public.invoices.voided_at   is '取り消した日時。null は有効な請求書';
comment on column public.invoices.voided_by   is '取り消した管理者';
comment on column public.invoices.void_reason is '取り消した理由（金額の誤り、テストで作成、など）';

-- 有効な請求書だけを引く場面が多いため索引を用意する
create index if not exists invoices_live_idx
  on public.invoices (seller_id, period)
  where voided_at is null;
