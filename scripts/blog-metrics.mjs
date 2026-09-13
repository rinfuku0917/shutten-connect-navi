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

// スーパーのチェーン。記事は社名を伏せて「チェーンA／B」と書いている（mall は社名を出している）
const chainOf = p => /Olympic|オリンピック/i.test(p.title ?? '') ? 'Olympic'
  : /サンユー/.test(p.title ?? '') ? 'サンユーストアー' : '独立'

// 募集の曜日（自由記述）。open_days は配列で入っている
const daysText = p => Array.isArray(p.open_days) ? p.open_days.join(' ').trim() : ''
// 「毎日」「月〜日」「毎週月曜日〜日曜日」「月,火,…,日」「全曜日」「全日出店可」を、全曜日出店可として数える。
// 「月曜日〜日曜日」は曜日が挟まるので、月の直後の「曜日」を許す（最初の版はこれを拾えず5件漏れていた）
const ALL_DAYS = /毎日|全曜日|全日|月(?:曜日?)?\s*[〜～~-]\s*日|月[^土]{0,12}火[^土]{0,12}水[^土]{0,12}木[^土]{0,12}金[^日]{0,6}土[^日]{0,6}日/
// 「土日推奨」「週末推奨」「週末／推奨」「土曜日・日曜日（推奨）」
const WEEKEND_PUSH = /(?:土日|週末|土曜日・日曜日)[^平]{0,6}推奨/

// 学校の種類（案件名で判断）
// 専門学校を先に判定する。「日本体育大学医療専門学校」のように大学名を含む専門学校があり、
// 大学を先に見ると大学に数えてしまっていた（2026-09-13 の点検で判明）。
// 「〜学園短期大学」は短大なので、学園の判定からは外す
const schoolKind = p => /専門学校|学院|学園(?!短期大学)|カレッジ/.test(p.title ?? '') ? '専門'
  : /大学|短期大学|短大/.test(p.title ?? '') ? '大学' : 'その他'

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
// 募集終了も含めた、これまでに掲載した案件。「これまでに◯件」と書くときの母数
const published = places.filter(p => p.status === 'published')
const sellers = await all('public_sellers')
const menus = await all('menus')

