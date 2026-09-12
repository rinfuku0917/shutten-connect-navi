/**
 * 経理用スプレッドシートの受け口（Google Apps Script）。
 *
 * ─────────────────────────────────────────────
 * 置き方（5分ほど）
 * ─────────────────────────────────────────────
 * 1. 経理用のスプレッドシートを開く
 * 2. 上のメニュー「拡張機能」→「Apps Script」
 * 3. 出てきた editor の中身を全部消して、このファイルを丸ごと貼る
 * 4. 下の SECRET を、自分で決めた長い文字列に書き換える
 *    （例: connect-navi-sheet-9f2b7c1a4e ／ 推測できない文字列にする）
 * 5. 右上の「デプロイ」→「新しいデプロイ」
 *      種類  : ウェブアプリ
 *      次のユーザーとして実行 : 自分
 *      アクセスできるユーザー : 全員
 *    →「デプロイ」を押すと URL が出る（.../exec で終わるもの）
 * 6. Vercel の環境変数に2つ入れる（Production / Preview の両方）
 *      SHEET_WEBHOOK_URL    = 手順5で出た URL
 *      SHEET_WEBHOOK_SECRET = 手順4で決めた文字列
 * 7. 入れたら再デプロイ（環境変数は再デプロイしないと効きません）
 *
 * 注意
 *  ・「アクセスできるユーザー : 全員」でないと、こちらから送れません。
 *    誰でも URL を叩けますが、SECRET が合わないものは捨てます。
 *  ・コードを直したら、もう一度「デプロイ」→「デプロイを管理」→ 鉛筆 →
 *    「新しいバージョン」→「デプロイ」。これをしないと古いままです。
 *  ・シートの1枚目に書き込みます。タブ名を変えても動きます。
 *
 * ─────────────────────────────────────────────
 * していること
 * ─────────────────────────────────────────────
 * 売上IDをキーにして、同じIDの行があれば上書き、無ければ末尾に足す。
 * 売上が報告されたときと、請求書を発行・取り消したときの2回送られてくるため、
 * 単純に足すだけだと同じ売上が二重に並んでしまう。
 */

// ★ここを自分で決めた長い文字列に書き換える（Vercel の SHEET_WEBHOOK_SECRET と同じ値）
var SECRET = 'ここを書き換える';

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

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];

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

    return ContentService.createTextOutput('ok: added ' + added + ', updated ' + updated);
  } catch (err) {
    // 失敗の理由を返す。こちら側の画面に、その文字がそのまま出る
    return ContentService.createTextOutput('ng: ' + err);
  }
}

/**
 * 置いたあとの確認用。
 * editor の上の「関数を選択」で testWrite を選んで実行すると、
 * 見出しとテスト行が1本入る。確認できたらその行を消してください。
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
