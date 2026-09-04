-- 申込の受付可否を、データベース側でも確かめるようにする。
--
-- ★ 20260904_apply_window.sql の後に流すこと。
--    この移行は同じ関数 public.check_apply_window() を置き換える。
--    先に流してしまうと、後から apply_window.sql が古い中身で上書きしてしまう。
--    本番には 20260904_apply_window.sql が既に反映済みなので、
--    本番ではこのファイルだけを流せばよい。
--
-- 申込は画面から直接 insert される（app/places/[id]/PlaceDetailClient.tsx の
-- supabase.from('applications').insert）。サーバを経由しないため、
-- 画面側の制御はすべて「選びにくくする」だけで、実際には止められない。
-- ブラウザの開発者ツールから直接投げれば、どんな値でも通ってしまう。
--
-- これまで塞げていたのは「何ヶ月先まで申し込めるか」だけだった。
-- 残っていた2つの穴を、同じ関数の中で塞ぐ。
--
--   1. 募集終了（places.closed = true）の案件に申し込める
--      画面では申込枠を出していないだけだった。
--   2. 応募締切（places.details->>'deadline'）を過ぎても申し込める
--      画面に日付を表示しているだけで、どこでも確かめていなかった。
--
-- トリガーは増やさず、既存の applications_apply_window に相乗りさせる。
-- 別のトリガーに分けると、どちらが先に走るかで出るメッセージが変わり、
-- 出店者に見える文面が安定しない。
--
-- 関数名は check_apply_window のまま変えていない。
-- 「いま申込を受け付けている状態か」を見る関数という意味では、
-- 募集終了も応募締切も同じ窓（window）の話であるため。
-- 名前を変えるとトリガーの張り替えが必要になり、
-- 張り替え漏れがそのまま「検証が消える」事故になる。

create or replace function public.check_apply_window()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  months        smallint;
  is_closed     boolean;
  raw_deadline  text;
  deadline_date date;
  today_jst     date;
  limit_date    date;
begin
  -- 「今日」は日本時間で数える。サーバは UTC で動くため、
  -- そのままだと日本の朝9時までは前日として扱われ、締切も上限も1日ずれる。
  today_jst := (now() at time zone 'Asia/Tokyo')::date;

  select p.apply_within_months, coalesce(p.closed, false), p.details->>'deadline'
    into months, is_closed, raw_deadline
  from public.places p
  where p.id = new.place_id;

  -- ここから下の2つ（募集終了・応募締切）は、新しい申込を作るときだけ見る。
  --
  -- 更新で見ない理由:
  -- どちらも「いま新しく申し込めるか」の話で、すでに受け付けた申込には関係がない。
  -- 更新でも弾いてしまうと、募集終了後や締切後に運営が出店日を振り替えられなくなる。
  -- （当日の進行の時刻列などは apply_date を触らないため、
  --   そもそもこのトリガー自体が走らない。）
  if TG_OP = 'INSERT' then

    -- 1. 募集が終わった案件
    if is_closed then
      raise exception
        'この案件は募集を終了しました。ほかの案件をご覧ください。'
        using errcode = 'check_violation';
    end if;

    -- 2. 応募締切を過ぎた案件
    --
    -- details は入力フォームの値をそのまま持つ JSON で、deadline は
    -- <input type="date"> から来るため通常は 'YYYY-MM-DD'。
    -- ただし空文字や、旧サイトから移行した自由文が入っていることがある。
    -- 日付として読めないものは「締切が決まっていない」とみなして制限しない。
    -- ここで弾いてしまうと、締切を書いていないだけの案件まで
    -- 申し込めなくなり、募集そのものが止まる。
    raw_deadline := nullif(btrim(coalesce(raw_deadline, '')), '');
    if raw_deadline is not null then
      begin
        deadline_date := raw_deadline::date;
      exception when others then
        -- 日付として読めない値。制限しない
        deadline_date := null;
      end;

      -- 締切日そのものは、まだ申し込める（当日消印有効と同じ扱い）
      if deadline_date is not null and today_jst > deadline_date then
        raise exception
          'この案件の応募締切（%）を過ぎています。', to_char(deadline_date, 'YYYY/MM/DD')
          using errcode = 'check_violation';
      end if;
    end if;

  end if;

  -- 3. 何ヶ月先まで申し込めるかの上限（ここまでの動きは今までどおり）
  --
  -- 日付を決めずに応募する案件（日程未定）は対象外
  if new.apply_date is null then
    return new;
  end if;

  -- 上限が設定されていない案件は今までどおり
  if months is null then
    return new;
  end if;

  -- 「1ヶ月先」は暦どおりに数える。interval を使うと Postgres が
  -- 月末を丸めてくれる（1月31日 + 1ヶ月 = 2月28日）。
  limit_date := (today_jst + (months || ' month')::interval)::date;

  if new.apply_date > limit_date then
    raise exception
      'この案件は % ヶ月先（%まで）のお申し込みとなります。', months, to_char(limit_date, 'YYYY/MM/DD')
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function public.check_apply_window() is
  '申込を受け付けてよいか確かめる。募集終了（places.closed）・応募締切（details->>deadline）は新規申込のみ、希望日の上限（places.apply_within_months）は日付の変更時も見る';

-- トリガーは 20260904_apply_window.sql で作ったものをそのまま使う。
-- 張り替えないが、その移行が流れていない環境でも動くように、
-- 同じ定義をここにも置いておく（create or replace ではないため drop してから作る）。
--
-- update of apply_date と絞ることで、当日の進行（checked_in_at など）の
-- 更新のたびに走らないようにしている。
drop trigger if exists applications_apply_window on public.applications;
create trigger applications_apply_window
  before insert or update of apply_date on public.applications
  for each row
  execute function public.check_apply_window();
