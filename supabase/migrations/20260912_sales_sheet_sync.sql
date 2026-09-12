-- 売上報告を経理用のスプレッドシートへ送った記録。
--
-- なぜ列が要るか:
--   送信は外へのHTTP（Apps Script のウェブアプリ）なので、必ず失敗しうる。
--   通信が切れた、Apps Script の実行上限に当たった、URLを貼り替えた途中だった。
--   黙って捨てると、経理のシートに行が欠けたまま誰も気づかない。
--   送れたか・失敗したかを1行ごとに残して、あとから送り直せるようにする。
--
--   sheet_synced_at … 送れた日時。null なら未送信
--   sheet_error     … 直近の失敗の理由。成功したら null に戻す
--
-- 入金額も持つ:
--   これまで請求額（invoices.total）しか無く、実際にいくら入金されたかを
--   残せなかった。一部だけ入金された、振込手数料が引かれていた、
--   多く振り込まれた——回収の実務ではどれも起きる。
--   請求額との差を出せるように、受け取った額を別に持つ。

alter table public.sales
  add column if not exists sheet_synced_at timestamptz,
  add column if not exists sheet_error     text;

-- 未送信のものを拾うため。送れたものは対象外なので、部分索引にしている
create index if not exists sales_sheet_pending_idx
  on public.sales (created_at desc)
  where sheet_synced_at is null;

comment on column public.sales.sheet_synced_at is
  '経理用スプレッドシートへ送れた日時。null は未送信（管理画面から送り直せる）';
comment on column public.sales.sheet_error is
  '直近の送信失敗の理由。成功したら null に戻す';

-- 実際に受け取った金額。請求額（total）との差を出すために別に持つ
alter table public.invoices
  add column if not exists paid_amount integer;

comment on column public.invoices.paid_amount is
  '実際に入金された額（円）。請求額と違う場合（一部入金・振込手数料の差引き・過入金）に入れる。null なら請求額どおり';

-- 確認
--   select count(*) as 未送信 from public.sales where sheet_synced_at is null;
--   select count(*) as 送信済 from public.sales where sheet_synced_at is not null;
--   select invoice_no, total, paid_amount from public.invoices where paid_amount is not null;
