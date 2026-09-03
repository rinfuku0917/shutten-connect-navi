// 記事に書いた数字が、いまのデータとずれていないかを調べる。
//
//   npm run blog:check        … いまの数字と、記事に書いた数字を見くらべる
//   npm run blog:check -- --save … いまの数字を「記事に書いた数字」として保存する
//
// なぜ要るか:
//   記事には「募集中110件」「登録1,386店舗」といった数字が入っている。
//   案件が増減すれば、この数字は静かに古くなる。
//   気づかないまま「110件」と書き続けるのが、いちばん起きやすい事故。
//
// 使い方:
//   月に1回ほど npm run blog:check を実行する。
//   ずれた指標と、それを使っている記事が出るので、その記事だけ直す。
//   直したら --save で基準を更新する。
//
// 数え方はここが唯一の正。記事を書くときもこの値を使うこと。
// 数え方を変えたら、その指標を使っている記事を全部直す必要がある。

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const SNAPSHOT = 'docs/blog/metrics.json'
const save = process.argv.includes('--save')

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split('\n').filter(l => l.includes('='))
    .map(l => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]),
)
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
})

// PostgREST は指定しないと1000行で打ち切られる。必ずページングする
async function all(table) {
  const out = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select('*').range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

const norm = s => String(s ?? '')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/,/g, '').replace(/％/g, '%').replace(/\s+/g, ' ')

// 場所の種類。先に一致した区分に入れる（記事の分類と同じ）
const VENUE = [
  ['スーパー・食品店', /スーパー|Olympic|オリンピック|マルエツ|ライフ|ヤオコー|食品館|生鮮|サンユーストアー|ストアー/],
  ['学校・専門学校・大学', /大学|専門学校|高校|学校|学園|学院|キャンパス|学内/],
  ['商業施設・モール', /イオン|モール|ショッピング|商業施設|プラザ|アウトレット|百貨店|アリオ|Ario|ステラタウン|ペリエ|ワールドポーターズ|ららぽーと|タウン/],
  ['ホームセンター・家電量販', /ホームセンター|カインズ|コーナン|ビバホーム|ケーヨー|ジョイフル|家電/],
  ['オフィス・事業所', /オフィス|ビル|本社|事業所|工場|会社|株式会社|センタービル/],
  ['病院・介護施設', /病院|クリニック|医療|介護|老人|福祉/],
  ['マンション・住宅', /マンション|団地|住宅|レジデンス/],
  ['公園・道の駅・公共', /公園|道の駅|市役所|区役所|役場|図書館|文化会館/],
  ['イベント・お祭り', /祭|フェス|マルシェ|イベント|大会|フェア|市$|の市|フリマ|クリマ|FamilyDay|Day$/],
  ['駐車場・遊休地', /駐車場|空き地|遊休/],
  ['ゴルフ場・レジャー', /ゴルフ|キャンプ|遊園地|温泉|プール|スポーツ/],
]
const venueOf = p => {
  const t = `${p.title} ${p.place_type ?? ''} ${(p.genres ?? []).join(' ')}`
  return (VENUE.find(([, re]) => re.test(t)) ?? ['その他'])[0]
}

// 出店料の決め方。募集要項の本文（fee）に書かれている内容で判断する。
// 案件ページの表示は「歩合の設定があれば歩合を優先」なので、そちらとは
// 数が食い違うことがある。記事は本文基準で書いているのでこちらに合わせる。
const feeKindOf = p => {
  const t = norm(p.fee)
  // 「7万円」のような書き方も金額として扱う
  const hasYen = /\d{3,6}\s*円/.test(t) || /\d+\s*万円/.test(t)
  const hasPct = /\d{1,2}\s*%/.test(t)
  // 「売上の10%、上限500円」の500円は、歩合につく上限であって固定額ではない。
  // 同じく最低保証も歩合の一部なので、併用とは数えない。
  const capOnly = /上限|最低保証/.test(t)

  if (hasYen && hasPct && !capOnly) return '併用'
  if (hasPct) return '歩合'
  if (hasYen) {
    // 金額は書いてあるが、それが出店料として確定していないもの。
    //   「ご相談/…最低保証料として8万円程度を予定」… 金額はまだ予定
    //   「無料買取案件5万円税込」                  … 買い取りの話で出店料ではない
    // 一方「キッチンカー出店料：平日5,500円…催事/PRはお問い合わせください」は、
    // 出店料が確定していて別枠だけ相談、という書き方なので固定として数える。
    // 曜日や「1日」と結びついた金額があるかどうかで見分ける。
    const 確定 = /(?:平日|週末|土日|土日祝|休日|1日|一日)[^。]{0,12}?\d{3,6}\s*円/.test(t)
      || /\d{3,6}\s*円\s*\/\s*日/.test(t)
      || /^\s*\d{3,6}\s*円/.test(t)
    if (!確定 && /相談|問い合わせ|問合せ|不明|未定|買取|予定/.test(t)) return '応相談'
    return '固定'
  }
  return '応相談'
}

