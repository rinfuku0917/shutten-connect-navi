// 記事の表紙を、実写風の生成画像で作る。
//
//   node scripts/photo-covers.mjs <slug> "<絵にしたい場面>" [下書きの保存先]
//
// できあがるのは public/covers/<slug>-photo.webp（1200x630）。
// 本文の1枚目の画像をこのURLに差し替えると、一覧のサムネイルと
// SNSで共有したときの絵（og:image）がこれになる。
//
// なぜ scripts/make-covers.mjs と分けたか:
//   あちらはアイコンのイラストを背景に載せる作り方で、一覧でアニメ調に見える。
//   古い記事の表紙は実写風の生成画像なので、並べたときに揃わなかった。
//
// なぜ app/api/blog-cover（管理画面の「表紙をAIで作る」）を使わないか:
//   あちらは生成したPNG（2〜3MB）をそのまま本文に入れる。記事一覧が重くなる。
//   ここでは webp に縮めて 100KB 前後にする。
//   また、原稿（docs/blog/*.md）とデータベースの本文がずれないよう、
//   URLは原稿とSQLの両方で差し替える。
//
// 鍵は環境変数 OPENAI_API_KEY、無ければ ~/.openai_key から読む。
// 鍵をこのファイルやリポジトリに書かないこと。

import sharp from 'sharp'
import fs from 'fs'
import os from 'os'
import path from 'path'

const [slug, scene, draftDir] = process.argv.slice(2)
if (!slug || !scene) {
  console.error('使い方: node scripts/photo-covers.mjs <slug> "<場面>" [下書きの保存先]')
  process.exit(1)
}

function apiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY
  try { return fs.readFileSync(path.join(os.homedir(), '.openai_key'), 'utf8').trim() } catch { return '' }
}
const key = apiKey()
if (!key) { console.error('OPENAI_API_KEY も ~/.openai_key もありません'); process.exit(1) }

// 共通の決まり。app/api/blog-cover/route.ts の方針に揃えている
//  - 文字は入れない（生成すると崩れた日本語になり、作り物だと分かる）
//  - 人の顔は大きく写さない（実在の人に見える顔を作らない）
//  - 一覧のサムネイルは中央の正方形だけが見えるので、主題を中央に置く
const prompt = [
  '日本で実際に撮影したような、実写の写真。',
  `場面：${scene}。`,
  '自然な光、プロのカメラマンが撮った広告写真の質感。被写界深度は自然に。',
  '主題は画面の中央に置く（左右の端は切り取られても成り立つ構図）。',
  '文字・ロゴ・看板の文字・ナンバープレートの文字は入れない。読める文字を一切写さない。',
  '人物は後ろ姿・横顔・手元・遠景にし、顔をはっきり写さない。',
  'イラスト調・アニメ調・CG調にはしない。彩度を上げすぎない。',
].join('')

async function generate() {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ model: 'gpt-image-1', prompt, size: '1536x1024', quality: 'high', n: 1 }),
    })
    if (res.ok) {
      const b64 = (await res.json())?.data?.[0]?.b64_json
      if (b64) return Buffer.from(b64, 'base64')
      throw new Error('生成結果を読み取れませんでした')
    }
    const text = (await res.text()).slice(0, 300)
    // 混み合っているときは待ってやり直す
    if (res.status === 429 || res.status >= 500) {
      console.error(`  ${res.status} のため ${attempt * 20}秒待ってやり直します: ${text}`)
      await new Promise(r => setTimeout(r, attempt * 20000))
      continue
    }
    throw new Error(`生成に失敗しました（${res.status}）: ${text}`)
  }
  throw new Error('混み合っていて生成できませんでした')
}

// 何枚か作ったあとで前の下書きを採用するときは、生成せずにそのPNGから作る
//   FROM_PNG=<下書きのPNG> node scripts/photo-covers.mjs <slug> "-"
const png = process.env.FROM_PNG ? fs.readFileSync(process.env.FROM_PNG) : await generate()

// 下書き（生成したままのPNG）は、指定があればそこに控える。リポジトリには入れない
if (draftDir && !process.env.FROM_PNG) {
  fs.mkdirSync(draftDir, { recursive: true })
  const n = fs.readdirSync(draftDir).filter(f => new RegExp(`^${slug}-\\d+\\.png$`).test(f)).length + 1
  fs.writeFileSync(path.join(draftDir, `${slug}-${n}.png`), png)
  // 一覧のサムネイル（中央の正方形）で見たときの確認用
  //（sharp は1本の処理で resize を1回しか持てないので、2段に分ける）
  const wide = await sharp(png).resize(1200, 630, { fit: 'cover' }).png().toBuffer()
  await sharp(wide).extract({ left: 285, top: 0, width: 630, height: 630 }).resize(240, 240)
    .png().toFile(path.join(draftDir, `${slug}-${n}-thumb.png`))
  console.log(`  下書き: ${path.join(draftDir, `${slug}-${n}.png`)}`)
}

const dest = path.join('public/covers', `${slug}-photo.webp`)
await sharp(png).resize(1200, 630, { fit: 'cover' }).webp({ quality: 82 }).toFile(dest)
console.log(`  ${String(Math.round(fs.statSync(dest).size / 1024)).padStart(3)}KB  ${dest}`)
