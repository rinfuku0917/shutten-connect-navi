/**
 * 経理用スプレッドシートの受け口（Google Apps Script）。
 *
 * ─────────────────────────────────────────────
 * 置き方（5分ほど）
 * ─────────────────────────────────────────────
 * ★ 経理シートの「拡張機能 → Apps Script」には貼らないこと。
 *   2026-09-13 に確かめたところ、経理シート（タスク管理）には既に
 *   「出店コネクトナビ業務改善」という Apps Script があり、30_Webhook.gs で
 *   LINE の受け口（doPost）を持っている。1つのプロジェクトに doPost は1つしか置けず、
 *   同じプロジェクトに足すと LINE の連携が止まる。中身を消して貼るのは論外。
 *   そのため、シートとは別の「単独のプロジェクト」を作り、シートを ID で開いて書き込む。
 *
 * 1. https://script.google.com/home を開き、「新しいプロジェクト」
 * 2. 名前を「出店コネクトナビ 売上連携」などにする
 * 3. editor の中身（空の myFunction）を消して、このファイルを丸ごと貼る
 * 4. 下の SPREADSHEET_ID と SECRET を書き換える
 *      SPREADSHEET_ID … 経理シートの URL の /d/ と /edit の間の文字列
 *      SECRET         … 推測できない長い文字列（Vercel の SHEET_WEBHOOK_SECRET と同じ値）
 * 5. 保存して、上の関数の選択で testWrite を選び「実行」
 *      初回は Google の許可画面が出る（スプレッドシートの読み書き）→ 許可
 *      経理シートの一番右に「売上報告（サイト連携）」タブができ、テスト行が1本入る
 *      確認できたらテスト行（売上ID test-0001）を消す
 * 6. 右上の「デプロイ」→「新しいデプロイ」
 *      種類  : ウェブアプリ
 *      次のユーザーとして実行 : 自分
 *      アクセスできるユーザー : 全員
 *    →「デプロイ」を押すと URL が出る（.../exec で終わるもの）
 * 7. Vercel の環境変数に2つ入れる（Production / Preview の両方）
 *      SHEET_WEBHOOK_URL    = 手順6で出た URL
 *      SHEET_WEBHOOK_SECRET = 手順4で決めた文字列
 * 8. 入れたら再デプロイ（環境変数は再デプロイしないと効きません）
 *
 * 注意
 *  ・「アクセスできるユーザー : 全員」でないと、こちらから送れません。
 *    誰でも URL を叩けますが、SECRET が合わないものは捨てます。
 *  ・コードを直したら、もう一度「デプロイ」→「デプロイを管理」→ 鉛筆 →
 *    「新しいバージョン」→「デプロイ」。これをしないと古いままです。
 *  ・書き込むのは「売上報告（サイト連携）」タブだけ。無ければ一番右に作る。
 *    タスク管理・お金管理など、既存のタブには触らない
 *    （お金管理は列の並びが違い、業務改善のスクリプトが読んでいるため）。
 *  ・タブ名を変えると、次に送られてきたときに同じ名前のタブが新しく作られる。
 *    名前を変えたいときは、下の SHEET_NAME も同じ名前に直して新しいバージョンをデプロイする。
 *
 * ─────────────────────────────────────────────
 * していること
 * ─────────────────────────────────────────────
 * 売上IDをキーにして、同じIDの行があれば上書き、無ければ末尾に足す。
 * 売上が報告されたときと、請求書を発行・取り消したときの2回送られてくるため、
 * 単純に足すだけだと同じ売上が二重に並んでしまう。
 * ほぼ同時に2通届いたときに同じ売上が2行できないよう、書き込みの間は鍵をかける。
 */

// ★経理シートの ID（URL の /d/ と /edit の間）
var SPREADSHEET_ID = 'ここに経理シートのIDを入れる';

// 書き込み先のタブ名。既存のタブと重ならない名前にする
var SHEET_NAME = '売上報告（サイト連携）';

