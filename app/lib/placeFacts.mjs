// 案件（places）の行から「内訳」を数えるための道具。素のJSで書いてある。
//
// なぜ .mjs なのか:
//   ページ側（app/places/segmentData.ts）と点検スクリプト（scripts/seo-segments.mjs）の
//   両方がここを読む。スクリプトは node でそのまま走らせるので、TypeScript にはできない。
//   数え方を2か所に書くと、画面に出る「平日のみ24件」と点検の出す件数が静かに食い違い、
//   どちらが正しいのか誰にも分からなくなる（docs/seo-keywords.md の教訓2）。
//
// ここで数えないもの:
//   出店料（金額）。集計も個別の額も、ログイン前のページには出さないと決めている。
//   fee / price_fixed / price_share_pct / format_fees の額は、この中で一度も読まない。
//   金額の数え方は scripts/blog-metrics.mjs が唯一の正で、そこに2系統目を作らない。

// 全角数字・記号・連続空白のゆれをそろえる（scripts/blog-metrics.mjs と同じ考え方）
export const norm = s => String(s ?? '')
  .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
  .replace(/％/g, '%').replace(/\s+/g, ' ')

// 住所の先頭から削る都道府県名。
// 画面に出す都道府県の一覧は app/lib/prefectures.ts が持っている。
// ここは素のJSなので同じ47件を写している。片方だけ直すと住所の切り出しが狂うので、
// 増減があれば両方を直すこと（並びもそろえてある）。
export const PREFECTURE_NAMES = [
  '北海道',
  '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
  '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
  '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県',
  '岐阜県', '静岡県', '愛知県', '三重県',
  '滋賀県', '京都府', '大阪府', '兵庫県', '奈良県', '和歌山県',
  '鳥取県', '島根県', '岡山県', '広島県', '山口県',
  '徳島県', '香川県', '愛媛県', '高知県',
  '福岡県', '佐賀県', '長崎県', '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県',
]

// 住所から市区町村を取り出す。
//
// address は自由記述なので、必ず取れないものが出る。取れなかったぶんは '不明' を返し、
// 画面では件数を出して「上位◯件で掲載◯件ぶん」と母数が分かる形にする。
// 政令指定都市は「横浜市西区」ではなく「横浜市」でまとめる（先に出てくる市で切れる）。
//
// 素直に「最初の市区町村の字まで」で切ると、名前の途中に市町村の字が入る自治体を
// 切り落としてしまう（武蔵村山市→武蔵村）。逆に1文字伸ばす規則にすると
// 「ふじみ野市市沢」「八千代市村上」のような大字を食う。両方を満たす規則は無いので、
// 途中に字が入る自治体だけを名前で並べる。抜けが出たらここに1行足せばよい。
const CITY_EXCEPTIONS = [
  '武蔵村山市', '東村山市', '村山市', '田村市', '大町市',
  '四日市市', '廿日市市', '野々市市', '市川市', '市原市',
  'いちき串木野市', '市川三郷町', '南アルプス市',
]
// 「代々木公園B地区」のように、地名ではないのに区の字を含む書き方を弾く
const NOT_A_CITY = /公園|地区|広場|街区|団地|区画|会場|敷地/

export function cityOf(address) {
  let t = norm(address).replace(/^日本[,、 ]*/, '').trim()
  for (const p of PREFECTURE_NAMES) {
    if (t.startsWith(p)) { t = t.slice(p.length); break }
    // 「東京町田市」「熊本熊本市」のように都県の字が抜けている住所も拾う。
    // ただし削った先が単独の「市」「区」で始まるとき（「大阪市北区」の「大阪」を
    // 削ってしまう形）は元に戻す。
    // 弾くのを『市』『区』だけにしているのは、『町』『村』まで弾くと
    // 「東京町田市」の町田市が守りの側に引っかかり、市区町村が「東京町」という
    // 実在しない地名になるため（『町』『村』で始まる自治体名は無い。
    // 『市』で始まる市川市・市原市は CITY_EXCEPTIONS にある）
    const short = p.replace(/[都道府県]$/, '')
    if (short !== p && t.startsWith(short) && !/^[市区]/.test(t.slice(short.length))) {
      t = t.slice(short.length); break
    }
  }
  t = t.replace(/^[ 　]+/, '')
  const hit = CITY_EXCEPTIONS.find(c => t.startsWith(c))
  if (hit) return hit
  const m = t.match(/^(.{1,8}?[市区町村])/)
  if (!m || NOT_A_CITY.test(m[1])) return '不明'
  return m[1]
}