// 平日と週末の固定額を読み取る。
//
// 書き方は3通りある。記事もこの3通りを同じように扱っている。
//   1. 「平日3,000円、週末4,500円」… 別々に書いてある
//   2. 「平日/週末 5,000円/日」   … 1つの額を両方に当てている
//   3. 「1日7,500円」             … 曜日の区別がない。両方に同じ額が当たる
//
// 電気代・駐車場代・広告料など、出店料そのものでない金額は拾わない。
const SIDE = /電源|電気|光熱|水道|駐車|広告|サイネージ|保証|買取/
const dayFees = p => {
  const t = norm(p.fee)
  // 「キッチンカー出店料：…」があればその節だけを見る（物販の別料金を拾わないため）
  const seg = (t.match(/キッチンカー(?:出店料)?[：: ]?([^物]*)/) ?? [null, t])[1]

  // 2. 1つの額を平日と週末の両方に当てている書き方
  const same = seg.match(/平日\s*[/・、]\s*(?:週末|土日祝|土日)\s*(\d{3,6})\s*円/)
    ?? seg.match(/平日\s*[・･]\s*週末\s*[：:]\s*(\d{3,6})\s*円/)
  if (same) return { wd: +same[1], we: +same[1], 曜日の記載: true }

  // 1. 平日と週末が別々に書いてある
  const a = seg.match(/平日\s*(\d{3,6})\s*円/)
  const b = seg.match(/(?:土日祝|土日|週末|休日)\s*(\d{3,6})\s*円/)
  if (a && b) return { wd: +a[1], we: +b[1], 曜日の記載: true }

  // 3. 曜日の区別がない単一の額
  const one = [...seg.matchAll(/(.{0,6}?)(\d{3,6})\s*円/g)]
    .filter(m => !SIDE.test(m[1])).map(m => +m[2]).filter(v => v >= 1000)
  if (one.length > 0) return { wd: one[0], we: one[0], 曜日の記載: false }

  return null
}

const median = a => { const s = [...a].sort((x, y) => x - y); return s[Math.floor((s.length - 1) / 2)] }
const genresOf = s => {
  let v = s.genre
  if (typeof v === 'string') {
    try { const j = JSON.parse(v); v = Array.isArray(j) ? j : [v] } catch { v = v.split(/[,、，]/) }
  }
  return (v ?? []).map(x => String(x).trim()).filter(Boolean)
}

// ---- ここから集計 ----
const places = await all('places')
const live = places.filter(p => p.status === 'published' && !p.closed)
const sellers = await all('public_sellers')
const menus = await all('menus')

const kinds = live.map(feeKindOf)
const cnt = (arr, v) => arr.filter(x => x === v).length
const venues = live.map(venueOf)
const prefs = {}
for (const p of live) prefs[p.prefecture ?? '-'] = (prefs[p.prefecture ?? '-'] ?? 0) + 1

const pcts = live.flatMap(p => { const m = norm(p.fee).match(/(\d{1,2})\s*%/); return m ? [+m[1]] : [] })
const fixedRegular = live.filter(p => feeKindOf(p) === '固定' && p.place_type === 'regular' && dayFees(p))
// 「平日と週末の両方に金額」は、曜日に触れて金額が書いてあるものを数える。
// 「平日3,000円・週末4,500円」と「平日/週末 5,000円」の両方が対象。
// 「1日7,500円」のように曜日に触れていないものは、比べようがないので外す。
const both = live.map(dayFees).filter(x => x && x.曜日の記載)

