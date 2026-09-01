import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json', 'utf8'))
const find = t => pub.find(p => (p.title || '').includes(t))

// ---- 手で分類する。キッチンカーの1日料金だけを採る ----
// [タイトル一致, 分類, 平日額, 週末額]
const M = [
  // 純粋固定（%を含まない）
  ['サンユーストアー 千波店','fixed',5000,5000],
  ['サンユーストアー 磯原中央店','fixed',5000,5000],
  ['サンユーストアー秋山店','fixed',5000,5000],
  ['サンユーストアー 中郷店','fixed',5000,5000],
  ['サンユーストアー 勝田店','fixed',5000,5000],
  ['サンユーストアー まちなか大工町店','fixed',5000,5000],
  ['サンユーストアー 渡里店','fixed',5000,5000],
  ['サンユーストアー 堀口店','fixed',5000,5000],
  ['サンユーストアー 東町店','fixed',5000,5000],
  ['サンユーストアー おおみか店','fixed',5000,5000],
  ['サンユーストアー 新鮎川店','fixed',5000,5000],
  ['サンユーストアー 生鮮市場 ひたちなか店','fixed',5000,5000],
  ['サンユーストアー 東多賀店','fixed',5000,5000],
  ['サンユーストアー 新手綱店','fixed',5000,5000],
  ['イオン大網白里店','fixed',7500,7500],
  ['イオンタウンふじみ野','fixed',7000,8000],
  ['アクロスモール新鎌ヶ谷','fixed',7000,9000],
  ['MEGAドン・キホーテ 高井戸店','fixed',5500,7500],
  ['【1１月〜常設案件】イオンタウンユーカリが丘','fixed',7500,7500],
  ['【イオン八街店】','fixed',5000,7500],
  ['【常設案件】イオンスタイル河辺','fixed',5000,7000],
  ['【イオンタウン上里】','fixed',7500,7500],
  ['出店者募集 【イオンスタイルせんげん台】','fixed',5000,5000],
  ['イオン海浜幕張店','fixed',7500,7500],
  ['イオンモール富津','fixed',7500,7500],
  ['イオンタウン館山','fixed',7500,7500],
  ['イオン秦野ショッピングセンター','fixed',8000,8000],
  ['イオンスタイル千葉みなと','fixed',4500,6500],
  ['出店者募集 【イオンスタイル入間】','fixed',7500,7500],
  ['イオンスタイル南栗橋','fixed',5000,7500],
  ['そよら イオンスタイル湘南茅ヶ崎','fixed',5000,5000],
  ['イオンタウン木更津請西','fixed',7500,7500],
  ['地域猫マルシェ','fixed',5000,5000],       // キッチンカー相当=飲食5,000
  ['尼涼祭アミュゼフェスタ','fixed',2000,2000], // 3,000(駐車あり)/2,000(駐車なし) 日種別なし
  // 併用（固定＋歩合）
  ['あびこショッピングプラザ','combo',3000,3000],
  ['横浜ワールドポーターズ','combo',3000,3000],
  ['【常設案件】イオンモールむさし村山','combo',3000,3000],
  ['ステラタウン','combo',3000,3000],
  ['イオン八潮南','combo',3000,3000],
  ['イオンスタイル板橋前野町店','combo',4000,4000],
  ['まちかどスペース','combo',2500,2500],
  ['【常設案件】イオンモール与野','combo',2000,7500],
  ['イオンモール富谷','combo',2000,7500],
]
for (const [t] of M) if (!find(t)) console.log('!! 見つからない:', t)

// Olympic 16店（純粋固定 平日3,000 / 週末4,500）
const oly = pub.filter(p => /^Olympic /.test(p.title || ''))
console.log('Olympic 系:', oly.length, '件')
for (const p of oly) M.push([p.title, 'fixed', 3000, 4500])

const med = a => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2 }
const report = (label, rows) => {
  const wd = rows.map(r => r[2]), we = rows.map(r => r[3])
  console.log(`\n【${label}】 ${rows.length}件`)
  console.log(`  平日: 件数${wd.length} 中央値${med(wd)} 最低${Math.min(...wd)} 最高${Math.max(...wd)}`)
  console.log(`  週末: 件数${we.length} 中央値${med(we)} 最低${Math.min(...we)} 最高${Math.max(...we)}`)
  const tally = a => [...a.reduce((m, v) => m.set(v, (m.get(v) || 0) + 1), new Map())].sort((x, y) => y[1] - x[1]).slice(0, 4)
  console.log('  平日 最頻:', JSON.stringify(tally(wd)), ' 週末 最頻:', JSON.stringify(tally(we)))
  console.log('  平日 3,000円未満:', rows.filter(r => r[2] < 3000).map(r => `${r[0]}(${r[2]})`).join(' / ') || 'なし')
}
report('固定制のみ（純粋固定）', M.filter(r => r[1] === 'fixed'))
report('固定制＋併用', M)
report('併用のみ', M.filter(r => r[1] === 'combo'))
