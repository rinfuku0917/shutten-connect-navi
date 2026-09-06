// 送信メールの文面の一覧と、差し込みの仕組み。
//
// 各APIは、ここに書いた既定の文面を渡して renderMail を呼ぶ。
// mail_templates に上書きがあればそちらを、無ければ既定を使う。
//
// ★ ここは「どんなメールがあるか」の目録も兼ねている。
//   編集画面（管理画面のメール文面タブ）は、この一覧を読んで
//   何を編集できるかと、使える差し込みを出している。
//   新しいメールを足したら、ここにも足すこと。

export type MailVars = Record<string, string>

export type MailDef = {
  key: string
  /** 編集画面に出す名前 */
  label: string
  /** 誰に届くか。編集する人が影響範囲を分かるように */
  to: string
  /** いつ送られるか */
  when: string
  subject: string
  body: string
  /** 使える差し込み。名前と、何が入るかの説明 */
  vars: { name: string, note: string }[]
}

// 差し込みを実際の値に置き換える。
// {{屋号}} のような形で書く。値が無いものは空文字にする
// （記号がそのまま送られてしまうのを防ぐ）。
export function fillVars(text: string, vars: MailVars): string {
  return text.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, name: string) => vars[name] ?? '')
}

// 文面を組み立てる。
// db は サービスロールの接続。上書きが取れなければ既定を使う
// （文面が取れないせいでメールが送れない、という事態を避ける）。
export async function renderMail(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: any,
  key: string,
  fallback: { subject: string, body: string },
  vars: MailVars,
): Promise<{ subject: string, text: string }> {
  let subject = fallback.subject
  let body = fallback.body
  try {
    const { data } = await db
      .from('mail_templates').select('subject, body').eq('key', key).maybeSingle()
    if (data?.subject) subject = data.subject
    if (data?.body) body = data.body
  } catch {
    // 上書きが読めなくても既定で送る。送れないより送るほうがよい
  }
  return { subject: fillVars(subject, vars), text: fillVars(body, vars) }
}

// データベースの接続を持っていないAPI向け。
// ここで接続を作って上書きを読む。
// 設定が無ければ、そのまま既定の文面を使う（送れないより送る）。
export async function renderMailStandalone(
  key: string,
  fallback: { subject: string, body: string },
  vars: MailVars,
): Promise<{ subject: string, text: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    return { subject: fillVars(fallback.subject, vars), text: fillVars(fallback.body, vars) }
  }
  const { createClient } = await import('@supabase/supabase-js')
  const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })
  return renderMail(db, key, fallback, vars)
}