// ★推測できない長い文字列に書き換える（Vercel の SHEET_WEBHOOK_SECRET と同じ値）
var SECRET = 'ここを書き換える';

// 書き込み先のタブを返す。無ければ一番右に作る（既存のタブの並びを変えない）
function targetSheet_() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME, ss.getSheets().length);
  return sheet;
}

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);

    // 合い鍵が違うものは捨てる。URL は誰でも叩けるため
    if (!body.secret || body.secret !== SECRET) {
      return ContentService.createTextOutput('ng: bad secret');
    }

    var headers = body.headers || [];
    var rows = body.rows || [];
    if (!headers.length || !rows.length) {
      return ContentService.createTextOutput('ok: nothing to write');
    }

    // 同時に届いた2通が、同じ売上を2行足さないようにする
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      return ContentService.createTextOutput(writeRows_(headers, rows));
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    // 失敗の理由を返す。こちら側の画面に、その文字がそのまま出る
    return ContentService.createTextOutput('ng: ' + err);
  }
}

// 売上IDで上書きするか末尾に足すかを決めて書く。結果の文字（ok: …）を返す
function writeRows_(headers, rows) {
  var sheet = targetSheet_();

  // 1行目が空なら見出しを書く。すでにあるなら触らない
  // （経理が列の順番や表示形式を整えている場合に壊さないため）
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  // いまシートにある売上IDの位置を覚える（1列目が売上ID）
  var lastRow = sheet.getLastRow();
  var idToRow = {};
  if (lastRow >= 2) {
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    for (var i = 0; i < ids.length; i++) {
      var v = String(ids[i][0] || '');
      if (v) idToRow[v] = i + 2;   // 2行目から始まる
    }
  }

  var added = 0;
  var updated = 0;
  var appendBuffer = [];

  for (var r = 0; r < rows.length; r++) {
    var obj = rows[r];
    var line = [];
    for (var h = 0; h < headers.length; h++) {
      var val = obj[headers[h]];
      line.push(val === undefined || val === null ? '' : val);
    }
    var saleId = String(line[0] || '');
    var at = saleId ? idToRow[saleId] : null;
    if (at) {
      // 同じ売上の行があれば、その行をまるごと差し替える
      sheet.getRange(at, 1, 1, line.length).setValues([line]);
      updated++;
    } else {
      appendBuffer.push(line);
      added++;
    }
  }

  // 足すぶんは1回でまとめて書く（1行ずつ書くと遅く、上限にも当たりやすい）
  if (appendBuffer.length > 0) {
    sheet.getRange(sheet.getLastRow() + 1, 1, appendBuffer.length, headers.length)
      .setValues(appendBuffer);
  }

  return 'ok: added ' + added + ', updated ' + updated;
}

/**
 * 置いたあとの確認用。
 * editor の上の「関数を選択」で testWrite を選んで実行すると、
 * 「売上報告（サイト連携）」タブに見出しとテスト行が1本入る。確認できたらその行を消してください。
 */
function testWrite() {
  var res = doPost({
    postData: {
      contents: JSON.stringify({
        secret: SECRET,
        headers: ['売上ID', '報告日時', '出店者', '施設・案件', '出店日', '売上額',
          '取引先へ渡す額', '弊社の取り分', '確定手数料', '請求書ID', '発行状況',
          '入金状況', '入金日', '入金額'],
        rows: [{
          '売上ID': 'test-0001', '報告日時': '2026-09-12 16:53',
          '出店者': 'テスト出店者', '施設・案件': 'テスト会場', '出店日': '2026-09-12',
          '売上額': 50000, '取引先へ渡す額': 0, '弊社の取り分': 5000, '確定手数料': 5000,
          '請求書ID': '', '発行状況': '未発行', '入金状況': '—', '入金日': '', '入金額': '',
        }],
      }),
    },
  });
  Logger.log(res.getContent());
}
