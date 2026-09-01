import fs from 'node:fs'
const pub = JSON.parse(fs.readFileSync('/private/tmp/claude-501/-Users-hidekifukusada-Desktop--------shutten-connect-navi/db7d6515-4023-44ab-9971-494a02f7a39c/scratchpad/pub.json', 'utf8'))

// fee 文字列ごとに件数をまとめる（同一運営の一括募集をつぶさず件数も見る）
const byFee = new Map()
for (const p of pub) {
  const f = (p.fee ?? '(null)').trim()
  if (!byFee.has(f)) byFee.set(f, [])
  byFee.get(f).push(p.title)
}
console.log('ユニークな fee 文字列:', byFee.size, '/ 公開中', pub.length, '件\n')

const rows = [...byFee.entries()].sort((a, b) => b[1].length - a[1].length)
for (const [fee, titles] of rows) {
  console.log(`[${String(titles.length).padStart(2)}件] ${fee}`)
}

// ---- 金額らしき数字を全部拾って、低い順に並べる（下限の反証用）----
console.log('\n===== fee 文字列に出てくる「円」の金額を全部抽出、低い順 =====')
const amounts = []
for (const p of pub) {
  const f = p.fee ?? ''
  const re = /([0-9０-９,，]+)\s*円/g
  let m
  while ((m = re.exec(f))) {
    const n = Number(m[1].replace(/[,，]/g, '').replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0)))
    if (Number.isFinite(n) && n > 0) amounts.push({ n, title: p.title, fee: f, id: p.id })
  }
}
amounts.sort((a, b) => a.n - b.n)
for (const a of amounts.slice(0, 40)) {
  console.log(`${String(a.n).padStart(6)}円 | ${a.title} | ${a.fee}`)
}
