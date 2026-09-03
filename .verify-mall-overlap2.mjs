import fs from 'fs'
const OUT = '/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad'
const posts = JSON.parse(fs.readFileSync(`${OUT}/posts.json`, 'utf8'))
const by = Object.fromEntries(posts.map(p => [p.slug, p]))

// 原稿(.md)からフロントマターを外して本文だけにする
function fromMd(path) {
  const raw = fs.readFileSync(path, 'utf8')
  const m = raw.match(/^---\n[\s\S]*?\n---\n/)
  return m ? raw.slice(m[0].length) : raw
}

// 本文の「字」。マークダウンの記号・画像・リンクURL・空白を落として数える
function plain(md) {
  return String(md ?? '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')      // 画像
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')   // リンクは表示文字だけ残す
    .replace(/^#{1,6}\s*/gm, '')               // 見出し記号
    .replace(/^\s*[-*]\s+/gm, '')              // 箇条書き記号
    .replace(/^\s*\d+\.\s+/gm, '')
    .replace(/\|/g, '')                        // 表の罫線
    .replace(/^\s*:?-{2,}:?\s*$/gm, '')
    .replace(/\*\*?/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/\s+/g, '')                       // 空白・改行
}

const mall = plain(fromMd('docs/blog/mall-food-truck-event.md'))
const reg = plain(by['regular-event-schedule'].content)
const host = plain(by['host-fee-setting-guide'].content)
const sup = plain(fromMd('docs/blog/supermarket-food-truck.md'))
const park = plain(by['renting-parking-space'].content)
const invite = plain(by['how-to-invite-kitchen-car'].content)

console.log('== 本文の字数（記号を除いた実文字） ==')
for (const [n, t] of [['mall(原稿)', mall], ['regular-event-schedule(DB)', reg],
  ['host-fee-setting-guide(DB)', host], ['supermarket(原稿)', sup],
  ['renting-parking-space(DB)', park], ['how-to-invite(DB)', invite]]) {
  console.log(`  ${n}: ${t.length}字`)
}
console.log('  regular 生content:', by['regular-event-schedule'].content.length)

// n-gram の重なり。3種類の指標で見る
const grams = (s, n) => { const g = new Set(); for (let i = 0; i + n <= s.length; i++) g.add(s.slice(i, i + n)); return g }
function cmp(a, b, n) {
  const A = grams(a, n), B = grams(b, n)
  let inter = 0
  for (const g of A) if (B.has(g)) inter++
  return {
    jaccard: (inter / (A.size + B.size - inter) * 100).toFixed(1),
    containA: (inter / A.size * 100).toFixed(1),   // Aのうち何%がBにもある
    inter,
  }
}

console.log('\n== mall と各記事の文字n-gram重なり ==')
const targets = [['regular-event-schedule', reg], ['host-fee-setting-guide', host],
  ['supermarket-food-truck', sup], ['renting-parking-space', park], ['how-to-invite', invite]]
for (const n of [4, 6, 8, 10, 15, 20]) {
  console.log(`-- ${n}文字の連なり --`)
  for (const [name, t] of targets) {
    const r = cmp(mall, t, n)
    console.log(`  mall × ${name.padEnd(24)} Jaccard ${String(r.jaccard).padStart(5)}%  mall側の一致 ${String(r.containA).padStart(5)}%  (${r.inter}種)`)
  }
}

// 一致した長めの連なりを実際に見る
console.log('\n== mall × regular で一致した10文字以上の連なり（最長20件） ==')
const A = grams(mall, 10), B = grams(reg, 10)
const hits = [...A].filter(g => B.has(g))
console.log('  10文字一致:', hits.length, '種')
console.log(hits.sort((x, y) => y.length - x.length).slice(0, 20).map(s => '   「' + s + '」').join('\n'))

// 語の重なり（記事の主題語）
console.log('\n== 主題語の出現回数 ==')
const words = ['曜日', '時間帯', '何時', '11時', '12時', 'ランチ', '台数', '1台', '常設', '定期開催',
  '頻度', 'ローテーション', 'テスト', '3か月', '3ヶ月', '出店料', '円', '%', '％', 'フードコート',
  '商業施設', 'モール', 'オフィス', '併用', '歩合', '固定']
const count = (t, w) => (t.split(w).length - 1)
console.log('  語'.padEnd(16), 'mall', 'regular', 'host')
for (const w of words) {
  const a = count(mall, w), b = count(reg, w), c = count(host, w)
  if (a || b || c) console.log('  ' + w.padEnd(16) + String(a).padStart(4) + String(b).padStart(8) + String(c).padStart(6))
}

// 見出しの比較
const heads = md => String(md).split('\n').filter(l => /^#{2,3}\s/.test(l)).map(l => l.trim())
console.log('\n== mall の見出し ==');  console.log(heads(fromMd('docs/blog/mall-food-truck-event.md')).join('\n'))
console.log('\n== regular-event-schedule の見出し =='); console.log(heads(by['regular-event-schedule'].content).join('\n'))
console.log('\n== host-fee-setting-guide の見出し =='); console.log(heads(by['host-fee-setting-guide'].content).join('\n'))
