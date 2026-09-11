import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { verifyCronCaller } from '../../../lib/cronAuth'
import { sendAdminMail } from '../../../lib/notifyRecipients'

// 案件の日程を、毎月おなじ条件で足す。Vercel の定期実行（毎月1日）から呼ばれる。
//
// なぜ要るか:
//   常設の案件（毎週末に出る場所など）では、毎月おなじ条件の日程を
//   入れ直している。31日ぶんを毎月手で足すのは手間で、
//   入れ忘れると募集が止まる。
//
// 何をするか（places.repeat_monthly = true の案件それぞれについて）:
//   1. 終わった日（今日より前）を日程から外す
//      外さないと31日の上限に当たって、翌月ぶんが入らなくなる
//   2. 翌月の、指定した曜日の日を作る
//   3. すでに入っている日は飛ばして、上限31日まで足す
//   4. 募集者と運営に知らせる
//
// 足さないもの:
//   ・募集終了（closed）の案件 … 勝手に募集が続くのを防ぐ
//   ・曜日の指定が無い案件 … 何を足すか決まらない

// 案件の数だけ順に処理し、そのぶんメールも送るため
export const maxDuration = 300

const FROM_EMAIL = 'noreply@mail.connect-navi.com'
const MAX_DAYS = 31

type Day = { date: string; start?: string; end?: string; placeFee?: number; companyFee?: number }

// 日本時間の今日
function todayJst(): string {
  return new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10)
}

// 翌月の、指定した曜日に当たる日をすべて返す
function nextMonthDays(dows: number[]): string[] {
  const jst = new Date(Date.now() + 9 * 60 * 60 * 1000)
  const y = jst.getUTCFullYear()
  const m = jst.getUTCMonth()   // 0から数える
  // 翌月の1日から末日まで
  const first = new Date(Date.UTC(y, m + 1, 1))
  const out: string[] = []
  for (let d = new Date(first); d.getUTCMonth() === first.getUTCMonth(); d.setUTCDate(d.getUTCDate() + 1)) {
    if (dows.includes(d.getUTCDay())) out.push(d.toISOString().slice(0, 10))
  }
  return out
}