const kinds = live.map(feeKindOf)
const cnt = (arr, v) => arr.filter(x => x === v).length
// 場所の種類 × 出店料の決め方
const kindIn = (venue, kind) => live.filter(p => venueOf(p) === venue && feeKindOf(p) === kind).length
// 常設か単発か × 出店料の決め方
const typeKind = (type, kind) => live.filter(p => p.place_type === type && feeKindOf(p) === kind).length
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
  ['募集中の案件', live.length, ['fee', 'location', 'weekday', 'offers', 'parking', 'supermarket', 'documents', 'hostfee', 'schedule', 'campus', 'festival', 'office', 'condo', 'vacant']],
  ['常設', live.filter(p => p.place_type === 'regular').length, ['fee', 'location', 'offers', 'parking', 'supermarket', 'office', 'condo', 'vacant']],
  ['単発イベント', live.filter(p => p.place_type === 'event').length, ['fee', 'location', 'festival', 'vacant']],
  ['場所:スーパー', cnt(venues, 'スーパー・食品店'), ['location', 'weekday', 'supermarket', 'documents', 'mall', 'vacant', 'schedule', 'campus']],
  ['場所:学校', cnt(venues, '学校・専門学校・大学'), ['location', 'weekday', 'supermarket', 'documents', 'mall', 'vacant', 'schedule', 'campus', 'festival']],
  ['場所:商業施設', cnt(venues, '商業施設・モール'), ['location', 'weekday', 'supermarket', 'documents', 'mall', 'vacant', 'hostfee', 'schedule']],
  ['場所:イベント', cnt(venues, 'イベント・お祭り'), ['location', 'vacant']],
  ['場所:オフィス', cnt(venues, 'オフィス・事業所'), ['location', 'weekday', 'hostfee', 'office', 'vacant']],
  ['都道府県:東京都', prefs['東京都'] ?? 0, ['location', 'weekday', 'offers']],
  ['都道府県:埼玉県', prefs['埼玉県'] ?? 0, ['location', 'offers']],
  ['都道府県:神奈川県', prefs['神奈川県'] ?? 0, ['location', 'offers']],
  ['都道府県:茨城県', prefs['茨城県'] ?? 0, ['location', 'offers']],
  ['都道府県:千葉県', prefs['千葉県'] ?? 0, ['location', 'offers']],
  ['出店料:固定のみ', cnt(kinds, '固定'), ['fee', 'parking', 'campus', 'condo', 'vacant']],
  ['出店料:歩合のみ', cnt(kinds, '歩合'), ['fee', 'parking', 'condo', 'vacant']],
  ['出店料:併用', cnt(kinds, '併用'), ['fee', 'condo', 'vacant']],
  ['出店料:応相談', cnt(kinds, '応相談'), ['fee', 'condo', 'vacant']],
  ['出店料:金額を掲載', live.length - cnt(kinds, '応相談'), ['fee', 'location', 'weekday']],
  ['歩合が含まれる案件', pcts.length, ['fee', 'parking', 'supermarket', 'hostfee', 'office', 'gov', 'condo', 'vacant']],
  ['歩合10%', cnt(pcts, 10), ['fee', 'parking', 'supermarket', 'hostfee', 'office', 'gov', 'condo', 'vacant']],
  ['歩合15%', cnt(pcts, 15), ['fee', 'hostfee', 'condo', 'vacant']],
  ['歩合20%', cnt(pcts, 20), ['fee', 'condo', 'vacant']],
  ['常設かつ固定の案件', fixedRegular.length, ['fee', 'parking']],
  ['平日の中央値', median(fixedRegular.map(p => dayFees(p).wd)), ['fee', 'parking', 'supermarket', 'vacant']],
  ['週末の中央値', median(fixedRegular.map(p => dayFees(p).we)), ['fee', 'parking', 'vacant']],
  ['平日の最小', Math.min(...fixedRegular.map(p => dayFees(p).wd)), ['fee', 'weekday', 'supermarket', 'vacant']],
  ['週末の最小', Math.min(...fixedRegular.map(p => dayFees(p).we)), ['fee', 'weekday', 'vacant']],
  ['平日と週末の両方に金額', both.length, ['fee', 'weekday', 'schedule']],
  ['うち平日が安い', both.filter(x => x.wd < x.we).length, ['fee', 'weekday', 'schedule']],
  ['うち同額', both.filter(x => x.wd === x.we).length, ['fee', 'weekday', 'schedule']],
  ['うち平日が高い', both.filter(x => x.wd > x.we).length, ['fee', 'weekday', 'schedule']],
  ['税の明記', live.filter(p => /税/.test(norm(p.fee))).length, ['fee', 'schedule', 'office', 'vacant']],
  // 場所の種類ごとの決め方。スーパーと商業施設の記事が並べて比べている
  ['スーパー:固定', kindIn('スーパー・食品店', '固定'), ['supermarket', 'mall', 'campus']],
  ['スーパー:歩合', kindIn('スーパー・食品店', '歩合'), ['supermarket', 'mall']],
  ['スーパー:併用', kindIn('スーパー・食品店', '併用'), ['supermarket', 'mall']],
  ['商業施設:固定', kindIn('商業施設・モール', '固定'), ['supermarket', 'mall', 'hostfee', 'schedule']],
  ['商業施設:歩合', kindIn('商業施設・モール', '歩合'), ['supermarket', 'mall', 'hostfee']],
  ['商業施設:併用', kindIn('商業施設・モール', '併用'), ['supermarket', 'mall', 'hostfee', 'vacant']],
  ['商業施設:応相談', kindIn('商業施設・モール', '応相談'), ['supermarket', 'mall', 'hostfee']],
  ['商業施設:常設', live.filter(p => venueOf(p) === '商業施設・モール' && p.place_type === 'regular').length, ['mall', 'hostfee', 'schedule']],
  ['商業施設:千葉県', live.filter(p => venueOf(p) === '商業施設・モール' && p.prefecture === '千葉県').length, ['mall']],
  ['商業施設:埼玉県', live.filter(p => venueOf(p) === '商業施設・モール' && p.prefecture === '埼玉県').length, ['mall']],
  ['学校:歩合', kindIn('学校・専門学校・大学', '歩合'), ['supermarket', 'mall', 'campus', 'festival']],
  ['公開中の出店者', sellers.length, ['offers', 'supermarket', 'hostfee', 'campus', 'festival', 'office', 'gov', 'condo', 'vacant']],
  ['写真あり', sellers.filter(s => (s.photos ?? []).length > 0).length, ['offers', 'gov', 'vacant']],
  ['メニューあり', sellers.filter(s => menuBySeller.has(s.id)).length, ['offers', 'hostfee', 'gov']],
  ['店名あり', sellers.filter(s => String(s.shop_name ?? '').trim()).length, ['offers']],
  ['メニュー総数', menus.length, ['offers', 'hostfee', 'campus', 'office', 'condo', 'vacant']],
  ['メニュー:価格あり', menus.filter(m => m.price != null).length, ['offers', 'hostfee', 'campus', 'office', 'condo', 'vacant']],
  ['メニュー:写真あり', menus.filter(m => m.photo_url).length, ['offers', 'condo', 'vacant']],
  ['エリア:東京', areas['東京'] ?? 0, ['offers', 'hostfee', 'campus', 'festival', 'office', 'gov', 'condo', 'vacant']],
  ['エリア:埼玉', areas['埼玉'] ?? 0, ['offers', 'hostfee', 'campus', 'festival', 'gov', 'condo', 'vacant']],
  ['エリア:神奈川', areas['神奈川'] ?? 0, ['offers', 'hostfee', 'campus', 'festival', 'office', 'gov', 'condo', 'vacant']],
  ['エリア:千葉', areas['千葉'] ?? 0, ['offers', 'hostfee', 'festival', 'gov', 'condo', 'vacant']],
  ['エリア:茨城', areas['茨城'] ?? 0, ['offers', 'gov']],
  ['エリア:大阪', areas['大阪'] ?? 0, ['offers', 'campus', 'gov']],
  ['ジャンル:食事', genreCount['食事'] ?? 0, ['offers', 'supermarket', 'hostfee', 'campus', 'festival', 'office', 'condo', 'vacant']],
  ['ジャンル:スイーツ', genreCount['スイーツ'] ?? 0, ['offers', 'supermarket', 'hostfee', 'campus', 'festival', 'office', 'condo', 'vacant']],
  ['ジャンル:ドリンク', genreCount['ドリンク'] ?? 0, ['offers', 'supermarket', 'hostfee', 'campus', 'festival', 'office', 'condo', 'vacant']],
  ['ジャンル:2つ以上', multiGenre, ['offers', 'hostfee', 'festival', 'condo', 'vacant']],
  ['食事かスイーツ(重複除く)', new Set([...meal, ...sweet]).size, ['offers']],
  ['ジャンル:物販', genreCount['物販'] ?? 0, ['offers', 'supermarket', 'vacant']],

  // ここから下は、記事が表で使っているのに集計していなかったもの。
  //
  // 記事には「都道府県ごとの内訳」「常設と単発それぞれの決め方」といった
  // 表が載っている。ところが集計は上位5県と全体の内訳しか採っておらず、
  // 数字がずれたときに表の合計が合わなくなっても気づけなかった
  // （実際、東京と埼玉が1件ずつ増えたときに表の合計が112件になった）。
  // 記事に載せている粒度は、すべてここで数える。
  ['都道府県:群馬県', prefs['群馬県'] ?? 0, ['location']],
  ['都道府県:愛知県', prefs['愛知県'] ?? 0, ['location']],
  ['都道府県:栃木県', prefs['栃木県'] ?? 0, ['location']],
  ['都道府県:兵庫県', prefs['兵庫県'] ?? 0, ['location']],
  ['都道府県:熊本県', prefs['熊本県'] ?? 0, ['location']],
  ['都道府県:宮城県', prefs['宮城県'] ?? 0, ['location']],
  ['都道府県:大阪府', prefs['大阪府'] ?? 0, ['location', 'offers']],
  ['場所:ホームセンター', cnt(venues, 'ホームセンター・家電量販'), ['location']],
  ['場所:ゴルフ場・レジャー', cnt(venues, 'ゴルフ場・レジャー'), ['location', 'vacant']],
  ['場所:病院・介護', cnt(venues, '病院・介護施設'), ['location']],
  ['場所:マンション・住宅', cnt(venues, 'マンション・住宅'), ['location']],
  ['場所:公園・道の駅・公共', cnt(venues, '公園・道の駅・公共'), ['location']],
  ['場所:駐車場・遊休地', cnt(venues, '駐車場・遊休地'), ['location']],
  ['場所:その他', cnt(venues, 'その他'), ['location', 'vacant']],

  // 常設と単発それぞれの、出店料の決め方。fee の記事がクロス表で使っている
  ['常設:固定', typeKind('regular', '固定'), ['fee', 'parking']],
  ['常設:歩合', typeKind('regular', '歩合'), ['fee', 'parking']],
  ['常設:併用', typeKind('regular', '併用'), ['fee']],
  ['常設:応相談', typeKind('regular', '応相談'), ['fee']],
  ['単発:固定', typeKind('event', '固定'), ['fee']],
  ['単発:歩合', typeKind('event', '歩合'), ['fee', 'festival']],
  ['単発:併用', typeKind('event', '併用'), ['fee']],
  ['単発:応相談', typeKind('event', '応相談'), ['fee']],

  // 場所の種類ごとの残りの内訳。mall と supermarket の表が使っている
  ['スーパー:応相談', kindIn('スーパー・食品店', '応相談'), ['supermarket', 'mall']],
  ['スーパー:常設', live.filter(p => venueOf(p) === 'スーパー・食品店' && p.place_type === 'regular').length, ['supermarket']],
  ['学校:固定', kindIn('学校・専門学校・大学', '固定'), ['mall', 'campus']],
  ['学校:併用', kindIn('学校・専門学校・大学', '併用'), ['mall', 'campus']],
  ['学校:応相談', kindIn('学校・専門学校・大学', '応相談'), ['mall', 'campus']],

  // 固定額の上限。記事は「3,000円〜8,000円」のように幅で書いているが、
  // 上限だけ集計しておらず、裏づけの無い数字になっていた
  ['平日の最大', Math.max(...fixedRegular.map(p => dayFees(p).wd)), ['fee', 'parking']],
  ['週末の最大', Math.max(...fixedRegular.map(p => dayFees(p).we)), ['fee', 'parking']],

  // 2026-09-13 に足したもの。
  //
  // 記事の数字直しで、別の担当が数え直したところ、次の数字は指標が無く
  // 「確かめられない」になっていた。実際に数えると、学校の常設は26→28件、
  // チェーンAのスーパーは17→18件に変わっていたのに、点検では1つも
  // 出てこなかった。数字がずれても、それを使う記事が「直す記事」に
  // 挙がらないということになる。記事に載せている粒度は、ここで数える。
  ['都道府県:三重県', prefs['三重県'] ?? 0, ['location']],
  ['学校:常設', live.filter(p => venueOf(p) === '学校・専門学校・大学' && p.place_type === 'regular').length, ['weekday', 'campus', 'festival']],
  // スーパーは2社のチェーンが大半を占める。記事はそれを前提に
  // 「固定制はすべてチェーン2社」「独立店は歩合」と書いている
  ['スーパー:チェーンA(Olympic)', live.filter(p => venueOf(p) === 'スーパー・食品店' && chainOf(p) === 'Olympic').length, ['supermarket', 'mall']],
  ['スーパー:チェーンB(サンユー)', live.filter(p => venueOf(p) === 'スーパー・食品店' && chainOf(p) === 'サンユーストアー').length, ['supermarket', 'mall']],
  ['スーパー:独立店', live.filter(p => venueOf(p) === 'スーパー・食品店' && chainOf(p) === '独立').length, ['supermarket', 'mall']],
  ['スーパー:固定のうちチェーン', live.filter(p => venueOf(p) === 'スーパー・食品店' && feeKindOf(p) === '固定' && chainOf(p) !== '独立').length, ['supermarket', 'mall']],
  ['スーパー:独立店のうち歩合', live.filter(p => venueOf(p) === 'スーパー・食品店' && chainOf(p) === '独立' && feeKindOf(p) === '歩合').length, ['supermarket', 'mall']],
  ['スーパー:チェーンAの3000/4500円', live.filter(p => venueOf(p) === 'スーパー・食品店' && chainOf(p) === 'Olympic' && feeKindOf(p) === '固定' && dayFees(p)?.wd === 3000 && dayFees(p)?.we === 4500).length, ['supermarket', 'weekday']],
  ['商業施設:イオン系', live.filter(p => venueOf(p) === '商業施設・モール' && /イオン|そよら|AEON/i.test(p.title)).length, ['mall', 'hostfee']],
  // 固定額ごとの件数。fee の記事が「3,000円（17件）」のように書いている
  ['常設固定:平日3000円', fixedRegular.filter(p => dayFees(p).wd === 3000).length, ['fee']],
  ['常設固定:平日5000円', fixedRegular.filter(p => dayFees(p).wd === 5000).length, ['fee']],
  ['常設固定:週末4500円', fixedRegular.filter(p => dayFees(p).we === 4500).length, ['fee']],
  ['常設固定:週末5000円', fixedRegular.filter(p => dayFees(p).we === 5000).length, ['fee']],
  // 平日が安い案件の差額の分布。weekday の記事が表にしている
  ['差額:1000円', both.filter(x => x.we - x.wd === 1000).length, ['weekday']],
  ['差額:1500円', both.filter(x => x.we - x.wd === 1500).length, ['weekday']],
  ['差額:2000円', both.filter(x => x.we - x.wd === 2000).length, ['weekday']],
  ['差額:2500円', both.filter(x => x.we - x.wd === 2500).length, ['weekday']],
  ['差額:5500円', both.filter(x => x.we - x.wd === 5500).length, ['weekday']],
  ['差額の中央値', median(both.filter(x => x.wd < x.we).map(x => x.we - x.wd)), ['fee', 'weekday', 'schedule']],

  // 2026-09-13 に足したもの（その2）。曜日・時間帯と、オフィスの内訳。
  //
  // open_days / open_time は自由記述で、入っている案件も一部だけ
  // （曜日は募集中110件のうち約50件、時刻は約26件）。記事では必ず
  // 「曜日が書いてある◯件のうち」と母数を書くこと。全体の性質として書かない。
  ['商業施設:曜日の記載あり', live.filter(p => venueOf(p) === '商業施設・モール' && daysText(p)).length, ['schedule', 'hostfee']],
  ['商業施設:全曜日出店可', live.filter(p => venueOf(p) === '商業施設・モール' && ALL_DAYS.test(daysText(p))).length, ['schedule', 'hostfee']],
  ['商業施設:土日推奨', live.filter(p => venueOf(p) === '商業施設・モール' && WEEKEND_PUSH.test(daysText(p))).length, ['schedule']],
  ['商業施設:時刻の記載あり', live.filter(p => venueOf(p) === '商業施設・モール' && p.open_time).length, ['schedule', 'hostfee']],
  ['商業施設:固定で曜日の額を分ける', live.filter(p => venueOf(p) === '商業施設・モール' && feeKindOf(p) === '固定' && dayFees(p)?.曜日の記載 && dayFees(p).wd !== dayFees(p).we).length, ['schedule', 'mall']],
  ['商業施設:固定で曜日の額を分けない', live.filter(p => venueOf(p) === '商業施設・モール' && feeKindOf(p) === '固定' && !(dayFees(p)?.曜日の記載 && dayFees(p).wd !== dayFees(p).we)).length, ['schedule', 'mall']],
  ['スーパー:時刻の記載あり', live.filter(p => venueOf(p) === 'スーパー・食品店' && p.open_time).length, ['schedule']],
  ['スーパー:土日推奨', live.filter(p => venueOf(p) === 'スーパー・食品店' && WEEKEND_PUSH.test(daysText(p))).length, ['schedule']],
  ['スーパー:曜日の記載あり', live.filter(p => venueOf(p) === 'スーパー・食品店' && daysText(p)).length, ['schedule']],
  ['オフィス:歩合', kindIn('オフィス・事業所', '歩合'), ['hostfee', 'office']],
  ['オフィス:応相談', kindIn('オフィス・事業所', '応相談'), ['hostfee', 'office']],
  ['オフィス:歩合15%', live.filter(p => venueOf(p) === 'オフィス・事業所' && /15\s*%/.test(norm(p.fee))).length, ['hostfee', 'office']],
  ['オフィス:神奈川県', live.filter(p => venueOf(p) === 'オフィス・事業所' && p.prefecture === '神奈川県').length, ['hostfee', 'office']],

  // 2026-09-13 に足したもの（その3）。新しく書く募集者向けの記事が使う内訳。
  //
  // 「これまでに掲載した」数は、募集終了も含めた公開済みの案件で数える。
  // 募集中の数とは母数が違うので、記事では必ず「これまでに」と書き分けること。
  ['公開済みの案件（終了含む）', published.length, ['campus', 'festival', 'gov']],
  ['掲載累計:学校', published.filter(p => venueOf(p) === '学校・専門学校・大学').length, ['campus', 'festival']],
  ['掲載累計:イベント', published.filter(p => venueOf(p) === 'イベント・お祭り').length, ['festival', 'gov']],
  ['掲載累計:公園・道の駅・公共', published.filter(p => venueOf(p) === '公園・道の駅・公共').length, ['gov']],
  ['掲載累計:オフィス', published.filter(p => venueOf(p) === 'オフィス・事業所').length, ['office']],
  ['掲載累計:マンション・住宅', published.filter(p => venueOf(p) === 'マンション・住宅').length, ['condo']],
  ['学校:専門学校・学院', live.filter(p => venueOf(p) === '学校・専門学校・大学' && schoolKind(p) === '専門').length, ['campus']],
  ['学校:大学・短大', live.filter(p => venueOf(p) === '学校・専門学校・大学' && schoolKind(p) === '大学').length, ['campus']],
  ['学校:単発', live.filter(p => venueOf(p) === '学校・専門学校・大学' && p.place_type === 'event').length, ['campus', 'festival']],
  ['学校:歩合10%', live.filter(p => venueOf(p) === '学校・専門学校・大学' && /(^|[^0-9])10\s*%/.test(norm(p.fee))).length, ['campus', 'festival']],
  ['学校:歩合15%', live.filter(p => venueOf(p) === '学校・専門学校・大学' && /15\s*%/.test(norm(p.fee))).length, ['campus', 'festival']],
  // 学園祭の記事が「15%の2件は、どちらも単発の催し」と書いている
  ['学校:単発かつ歩合15%', live.filter(p => venueOf(p) === '学校・専門学校・大学' && p.place_type === 'event' && /15\s*%/.test(norm(p.fee))).length, ['festival', 'campus']],
  ['学校:東京都', live.filter(p => venueOf(p) === '学校・専門学校・大学' && p.prefecture === '東京都').length, ['campus']],
  ['学校:時刻の記載あり', live.filter(p => venueOf(p) === '学校・専門学校・大学' && p.open_time).length, ['campus', 'schedule']],
  ['エリア:群馬', areas['群馬'] ?? 0, ['gov', 'condo']],
  ['エリア:栃木', areas['栃木'] ?? 0, ['gov', 'condo']],
  ['エリア:兵庫', areas['兵庫'] ?? 0, ['gov', 'condo']],
  ['エリア:京都', areas['京都'] ?? 0, ['gov', 'condo']],
]

