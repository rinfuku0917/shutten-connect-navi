import Link from 'next/link'

const placesData: Record<string, {
  id: string, img: string, tag: string, area: string,
  title: string, desc: string, date: string, time: string,
  type: string, access: string, detail: string
}> = {
  '1': {
    id: '1', img: '🏫', tag: '常設', area: '東京',
    title: '日本体育大学医療専門学校（春の6月7月8月スケジュール）',
    desc: '教育機関のランチ出店・キッチンカーの募集',
    date: '6月3日・10日・17日・24日、7月1日・8日・15日、8月5日',
    time: '11:00〜16:00', type: 'キッチンカー',
    access: '東京都世田谷区用賀2-2-7',
    detail: '各日程でキッチンカー１台ずつの募集です。施設に隣接している整骨院があり大通り沿いの出店スペースとなります。非常にスペースで美味しい食事やスイーツ大歓迎です。',
  },
  '2': {
    id: '2', img: '🏫', tag: '常設', area: '大阪',
    title: '大阪公立大学りんくうキャンパス（7月スケジュールの募集）',
    desc: '大学キャンパス内のランチ出店募集',
    date: '7月中の水曜日', time: '11:00〜14:00', type: 'キッチンカー',
    access: '大阪府泉南郡田尻町',
    detail: '大学キャンパス内でのランチ出店です。学生・教職員向けの出店となります。にぎやかなキャンパスで多くの学生に食事を提供できます。',
  },
  '3': {
    id: '3', img: '🏬', tag: '常設', area: '宮城',
    title: 'イオンモール富谷（宮城）',
    desc: 'ショッピングモール内の出店スペース',
    date: '要相談', time: '10:00〜18:00', type: 'キッチンカー・物販',
    access: '宮城県黒川郡富谷市',
    detail: '大型ショッピングモール内の出店スペースです。多くの来場者が見込めます。週末は特に家族連れで賑わいます。',
  },
  '4': {
    id: '4', img: '🏫', tag: '常設', area: '東京',
    title: '町田美容専門学校',
    desc: '専門学校内のランチ出店募集',
    date: '要相談', time: '11:00〜15:00', type: 'キッチンカー',
    access: '東京都町田市',
    detail: '美容専門学校内でのランチ出店です。学生・教職員向けの出店となります。おしゃれな雰囲気のお店が特に好まれます。',
  },
  '5': {
    id: '5', img: '🏢', tag: '常設', area: '福岡',
    title: '福岡天神エリア オフィスビル',
    desc: 'オフィスビル前の出店スペース',
    date: '平日毎日', time: '11:00〜14:00', type: 'キッチンカー',
    access: '福岡県福岡市中央区',
    detail: '天神エリアのオフィスビル前での出店です。ビジネスパーソン向けのランチ需要が高いエリアです。',
  },
  '6': {
    id: '6', img: '🌳', tag: 'イベント', area: '神奈川',
    title: '横浜みなとみらい 週末マルシェ',
    desc: '人気スポットでの週末マルシェ出店',
    date: '毎週土日', time: '10:00〜17:00', type: '物販・飲食',
    access: '神奈川県横浜市西区',
    detail: 'みなとみらいの人気スポットでの週末マルシェです。多くの観光客・地元客が訪れます。',
  },
}