export async function GET(req: Request) {
  const auth = await verifyCronCaller(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) return NextResponse.json({ error: 'サーバー設定エラー' }, { status: 500 })
    const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } })

    const { data: places, error } = await db
      .from('places')
      .select('id, title, host_id, closed, schedule, repeat_dows, repeat_start, repeat_end, repeat_place_fee, repeat_company_fee, repeat_last_run_at')
      .eq('repeat_monthly', true)
    if (error) {
      console.error('くり返しの案件を読めませんでした', error.message)
      return NextResponse.json({ error: '読み込みに失敗しました' }, { status: 500 })
    }
    if (!places || places.length === 0) {
      return NextResponse.json({ ok: true, targets: 0, added: 0 })
    }

    const today = todayJst()
    const apiKey = process.env.RESEND_API_KEY
    const resend = apiKey ? new Resend(apiKey) : null
    const report: { title: string; added: number; note?: string }[] = []
    let totalAdded = 0

    // 同じ月に二度足さない。定期実行が重なって呼ばれても、
    // 通知だけが何度も飛ぶことがないようにする
    const thisMonth = today.slice(0, 7)

    for (const p of places) {
      // 募集を終えた案件には足さない。勝手に募集が続くのを防ぐ
      if (p.closed) { report.push({ title: p.title || '(案件名なし)', added: 0, note: '募集終了のため見送り' }); continue }

      const lastRun = p.repeat_last_run_at ? String(p.repeat_last_run_at) : ''
      if (lastRun) {
        // 記録は UTC なので、日本時間に直してから月を比べる
        const jstLast = new Date(new Date(lastRun).getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 7)
        if (jstLast === thisMonth) { continue }
      }

      // Number(null) と Number('') は 0（日曜）になる。
      // 曜日の配列に null や空文字が1つ混ざっているだけで、
      // 指定していない日曜の日程が勝手に足されてしまうため、先に落とす
      const dows: number[] = Array.isArray(p.repeat_dows)
        ? p.repeat_dows
          .filter((x: unknown) => typeof x === 'number' || (typeof x === 'string' && x.trim() !== ''))
          .map((x: unknown) => Number(x))
          .filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 6)
        : []
      if (dows.length === 0) { report.push({ title: p.title || '(案件名なし)', added: 0, note: '曜日が未設定のため見送り' }); continue }

      const cur: Day[] = Array.isArray(p.schedule) ? (p.schedule as Day[]) : []
      // 1. 終わった日を外す。外さないと上限に当たって翌月ぶんが入らない
      const kept = cur.filter(d => d && d.date && String(d.date) >= today)
      const already = new Set(kept.map(d => String(d.date)))
      // 2〜3. 翌月の対象日を、上限まで足す
      const room = Math.max(0, MAX_DAYS - kept.length)
      const add = nextMonthDays(dows).filter(d => !already.has(d)).slice(0, room)
      if (add.length === 0) {
        report.push({
          title: p.title || '(案件名なし)', added: 0,
          note: room === 0 ? '日程が上限（31日）に達しているため見送り' : '足す日がありませんでした',
        })
        continue
      }

      const rows: Day[] = add.map(date => ({
        date,
        start: p.repeat_start || '選択してください',
        end: p.repeat_end || '選択してください',
        ...(p.repeat_place_fee != null ? { placeFee: Number(p.repeat_place_fee) } : {}),
        ...(p.repeat_company_fee != null ? { companyFee: Number(p.repeat_company_fee) } : {}),
      }))
      const next = [...kept, ...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)))

      const { error: uErr } = await db.from('places').update({
        schedule: next,
        repeat_last_run_at: new Date().toISOString(),
        repeat_last_added: add.length,
      }).eq('id', p.id)
      if (uErr) {
        console.error('日程の更新に失敗しました', p.id, uErr.message)
        report.push({ title: p.title || '(案件名なし)', added: 0, note: '更新に失敗: ' + uErr.message })
        continue
      }
      totalAdded += add.length
      report.push({ title: p.title || '(案件名なし)', added: add.length })

      // 4. 募集者へ知らせる。気づかないまま公開されるのを防ぐ
      if (resend && p.host_id) {
        const { data: host } = await db
          .from('profiles').select('name, email').eq('id', p.host_id).maybeSingle()
        if (host?.email) {
          try {
            await resend.emails.send({
              from: '出店コネクトナビ <' + FROM_EMAIL + '>',
              to: host.email,
              subject: '【出店コネクトナビ】翌月の日程を追加しました（' + (p.title || '案件') + '）',
              text: [
                (host.name || 'ご担当者') + ' 様',
                '',
                (p.title || '案件') + ' に、翌月の日程を ' + add.length + '日ぶん追加しました。',
                '',
                '追加した日：' + add.map(d => d.replace(/-/g, '/')).join('、'),
                '販売時間：' + (p.repeat_start || '未設定') + '〜' + (p.repeat_end || '未設定'),
                '',
                '内容をご確認ください。変更や取り下げは案件の編集画面から行えます。',
                'くり返しを止めたい場合は、編集画面の「毎月おなじ条件で日程を足す」を外してください。',
                '',
                'https://app.connect-navi.com/dashboard/host',
              ].join('\n'),
            })
          } catch (e) {
            console.error('募集者への通知に失敗しました', p.id, e)
          }
        }
      }
    }

    // 運営へまとめて知らせる
    if (resend && report.length > 0) {
      try {
        await sendAdminMail(resend, 'cancel', {
          from: '出店コネクトナビ <' + FROM_EMAIL + '>',
          subject: '【運営】翌月の日程を自動で追加しました（' + totalAdded + '日ぶん）',
          text: [
            '毎月のくり返し設定にもとづき、翌月の日程を追加しました。',
            '',
            ...report.map(r => '・' + r.title + '：' + r.added + '日' + (r.note ? '（' + r.note + '）' : '')),
          ].join('\n'),
        })
      } catch (e) {
        console.error('運営への通知に失敗しました', e)
      }
    }

    return NextResponse.json({ ok: true, targets: places.length, added: totalAdded, report })
  } catch (e) {
    const msg = e instanceof Error ? e.message : '不明なエラー'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