const ARTICLES = {
  fee: 'food-truck-fee-guide（出店料の相場）',
  location: 'kitchen-car-location-guide（出店場所の探し方）',
  weekday: 'weekday-food-truck-spots（平日の出店場所）',
  offers: 'get-food-truck-offers（出店依頼をもらうには）',
  parking: 'renting-parking-space（駐車場を貸す）',
  supermarket: 'supermarket-food-truck（スーパーに誘致する）',
  documents: 'kitchen-car-required-documents（必要書類）',
  mall: 'mall-food-truck-event（商業施設の催事）',
  vacant: 'vacant-space-food-truck（遊休スペースの活用）',
  schedule: 'regular-event-schedule（定期開催の曜日と時間帯）',
  hostfee: 'host-fee-setting-guide（商業施設・オフィスビルへの導入効果）',
  campus: 'campus-food-truck（大学・専門学校の構内）',
  festival: 'school-festival-food-truck（学園祭）',
  office: 'office-welfare-food-truck（社食・福利厚生）',
  gov: 'municipal-event-food-truck（自治体のイベント）',
  condo: 'condominium-food-truck（マンション・団地）',
}

const now = Object.fromEntries(M.map(([k, v]) => [k, v]))
const uses = Object.fromEntries(M.map(([k, , a]) => [k, a]))

// 記事を書く・直すときに、いまの値と使っている記事を一覧で見る
//   node scripts/blog-metrics.mjs --list
if (process.argv.includes('--list')) {
  for (const [k, v, a] of M) console.log(`${k}\t${v}\t${a.join(',')}`)
  process.exit(0)
}

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