const menuBySeller = new Set(menus.map(m => m.seller_id))
const areas = {}
for (const s of sellers) for (const a of (s.areas ?? [])) areas[a] = (areas[a] ?? 0) + 1
const genreCount = {}
let multiGenre = 0
const meal = new Set(), sweet = new Set()
for (const s of sellers) {
  const g = genresOf(s)
  if (g.length > 1) multiGenre += 1
  for (const k of g) genreCount[k] = (genreCount[k] ?? 0) + 1
  if (g.includes('食事')) meal.add(s.id)
  if (g.includes('スイーツ')) sweet.add(s.id)
}

// 指標。key ごとに「どの記事が使っているか」を書いておく。
// ずれたときに、直す記事がすぐ分かるようにするため。
const M = [
  ['募集中の案件', live.length, ['fee', 'location', 'weekday', 'offers', 'parking', 'supermarket', 'documents']],
  ['常設', live.filter(p => p.place_type === 'regular').length, ['fee', 'location', 'offers', 'parking', 'supermarket']],
  ['単発イベント', live.filter(p => p.place_type === 'event').length, ['fee', 'location']],
  ['場所:スーパー', cnt(venues, 'スーパー・食品店'), ['location', 'weekday', 'supermarket', 'documents']],
  ['場所:学校', cnt(venues, '学校・専門学校・大学'), ['location', 'weekday', 'supermarket', 'documents']],
  ['場所:商業施設', cnt(venues, '商業施設・モール'), ['location', 'weekday', 'supermarket', 'documents']],
  ['場所:イベント', cnt(venues, 'イベント・お祭り'), ['location']],
  ['場所:オフィス', cnt(venues, 'オフィス・事業所'), ['location', 'weekday']],
  ['都道府県:東京都', prefs['東京都'] ?? 0, ['location', 'weekday', 'offers']],
  ['都道府県:埼玉県', prefs['埼玉県'] ?? 0, ['location', 'offers']],
  ['都道府県:神奈川県', prefs['神奈川県'] ?? 0, ['location', 'offers']],
  ['都道府県:茨城県', prefs['茨城県'] ?? 0, ['location', 'offers']],
  ['都道府県:千葉県', prefs['千葉県'] ?? 0, ['location', 'offers']],
  ['出店料:固定のみ', cnt(kinds, '固定'), ['fee', 'parking']],
  ['出店料:歩合のみ', cnt(kinds, '歩合'), ['fee', 'parking']],
  ['出店料:併用', cnt(kinds, '併用'), ['fee']],
  ['出店料:応相談', cnt(kinds, '応相談'), ['fee']],
  ['出店料:金額を掲載', live.length - cnt(kinds, '応相談'), ['fee', 'location', 'weekday']],
  ['歩合が含まれる案件', pcts.length, ['fee', 'parking', 'supermarket']],
  ['歩合10%', cnt(pcts, 10), ['fee', 'parking', 'supermarket']],
  ['歩合15%', cnt(pcts, 15), ['fee']],
  ['歩合20%', cnt(pcts, 20), ['fee']],
  ['常設かつ固定の案件', fixedRegular.length, ['fee', 'parking']],
  ['平日の中央値', median(fixedRegular.map(p => dayFees(p).wd)), ['fee', 'parking', 'supermarket']],
  ['週末の中央値', median(fixedRegular.map(p => dayFees(p).we)), ['fee', 'parking']],
  ['平日の最小', Math.min(...fixedRegular.map(p => dayFees(p).wd)), ['fee', 'weekday', 'supermarket']],
  ['週末の最小', Math.min(...fixedRegular.map(p => dayFees(p).we)), ['fee', 'weekday']],
  ['平日と週末の両方に金額', both.length, ['fee', 'weekday']],
  ['うち平日が安い', both.filter(x => x.wd < x.we).length, ['fee', 'weekday']],
  ['うち同額', both.filter(x => x.wd === x.we).length, ['fee', 'weekday']],
  ['うち平日が高い', both.filter(x => x.wd > x.we).length, ['fee', 'weekday']],
  ['税の明記', live.filter(p => /税/.test(norm(p.fee))).length, ['fee']],
  ['公開中の出店者', sellers.length, ['offers', 'supermarket']],
  ['写真あり', sellers.filter(s => (s.photos ?? []).length > 0).length, ['offers']],
  ['メニューあり', sellers.filter(s => menuBySeller.has(s.id)).length, ['offers']],
  ['店名あり', sellers.filter(s => String(s.shop_name ?? '').trim()).length, ['offers']],
  ['メニュー総数', menus.length, ['offers']],
  ['メニュー:価格あり', menus.filter(m => m.price != null).length, ['offers']],
  ['メニュー:写真あり', menus.filter(m => m.photo_url).length, ['offers']],
  ['エリア:東京', areas['東京'] ?? 0, ['offers']],
  ['エリア:埼玉', areas['埼玉'] ?? 0, ['offers']],
  ['エリア:神奈川', areas['神奈川'] ?? 0, ['offers']],
  ['エリア:千葉', areas['千葉'] ?? 0, ['offers']],
  ['エリア:茨城', areas['茨城'] ?? 0, ['offers']],
  ['エリア:大阪', areas['大阪'] ?? 0, ['offers']],
  ['ジャンル:食事', genreCount['食事'] ?? 0, ['offers', 'supermarket']],
  ['ジャンル:スイーツ', genreCount['スイーツ'] ?? 0, ['offers', 'supermarket']],
  ['ジャンル:ドリンク', genreCount['ドリンク'] ?? 0, ['offers', 'supermarket']],
  ['ジャンル:2つ以上', multiGenre, ['offers']],
  ['食事かスイーツ(重複除く)', new Set([...meal, ...sweet]).size, ['offers']],
]