// ───────────────────────────────────────────────
// 文面の一覧。
// 既定の文面は、いま実際に送られているものをそのまま写している。
// 変えたい場合は画面から上書きする（このファイルは触らない）。
// ───────────────────────────────────────────────
export const MAIL_DEFS: MailDef[] = [
  {
    key: 'sales-remind',
    label: '売上報告の催促',
    to: '出店者',
    when: '出店日を過ぎても売上報告が無いとき。毎朝9時の自動送信と、運営が1件ずつ送る分の両方',
    subject: '【出店コネクトナビ】売上報告のお願い',
    body: `{{屋号}} 様

いつも出店コネクトナビをご利用いただきありがとうございます。

以下のご出店について、売上報告がまだ確認できておりません。
お手数ですが、マイページの「売上報告」からご入力をお願いいたします。

{{出店の一覧}}

▼ 売上報告はこちら（開くと「売上報告」の画面が出ます）
https://app.connect-navi.com/dashboard/seller?tab=sales

すでにご報告いただいている場合は、行き違いですのでご容赦ください。
ご不明な点がございましたら、info@connect-navi.com までご連絡ください。

出店コネクトナビ運営事務局
株式会社nav`,
    vars: [
      { name: '屋号', note: '出店者の屋号。未登録なら代表者名' },
      { name: '出店の一覧', note: '未報告の出店。「・9月3日（2026年） ○○マルシェ」の形で並ぶ' },
    ],
  },
  {
    key: 'password-notice',
    label: 'パスワード設定のご案内',
    to: '出店者（旧サイトからの移行組）',
    when: '運営が管理画面から一斉に送るとき',
    subject: '【出店コネクトナビ】パスワード設定のお願い（新サイトへの移行に伴い）',
    body: `{{屋号}} 様

いつも出店コネクトナビをご利用いただきありがとうございます。

旧サイトからの会員情報の引き継ぎに伴い、新サイトでは
パスワードの再設定をお願いしております。
新しく会員登録をしていただく必要はございません。

▼ こちらからパスワードをお決めください
https://app.connect-navi.com/reset-password

 ① 上のページで、ご登録のメールアドレスを入力
 ② 届いたメールのリンクを開く
 ③ 新しいパスワードを決める

これでログインできるようになります。
メールが見当たらない場合は、迷惑メールフォルダもご確認ください。

すでにログインできている方は、このメールは破棄してください。

ご案内が行き届かず申し訳ございませんでした。
ご不明な点がございましたら、このメールにご返信ください。

出店コネクトナビ運営事務局
株式会社nav`,
    vars: [
      { name: '屋号', note: '出店者の屋号。未登録なら代表者名' },
    ],
  },
  {
    key: 'document-rejected',
    label: '書類の再提出のお願い',
    to: '出店者',
    when: '運営が提出書類を差し戻したとき',
    subject: '【出店コネクトナビ】提出書類について再提出のお願い',
    body: `{{お名前}} 様

ご提出いただいた書類「{{書類の種類}}」を確認いたしましたが、
今回は受理を見送らせていただきました。

【理由】
{{差戻しの理由}}

お手数ですが、内容をご確認のうえ、再度ご提出をお願いいたします。

下のリンクを開くと、マイページの「書類管理」が開きます。
そこから同じ書類をもう一度アップロードしてください。
https://app.connect-navi.com/dashboard/seller?tab=docs`,
    vars: [
      { name: 'お名前', note: '出店者の登録名' },
      { name: '書類の種類', note: '営業許可証、食品衛生責任者証など' },
      { name: '差戻しの理由', note: '運営が入力した理由' },
    ],
  },
  {
    key: 'application-approved',
    label: '申込が承認されたとき',
    to: '出店者',
    when: '運営または募集者が申込を承認したとき',
    subject: '【出店コネクトナビ】「{{案件名}}」への申込が承認されました',
    body: `{{お名前}} 様

ご申込いただいた「{{案件名}}」{{出店日}}への出店が承認されました。

担当者とメッセージでやり取りを進め、当日に向けてご準備ください。

下のリンクを開くと、マイページの「メッセージ」が開きます。
https://app.connect-navi.com/dashboard/seller?tab=messages`,
    vars: [
      { name: 'お名前', note: '出店者の名前' },
      { name: '案件名', note: '申し込まれた案件の名前' },
      { name: '出店日', note: '出店日。（9/5）の形。未定なら空' },
    ],
  },
  {
    key: 'application-rejected',
    label: '申込が不採用になったとき',
    to: '出店者',
    when: '運営または募集者が申込を不採用にしたとき',
    subject: '【出店コネクトナビ】「{{案件名}}」への申込結果のお知らせ',
    body: `{{お名前}} 様

ご申込いただいた「{{案件名}}」{{出店日}}への出店は、
誠に申し訳ございませんが、今回は見送りとなりました。

ご応募いただきありがとうございました。
他の案件も掲載しておりますので、ぜひご覧ください。
https://app.connect-navi.com/places`,
    vars: [
      { name: 'お名前', note: '出店者の名前' },
      { name: '案件名', note: '申し込まれた案件の名前' },
      { name: '出店日', note: '出店日。（9/5）の形。未定なら空' },
    ],
  },
  {
    key: 'new-application',
    label: '新しい申込のお知らせ',
    to: '募集者・運営',
    when: '出店者が案件に申し込んだとき',
    subject: '【出店コネクトナビ】「{{案件名}}」に新しい申込が届きました',
    body: `{{宛名}} 様

あなたの案件「{{案件名}}」に、新しい申込が届きました。

申込者: {{申込者}}
希望日程: {{希望日程}}

ダッシュボードで詳細を確認し、ご対応ください。
https://app.connect-navi.com/dashboard/host`,
    vars: [
      { name: '宛名', note: '募集者の名前' },
      { name: '案件名', note: '申し込まれた案件の名前' },
      { name: '申込者', note: '申し込んだ出店者の名前と屋号' },
      { name: '希望日程', note: '出店を希望する日。複数あれば並ぶ' },
    ],
  },
  {
    key: 'new-message',
    label: '新しいメッセージのお知らせ',
    to: '出店者・募集者',
    when: '相手からメッセージが届いたとき',
    subject: '【出店コネクトナビ】「{{案件名}}」に新しいメッセージが届きました',
    body: `{{宛名}} 様

「{{案件名}}」のやり取りに、新しいメッセージが届きました。

{{案内文}}
{{メッセージ画面のURL}}`,
    vars: [
      { name: '宛名', note: '受け取る人の名前' },
      { name: '案件名', note: 'やり取りしている案件の名前' },
      { name: '案内文', note: '受け取る人に合わせた一文。募集者と出店者で変わる' },
      { name: 'メッセージ画面のURL', note: '受け取る人に合わせた画面のURL' },
    ],
  },
  {
    key: 'new-seller',
    label: '新規登録のお知らせ',
    to: '運営',
    when: '出店者または募集者が新しく登録したとき',
    subject: '【出店コネクトナビ】新規{{種別}}登録: {{お名前}} さん',
    body: `新しい会員が登録しました。

種別: {{種別}}
氏名: {{お名前}}
店舗名: {{屋号}}
メール: {{メールアドレス}}
電話: {{電話番号}}
エリア: {{エリア}}

管理画面で詳細を確認してください。
https://app.connect-navi.com/admin`,
    vars: [
      { name: '種別', note: '出店者（出店したい）または募集者（お店を呼びたい）' },
      { name: 'お名前', note: '登録された氏名' },
      { name: '屋号', note: '登録された店舗名' },
      { name: 'メールアドレス', note: '登録されたメールアドレス' },
      { name: '電話番号', note: '登録された電話番号' },
      { name: 'エリア', note: '登録された出店エリア' },
    ],
  },
  {
    key: 'contact',
    label: 'お問い合わせの転送',
    to: '運営',
    when: 'お問い合わせフォームから送信があったとき',
    subject: '【お問い合わせ】{{お名前}} 様より',
    body: `出店コネクトナビのお問い合わせフォームから送信がありました。

━━━━━━━━━━━━━━━━━━
お名前: {{お名前}}
メール: {{メールアドレス}}
━━━━━━━━━━━━━━━━━━

【お問い合わせ内容】
{{内容}}

━━━━━━━━━━━━━━━━━━
※このメールに返信すると、送信者({{メールアドレス}})に直接届きます。`,
    vars: [
      { name: 'お名前', note: '問い合わせた方の名前' },
      { name: 'メールアドレス', note: '問い合わせた方のメールアドレス' },
      { name: '内容', note: '問い合わせの本文' },
    ],
  },
  {
    key: 'payment-reported',
    label: '振込報告のお知らせ',
    to: '運営',
    when: '出店者がマイページから「振り込みました」と報告したとき',
    subject: '【入金報告】{{屋号}} 様 / {{請求書番号}}',
    body: `出店者から出店料の振込報告がありました。通帳をご確認ください。

出店者: {{屋号}}
請求書番号: {{請求書番号}}
対象月: {{対象月}}
請求額(税込): {{金額}}
振込日: {{振込日}}
振込名義: {{振込名義}}

▼ 入金の確認はこちら（管理画面 → 売上管理 → 入金状況）
https://app.connect-navi.com/admin`,
    vars: [
      { name: '屋号', note: '報告した出店者の屋号' },
      { name: '請求書番号', note: '2026-0042 のような番号' },
      { name: '対象月', note: '2026-09 のような対象の月' },
      { name: '金額', note: '請求額（税込）' },
      { name: '振込日', note: '出店者が入力した振込日。未記入なら「（未記入）」' },
      { name: '振込名義', note: '出店者が入力した名義。未記入なら「（未記入）」' },
    ],
  },
  {
    key: 'payment-confirmed',
    label: '入金確認のお知らせ',
    to: '出店者',
    when: '運営が請求書の入金を「確認済み」にしたとき',
    subject: '【出店コネクトナビ】出店料のご入金を確認いたしました',
    body: `{{屋号}} 様

いつも出店コネクトナビをご利用いただきありがとうございます。
下記の出店料について、ご入金を確認いたしました。

請求書番号: {{請求書番号}}
対象月: {{対象月}}
ご入金額(税込): {{金額}}

お忙しいなかご対応いただき、誠にありがとうございました。
引き続きどうぞよろしくお願いいたします。

出店コネクトナビ運営事務局
株式会社nav`,
    vars: [
      { name: '屋号', note: '出店者の屋号。未登録なら代表者名' },
      { name: '請求書番号', note: '2026-0042 のような番号' },
      { name: '対象月', note: '2026-09 のような対象の月' },
      { name: '金額', note: 'ご入金額（税込）' },
    ],
  },
  {
    key: 'cancel-admin',
    label: '出店取消しの控え（運営あて）',
    to: '運営',
    when: '運営が承認済みの出店を取り消したとき',
    subject: '【出店取消し】「{{案件名}}」{{出店日}}',
    body: `承認済みの出店を取り消しました。

案件: {{案件名}}
出店日: {{出店日}}
出店者: {{屋号}}
理由: {{取消しの理由}}
募集者: {{募集者}}

キャンセルポリシーにより、承認後の取消しはキャンセル料の対象です。
請求が必要かどうかをご確認ください。
https://app.connect-navi.com/admin`,
    vars: [
      { name: '案件名', note: '取り消された案件の名前' },
      { name: '出店日', note: '取り消された出店日。未定なら「日程指定なし」' },
      { name: '屋号', note: '取り消された出店者の屋号' },
      { name: '取消しの理由', note: '運営が入力した理由。未入力なら「記載なし」' },
      { name: '募集者', note: '案件の募集者の名前' },
    ],
  },
  {
    key: 'cancel-host',
    label: '出店取消しのお知らせ（募集者あて）',
    to: '募集者',
    when: '運営が承認済みの出店を取り消したとき',
    subject: '【出店コネクトナビ】「{{案件名}}」の出店が取り消されました',
    body: `{{宛名}} 様

ご案件「{{案件名}}」について、下記の出店が取り消されました。

出店日: {{出店日}}
出店者: {{屋号}}

空いた枠に別の出店者をお探しの場合は、運営までご連絡ください。
https://app.connect-navi.com/dashboard/host`,
    vars: [
      { name: '宛名', note: '募集者の名前' },
      { name: '案件名', note: '取り消された案件の名前' },
      { name: '出店日', note: '取り消された出店日。未定なら「日程指定なし」' },
      { name: '屋号', note: '取り消された出店者の屋号' },
    ],
  },
  {
    key: 'cancel-seller',
    label: '出店取消しのお知らせ（出店者あて）',
    to: '出店者',
    when: '運営が承認済みの出店を取り消したとき',
    subject: '【出店コネクトナビ】「{{案件名}}」の出店取消しを承りました',
    body: `{{宛名}} 様

ご連絡いただいた下記の出店について、取消しの手続きを行いました。

案件: {{案件名}}
出店日: {{出店日}}

なお、出店が確定したあとの取消しはキャンセル料の対象となります。
金額は案件ごとに定めております。追ってご案内いたします。
https://app.connect-navi.com/cancel-policy

ご不明な点がございましたら、このメールにご返信ください。`,
    vars: [
      { name: '宛名', note: '出店者の名前' },
      { name: '案件名', note: '取り消された案件の名前' },
      { name: '出店日', note: '取り消された出店日。未定なら「日程指定なし」' },
    ],
  },
]

export const MAIL_DEF_BY_KEY: Record<string, MailDef> =
  Object.fromEntries(MAIL_DEFS.map(d => [d.key, d]))