export default async function PlaceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const place = placesData[id]

  if (!place) {
    return (
      <div style={{ minHeight: '100vh', background: '#FFF9E6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>😢</div>
          <div style={{ fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>案件が見つかりません</div>
          <Link href="/" style={{ color: '#3A9BD5', textDecoration: 'none' }}>トップに戻る</Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#FFF9E6' }}>
      {/* ナビ */}
      

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '32px 24px' }}>
        <Link href="/" style={{ color: '#3A9BD5', textDecoration: 'none', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '4px', marginBottom: '20px' }}>
          ← 一覧に戻る
        </Link>

        <div className='detail-2col' style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '28px', alignItems: 'start' }}>
          {/* 左カラム */}
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              <span style={{ background: '#F5A623', color: '#fff', fontSize: '12px', fontWeight: '700', padding: '3px 12px', borderRadius: '999px' }}>{place.tag}</span>
              <span style={{ background: '#EBF6FD', color: '#1D4ED8', fontSize: '12px', fontWeight: '700', padding: '3px 12px', borderRadius: '999px' }}>📍{place.area}</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '900', color: '#1a1a1a', marginBottom: '20px', lineHeight: 1.4 }}>{place.title}</h1>

            {/* メイン画像 */}
            <div style={{ background: '#fff', borderRadius: '12px', overflow: 'hidden', marginBottom: '20px', border: '1px solid #E5E7EB' }}>
              <div style={{ height: '260px', background: 'linear-gradient(135deg,#FFF3CD,#FFE082)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '80px' }}>
                {place.img}
              </div>
            </div>

            {/* 詳細テーブル */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '20px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <tbody>
                  {[
                    { label: '日程', value: place.date },
                    { label: '販売（配布）時間', value: place.time },
                    { label: 'アクセス', value: place.access },
                    { label: '出店形態', value: place.type },
                  ].map((row, i) => (
                    <tr key={row.label} style={{ borderBottom: i < 3 ? '1px solid #F3F4F6' : 'none' }}>
                      <td style={{ padding: '14px 20px', background: '#FFFBEB', fontWeight: '700', fontSize: '13px', color: '#B45309', width: '160px', whiteSpace: 'nowrap' }}>{row.label}</td>
                      <td style={{ padding: '14px 20px', fontSize: '14px', color: '#1a1a1a' }}>{row.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 募集内容 */}
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', padding: '20px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: '900', marginBottom: '10px', color: '#1a1a1a' }}>募集内容</h3>
              <p style={{ fontSize: '14px', color: '#555', lineHeight: 1.8 }}>{place.detail}</p>
            </div>
          </div>

          {/* 右カラム：エントリーボックス */}
          <div style={{ position: 'sticky', top: '20px' }}>
            <div style={{ background: '#fff', borderRadius: '12px', border: '1px solid #E5E7EB', overflow: 'hidden', marginBottom: '16px' }}>
              <div style={{ background: '#F5A623', padding: '14px 20px' }}>
                <div style={{ color: '#fff', fontWeight: '900', fontSize: '15px' }}>この案件に出店する</div>
              </div>
              <div style={{ padding: '20px' }}>
                <div style={{ fontSize: '13px', color: '#888', marginBottom: '16px', lineHeight: 1.7 }}>
                  会員登録すると全ての情報を確認できます！
                </div>
                <Link href="/login" style={{ display: 'block', background: '#3A9BD5', color: '#fff', textAlign: 'center', padding: '14px', borderRadius: '8px', fontWeight: '900', fontSize: '15px', textDecoration: 'none', marginBottom: '10px' }}>
                  詳細を確認・エントリーする
                </Link>
                <Link href="/register" style={{ display: 'block', border: '2px solid #F5A623', color: '#E08A00', textAlign: 'center', padding: '12px', borderRadius: '8px', fontWeight: '700', fontSize: '13px', textDecoration: 'none' }}>
                  新規会員登録はこちら(無料)
                </Link>
              </div>
            </div>

            <div style={{ background: '#FFF9E6', borderRadius: '12px', border: '1px solid #FFE0A0', padding: '16px' }}>
              <h4 style={{ fontSize: '13px', fontWeight: '900', marginBottom: '10px', color: '#B45309' }}>📋 基本情報</h4>
              <div style={{ fontSize: '12px', color: '#666', lineHeight: 2 }}>
                <div>⏰ {place.time}</div>
                <div>📍 {place.area}</div>
                <div>🚚 {place.type}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer style={{ background: '#1E2A3B', color: '#fff', padding: '24px', textAlign: 'center', marginTop: '40px' }}>
        <div style={{ fontWeight: '900', fontSize: '16px', marginBottom: '8px' }}>出店コネクトナビ</div>
        <div style={{ fontSize: '12px', color: '#666' }}>© 2026 出店コネクトナビ All Rights Reserved.</div>
      </footer>
    </div>
  )
}