const ARTICLES = {
  fee: 'food-truck-fee-guide（出店料の相場）',
  location: 'kitchen-car-location-guide（出店場所の探し方）',
  weekday: 'weekday-food-truck-spots（平日の出店場所）',
  offers: 'get-food-truck-offers（出店依頼をもらうには）',
  parking: 'renting-parking-space（駐車場を貸す）',
  supermarket: 'supermarket-food-truck（スーパーに誘致する）',
  documents: 'kitchen-car-required-documents（必要書類）',
}

const now = Object.fromEntries(M.map(([k, v]) => [k, v]))
const uses = Object.fromEntries(M.map(([k, , a]) => [k, a]))

if (save) {
  fs.writeFileSync(SNAPSHOT, JSON.stringify({ date: new Date().toISOString().slice(0, 10), values: now }, null, 2) + '\n')
  console.log(`${SNAPSHOT} に ${M.length} 個の数字を保存しました（${new Date().toISOString().slice(0, 10)} 時点）`)
  process.exit(0)
}

if (!fs.existsSync(SNAPSHOT)) {
  console.error(`${SNAPSHOT} がありません。まず --save で基準を作ってください。`)
  process.exit(1)
}
const prev = JSON.parse(fs.readFileSync(SNAPSHOT, 'utf8'))

const changed = M.filter(([k]) => prev.values[k] !== now[k])
console.log(`記事の数字の点検（基準: ${prev.date} 時点）\n`)
if (changed.length === 0) {
  console.log(`  ${M.length} 個の数字は、すべて記事に書いたとおりです。直すところはありません。`)
  process.exit(0)
}

console.log(`  ${changed.length} 個の数字がずれています。\n`)
for (const [k, v] of changed) {
  const before = prev.values[k]
  const diff = typeof before === 'number' && typeof v === 'number'
    ? `${before} → ${v}（${v > before ? '+' : ''}${v - before}）` : `${before} → ${v}`
  console.log(`  ${k}\n    ${diff}`)
}

const need = new Set(changed.flatMap(([k]) => uses[k] ?? []))
console.log(`\n直す必要がある記事（${need.size}本）:`)
for (const a of need) {
  const keys = changed.filter(([k]) => (uses[k] ?? []).includes(a)).map(([k]) => k)
  console.log(`  ${ARTICLES[a]}`)
  console.log(`    ${keys.join('、')}`)
}
console.log(`\n直したら「npm run blog:check -- --save」で基準を更新してください。`)
process.exit(1)
