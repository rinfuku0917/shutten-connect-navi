-- 書類の有効期限のお知らせを「いつ送ったか」を控える列。
--
-- なぜ要るか（2026-10-01）:
--   提出書類の有効期限は出店者の画面に出るだけで、メールでの知らせが無かった。
--   その結果、お預かりしている損害賠償保険証書818件のうち565件が
--   有効期限を過ぎたまま残っていた（更新したのに出し直していないだけの
--   ものも含むが、こちらの写しが古いままなのは変わらない）。
--
--   毎朝の定期実行（/api/cron/document-expiry）でお知らせを送るが、
--   同じ書類に毎日送ると迷惑なので、送った時刻をここに控える。
--
-- なぜ日付ではなく時刻か:
--   売上報告の催促（applications.sales_reminded_at）と同じ形にそろえる。
--
-- 書き換えるのはサービスロール（定期実行）だけなので、
-- authenticated への grant は足さない（AGENTS.md の既定権限の決まり）。
-- 出店者の画面はこの列を読まない。

alter table public.seller_documents
  add column if not exists expiry_reminded_at timestamptz;

comment on column public.seller_documents.expiry_reminded_at is
  '有効期限のお知らせを送った時刻。null なら未送信。'
  '書類を出し直して expiry_date が変わったら null に戻す（新しい期限で改めて知らせるため）';

-- 期限が近い書類を毎朝さがすので、その条件で引ける索引を置く。
-- 期限の無い書類（食品衛生責任者証など）は対象外なので索引からも外す
create index if not exists seller_documents_expiry_idx
  on public.seller_documents (expiry_date)
  where expiry_date is not null;