// 曜日。2か所から取る。
//   a) schedule の date（実在の日付）… 曜日を計算できる。いちばん確か
//   b) open_days の自由記述        … 「毎週水曜」「（金）」「土日」などから読み取る
//
// 祝日は判定していない。祝日表を持ち込むと毎年の保守が要るので、
// 「平日／土日」までで数える。画面に「土日祝」と書かないこと。
export const DOW = ['日', '月', '火', '水', '木', '金', '土']
export const WEEKDAY_CHARS = ['月', '火', '水', '木', '金']
const ALL_DAYS = /毎日|全曜日|全日|月(?:曜日?)?\s*[〜～~-]\s*日|月[^土]{0,12}火[^土]{0,12}水[^土]{0,12}木[^土]{0,12}金[^日]{0,6}土[^日]{0,6}日/

// open_days の1行から曜日の集合を読み取る
export function dowsFromText(raw) {
  const t = norm(raw)
  if (!t) return []
  if (ALL_DAYS.test(t)) return [...DOW]
  const found = new Set()
  // 「水曜」「月曜日」
  for (const m of t.matchAll(/([月火水木金土日])曜/g)) found.add(m[1])
  // 「12月9日（金）」のように括弧で添えられた曜日
  for (const m of t.matchAll(/[（(]\s*([月火水木金土日])(?:曜日?)?\s*[)）]/g)) found.add(m[1])
  // 「月火水木金土日」「土日」のように並べて書いたもの
  for (const m of t.matchAll(/[月火水木金土日]{2,}/g)) for (const c of m[0]) found.add(c)
  // 「月,火,水」のように区切って書いたもの
  for (const m of t.matchAll(/(?:^|[,、・／/｜|])\s*([月火水木金土日])\s*(?=[,、・／/｜|]|$)/g)) found.add(m[1])
  return [...found]
}

// 案件1件ぶんの曜日。日付が入っていればそちらを優先する。
// days は日付が入っている案件の日数（open_days から読んだだけの案件は0）
export function dowsOf(p) {
  const dates = (Array.isArray(p?.schedule) ? p.schedule : [])
    .map(s => String(s?.date ?? '').trim()).filter(Boolean)
    .map(d => new Date(d)).filter(d => !isNaN(d.getTime()))
  if (dates.length > 0) {
    return { src: '日付', dows: [...new Set(dates.map(d => DOW[d.getDay()]))], dates }
  }
  const text = (Array.isArray(p?.open_days) ? p.open_days : []).join(' / ')
  const dows = dowsFromText(text)
  if (dows.length > 0) return { src: '記述', dows, dates: [] }
  return { src: 'なし', dows: [], dates: [] }
}

// 案件フォームの選択肢を、画面に出す日本語に直す表。
// 値は app/places/[id]/PlaceDetailClient.tsx の CHOICE と同じものを使う
// （詳細ページと一覧の内訳で言葉が違うと、同じ案件が別条件のように見える）。
//
// rain・trash・location はほぼ定数（rain は140件中139件が「決行」、
// trash は140件全件が「各自」、location は140件中139件が「屋外」）なので、
// 内訳の柱にはしない。画面に出すのは show:true の項目だけ。
export const DETAIL_FLAGS = [
  { name: '電源', key: 'power', map: { yes: 'あり', no: 'なし' }, show: true },
  { name: '給水', key: 'water', map: { yes: 'あり', no: 'なし' }, show: true },
  { name: 'ガス', key: 'gas', map: { yes: 'あり', no: 'なし' }, show: true },
  { name: '駐車', key: 'parking', map: { yes: '可', no: '不可' }, show: true },
  { name: '飲食スペース', key: 'eatSpace', map: { yes: 'あり', no: 'なし' }, show: true },
  { name: '高さ制限', key: 'heightLimit', map: { yes: 'あり', no: 'なし' }, show: true },
  { name: '出店形態の指定', key: 'format', map: { kitchen: 'キッチンカー', tent: 'テント', both: 'キッチンカー・テント' }, show: true },
  { name: '出店実績', key: 'history', map: { yes: '問う', no: '問わない' }, show: true },
  { name: '場所', key: 'location', map: { outdoor: '屋外', outdoor_roof: '屋外（屋根あり）', indoor: '屋内' }, show: false },
  { name: '雨天', key: 'rain', map: { go: '決行', cancel: '中止', other: 'その他' }, show: false },
  { name: 'ごみ', key: 'trash', map: { self: '各自', host: '主催者処理' }, show: false },
]

// 常設／イベントの呼び分け。画面のカード（PlacesBrowser）と同じ言葉にそろえる
export function placeTypeLabel(placeType) {
  if (placeType === 'event') return 'イベント'
  if (placeType === 'regular') return '常設'
  return '未設定'
}
