import { supabase } from './supabase'

// 売上報告を経理用のスプレッドシートへ送るよう、画面から頼む。
//
// なぜこの薄い関数を置くか:
//   売上の報告は3か所から入る（運営の代理入力、出店者の1件報告、
//   出店者のまとめ入力）。さらに請求書の発行・取り消しでも
//   同じ行を送り直す必要がある。呼ぶ場所が増えるので、
//   「失敗しても画面を止めない」「返り値を見ない」という約束を
//   1か所に閉じ込める。
//
// 送信そのものは /api/sheets/sales が受ける（合い鍵はサーバー側にしかない）。
//
// ここでは待たない・失敗を画面に出さない:
//   報告そのものは保存できているので、シートへ送れなかったことで
//   出店者の操作を失敗にしてはいけない。送れなかった売上は
//   sales.sheet_error に残り、運営の画面から送り直せる。
//   「報告できたのにエラーが出る」より「あとで運営が送り直す」ほうが良い。

/**
 * 指定した売上を、経理用シートへ送るよう頼む。
 * 待たないので、呼び出し側で await しなくてよい（await しても害はない）。
 */
export async function syncSalesToSheet(saleIds: string[]): Promise<void> {
  const ids = saleIds.filter(Boolean)
  if (ids.length === 0) return
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token
    if (!token) return
    await fetch('/api/sheets/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ saleIds: ids }),
    })
  } catch {
    // 送れなかったことは sales.sheet_error に残る。
    // ここで画面に出すと、報告は成功しているのに失敗に見える
  }
}
