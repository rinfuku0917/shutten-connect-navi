import Link from 'next/link'

// 記事の末尾に出す、次の行き先の案内。
//
// なぜ分けたか:
//   記事の末尾はずっと「出店場所をお探しですか？／無料で登録する」の
//   1種類だけで、行き先は出店者登録（/register）に固定されていた。
//   ところが募集者向けの記事が12本あり、そこに来るのは
//   「キッチンカーを呼びたい施設・企業・学校の担当者」である。
//   呼びたくて来た人に、出店者登録を勧めていたことになる。
//
//   検索から記事に着いた募集者が、次にどこへ行けばよいか分かるようにする。
//
// カテゴリの文字はデータベースに入っている実データなので、
// 表記が変わったときに空振りしないよう、'募集者向け' 以外は
// これまでの案内に戻す（分岐を足すことで、今まで出ていたものが
// 消えることが無いようにしている）。

const HOST_CATEGORY = '募集者向け'

export default function PostCta({ category }: { category?: string | null }) {
  const forHost = category === HOST_CATEGORY

  const head = forHost ? 'キッチンカーを呼びたい方へ' : '出店場所をお探しですか？'
  const lead = forHost
    ? '会場の広さやご予算をお聞きして、出店できるお店をお探しします。会員登録は要りません。ご相談は無料です。'
    : '全国の出店場所と出店者をつなぐマッチングサービス。登録は無料です。'
  // 呼びたい方は、まず「相談できるか」を知りたい。
  // 登録の前に話せる窓口（/vendor#soudan）を主にして、
  // 「いくらかかるか」に答えるページ（/vendor/cost）を添える
  const primary = forHost
    ? { href: '/vendor#soudan', label: 'キッチンカーの手配を相談する' }
    : { href: '/register', label: '無料で登録する' }
  const secondary = forHost ? { href: '/vendor/cost', label: '費用の目安を見る' } : null

  return (
    <div style={{ marginTop: '48px', padding: '28px', background: 'linear-gradient(135deg, #F5A623, #F9C349)', borderRadius: '16px', textAlign: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: 900, color: '#fff', marginBottom: '8px' }}>{head}</div>
      <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.95)', marginBottom: '18px', lineHeight: 1.8 }}>{lead}</div>
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
        <Link href={primary.href} style={{ display: 'inline-block', background: '#fff', color: '#B45309', padding: '12px 32px', borderRadius: '999px', fontWeight: 900, textDecoration: 'none', fontSize: '15px', minHeight: '44px', boxSizing: 'border-box' }}>
          {primary.label}
        </Link>
        {secondary && (
          <Link href={secondary.href} style={{ display: 'inline-block', background: 'rgba(255,255,255,0.2)', color: '#fff', border: '1.5px solid #fff', padding: '12px 28px', borderRadius: '999px', fontWeight: 800, textDecoration: 'none', fontSize: '15px', minHeight: '44px', boxSizing: 'border-box' }}>
            {secondary.label}
          </Link>
        )}
      </div>
    </div>
  )
}
