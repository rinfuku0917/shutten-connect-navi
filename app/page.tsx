'use client'
import Link from 'next/link'
import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { Zen_Kaku_Gothic_New, Bricolage_Grotesque } from 'next/font/google'

// デザイン見本(top.html)指定のフォント
const zen = Zen_Kaku_Gothic_New({ weight: ['400', '500', '700', '900'], subsets: ['latin'] })
const bricolage = Bricolage_Grotesque({ weight: ['600', '800'], subsets: ['latin'] })

// 見本のカラーパレット
const C = {
  ink: '#1a1714',
  paper: '#f7f3ec',
  paper2: '#efe8dc',
  tomato: '#e0533d',
  tomatoDeep: '#c23c2a',
  char: '#2b2620',
  grill: '#f4a52b',
  leaf: '#3f7d5a',
  leafDeep: '#2f5f43',
  line: '#d9cfbf',
  muted: '#6b6157',
  sky: '#dfeaf0',
}

type WorkPlace = {
  id: string
  title: string
  prefecture: string | null
  place_type: string | null
  image_url: string | null
}

const kickerStyle: React.CSSProperties = { fontWeight: 600, fontSize: '13px', letterSpacing: '.14em', textTransform: 'uppercase', color: C.tomatoDeep, marginBottom: '14px' }
const hSecStyle: React.CSSProperties = { fontSize: 'clamp(26px,4vw,40px)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '16px', lineHeight: 1.3 }
const leadStyle: React.CSSProperties = { fontSize: '16px', color: C.muted, maxWidth: '640px', lineHeight: 1.75 }
const wrapStyle: React.CSSProperties = { maxWidth: '1120px', margin: '0 auto', padding: '0 24px' }

export default function Home() {
  const [works, setWorks] = useState<WorkPlace[]>([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('places')
        .select('id,title,prefecture,place_type,image_url')
        .eq('status', 'published')
        .order('pinned', { ascending: false })
        .order('posted_at', { ascending: false })
        .limit(4)
      setWorks(data || [])
    }
    load()
  }, [])

  const typeLabel = (t: string | null) => (t === 'event' ? 'イベント出店' : '通常出店')
  const typeIcon = (t: string | null) => (t === 'event' ? '🎪' : '🏢')

  return (
    <div className={zen.className} style={{ background: C.paper, color: C.ink, lineHeight: 1.75, overflowX: 'hidden', minHeight: '100vh' }}>

      {/* bar */}
      <div style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(247,243,236,0.9)', backdropFilter: 'blur(10px)', borderBottom: '1px solid ' + C.line }}>
        <div style={{ ...wrapStyle, display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '66px' }}>
          <Link href='/' style={{ display: 'flex', alignItems: 'center', gap: '9px', fontWeight: 900, fontSize: '18px', letterSpacing: '-0.02em', color: C.ink, textDecoration: 'none' }}>
            <span style={{ width: '31px', height: '31px', borderRadius: '8px', background: C.tomato, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '16px', transform: 'rotate(-4deg)' }}>出</span>
            出店コネクトナビ
          </Link>
          <nav className='top2-nav' style={{ display: 'flex', alignItems: 'center', gap: '26px' }}>
            <a href='#works' style={{ color: C.ink, textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>出店実績</a>
            <a href='#service' style={{ color: C.ink, textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>サービス</a>
            <Link href='/blog' style={{ color: C.ink, textDecoration: 'none', fontSize: '14px', fontWeight: 500 }}>お知らせ</Link>
            <Link href='/contact' className='top2-contact' style={{ background: C.ink, color: C.paper, padding: '9px 18px', borderRadius: '999px', fontSize: '13.5px', fontWeight: 700, textDecoration: 'none' }}>お問い合わせ</Link>
          </nav>
        </div>
      </div>

      {/* HERO */}
      <header style={{ position: 'relative', padding: '70px 0 60px', background: `linear-gradient(180deg,${C.paper},${C.paper2})` }}>
        <div style={wrapStyle}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: C.leafDeep, background: '#fff', border: '1px solid ' + C.line, padding: '7px 15px', borderRadius: '999px', marginBottom: '24px' }}>
            <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: C.leaf }}></span>
            千葉・東京・埼玉のキッチンカーマッチング
          </span>
          <h1 style={{ fontSize: 'clamp(36px,6.5vw,64px)', fontWeight: 900, letterSpacing: '-0.03em', marginBottom: '20px', lineHeight: 1.3 }}>
            キッチンカーと、<br />
            <span style={{ position: 'relative', whiteSpace: 'nowrap', color: C.tomato, zIndex: 0 }}>
              場所
              <span style={{ position: 'absolute', left: '-2%', right: '-2%', bottom: '6%', height: '32%', background: C.grill, opacity: .32, zIndex: -1, borderRadius: '3px', transform: 'rotate(-1deg)' }}></span>
            </span>
            をつなぐ。
          </h1>
          <p style={{ fontSize: 'clamp(15px,2.2vw,18px)', color: C.muted, maxWidth: '600px', marginBottom: '14px' }}>
            スーパー・工場・大学などの空きスペースと、キッチンカーをマッチング。<br />
            <b style={{ color: C.ink, fontWeight: 700 }}>「呼びたい」も「出したい」も、出店コネクトナビにおまかせください。</b>
          </p>

          {/* two gates */}
          <div className='top2-gates'>
            <Link href='/vendor' className='top2-gate' style={{ position: 'relative', borderRadius: '18px', padding: '26px 24px', textDecoration: 'none', overflow: 'hidden', display: 'block', background: C.tomato, color: '#fff', boxShadow: '0 12px 28px -12px rgba(224,83,61,.6)' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'grid', placeItems: 'center', fontSize: '24px', marginBottom: '16px', background: 'rgba(255,255,255,.2)' }}>📣</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#ffe4dd', marginBottom: '4px' }}>施設・スペースをお持ちの方</div>
              <div style={{ fontSize: '21px', fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>キッチンカーを呼びたい <span className='top2-ar'>→</span></div>
              <div style={{ fontSize: '13.5px', marginTop: '8px', lineHeight: 1.6, color: '#ffe9e3' }}>空いた場所にキッチンカーを。募集から運営まで全部おまかせ。</div>
            </Link>
            <Link href='/space' className='top2-gate' style={{ position: 'relative', borderRadius: '18px', padding: '26px 24px', textDecoration: 'none', overflow: 'hidden', display: 'block', background: '#fff', color: C.ink, border: '1.5px solid ' + C.line }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '12px', display: 'grid', placeItems: 'center', fontSize: '24px', marginBottom: '16px', background: C.paper2 }}>🚚</div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: C.muted, marginBottom: '4px' }}>キッチンカー事業者の方</div>
              <div style={{ fontSize: '21px', fontWeight: 900, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '8px' }}>キッチンカーを出したい <span className='top2-ar'>→</span></div>
              <div style={{ fontSize: '13.5px', marginTop: '8px', lineHeight: 1.6, color: C.muted }}>あなたの料理に合った出店先を紹介。平日の安定案件も。</div>
            </Link>
          </div>

          {/* trucks strip */}
          <div style={{ marginTop: '48px', background: `linear-gradient(180deg,${C.paper2},#e7dccb)`, border: '1px solid ' + C.line, borderRadius: '20px', padding: '28px 28px 24px', position: 'relative', overflow: 'hidden' }}>
            <div className='top2-trucks'>
              {[
                { em: '🍜', nm: 'ラーメンきっちん', lc: 'スーパー駐車場 ・ 平日ランチ', tg: '# 毎週火曜' },
                { em: '🥐', nm: 'こむぎベーカリー', lc: '工場敷地 ・ 従業員向け', tg: '# 毎週木曜' },
                { em: '🌮', nm: 'タコスワゴン', lc: '商業施設 ・ 週末スポット', tg: '# 単発OK' },
              ].map(t => (
                <div key={t.nm} style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '14px', padding: '14px 16px', flex: 1, minWidth: '170px', zIndex: 2, boxShadow: '0 8px 20px -12px rgba(43,38,32,.4)' }}>
                  <div style={{ fontSize: '26px', lineHeight: 1 }}>{t.em}</div>
                  <div style={{ fontWeight: 700, fontSize: '14px', marginTop: '8px' }}>{t.nm}</div>
                  <div style={{ fontSize: '12px', color: C.muted, marginTop: '2px' }}>{t.lc}</div>
                  <span style={{ display: 'inline-block', marginTop: '10px', fontSize: '11px', fontWeight: 700, color: C.leafDeep, background: '#eaf3ee', borderRadius: '6px', padding: '3px 9px' }}>{t.tg}</span>
                </div>
              ))}
            </div>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: '54px', background: C.char }}>
              <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '3px', background: `repeating-linear-gradient(90deg,${C.grill} 0 26px,transparent 26px 52px)`, transform: 'translateY(-50%)', opacity: .85 }}></div>
            </div>
          </div>
        </div>
      </header>

      {/* SERVICES */}
      <section id='service' style={{ padding: '76px 0' }}>
        <div style={wrapStyle}>
          <div className={bricolage.className} style={kickerStyle}>Service</div>
          <h2 style={hSecStyle}>出店コネクトナビのサービス</h2>
          <p style={leadStyle}>キッチンカーを「呼びたい人」と「出したい人」、そのどちらもサポートします。</p>
          <div className='top2-svc-grid'>
            {[
              { ic: '😋', bg: '#fdeee6', h: 'キッチンカーを呼びたい', p: '学生や従業員のランチタイムに、イベントの賑わいに。バラエティ豊かなキッチンカーで、いつもの場所をもっと楽しく。', href: '/vendor', label: '詳しく見る' },
              { ic: '🚚', bg: '#eaf3ee', h: 'キッチンカーを出したい', p: '出店場所にお困りの方へ。料理に合った場所を紹介し、スケジュール調整から売上アップのアドバイスまでサポートします。', href: '/space', label: '詳しく見る' },
              { ic: '📍', bg: '#fdf3dd', h: '出店実績', p: 'スーパー・工場・大学・商業施設など、地域に根ざした出店先が中心。平日の定期出店に多くの実績があります。', href: '#works', label: '実績を見る' },
            ].map(s => (
              <div key={s.h} className='top2-svc' style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '18px', padding: '30px 26px' }}>
                <div style={{ width: '54px', height: '54px', borderRadius: '14px', display: 'grid', placeItems: 'center', fontSize: '26px', marginBottom: '18px', background: s.bg }}>{s.ic}</div>
                <h3 style={{ fontSize: '19px', fontWeight: 900, marginBottom: '10px', lineHeight: 1.3 }}>{s.h}</h3>
                <p style={{ fontSize: '14px', color: C.muted, marginBottom: '14px' }}>{s.p}</p>
                {s.href.startsWith('#')
                  ? <a href={s.href} style={{ fontSize: '13px', fontWeight: 700, color: C.tomatoDeep, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>{s.label} <span className='top2-ar'>→</span></a>
                  : <Link href={s.href} style={{ fontSize: '13px', fontWeight: 700, color: C.tomatoDeep, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>{s.label} <span className='top2-ar'>→</span></Link>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RECOMMEND */}
      <section style={{ padding: '76px 0', background: C.char, color: C.paper }}>
        <div style={wrapStyle}>
          <div className={bricolage.className} style={{ ...kickerStyle, color: C.grill }}>こんな方におすすめ</div>
          <h2 style={{ ...hSecStyle, color: '#fff' }}>その悩み、出店コネクトナビが。</h2>
          <p style={{ ...leadStyle, color: '#c9c0b4' }}>ランチタイムの活性化から出店先探しまで、あらゆるニーズに対応します。</p>
          <div className='top2-rec-wrap'>
            {[
              { badgeBg: 'rgba(224,83,61,.25)', em: '📣', hd: 'キッチンカーを呼びたい方', items: ['毎日同じお弁当やコンビニに飽きてきた…', '施設やイベントにもう少し活気がほしい', '募集や審査、当日の対応が面倒に感じる'] },
              { badgeBg: 'rgba(63,125,90,.3)', em: '🚚', hd: 'キッチンカーを出したい方', items: ['出店したいけれど、良い場所が見つからない', 'スケジュールの調整や交渉に自信がない', '平日に安定して出せる場所がほしい'] },
            ].map(col => (
              <div key={col.hd} style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.12)', borderRadius: '16px', padding: '26px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: 900, color: '#fff', marginBottom: '16px' }}>
                  <span style={{ width: '34px', height: '34px', borderRadius: '9px', display: 'grid', placeItems: 'center', fontSize: '18px', background: col.badgeBg }}>{col.em}</span>
                  {col.hd}
                </div>
                {col.items.map((it, i) => (
                  <div key={it} style={{ fontSize: '13.5px', color: '#e8e0d4', padding: '10px 0', borderTop: i === 0 ? 'none' : '1px solid rgba(255,255,255,.1)', display: 'flex', gap: '9px' }}>
                    <span style={{ color: C.grill, flexShrink: 0 }}>?</span>{it}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKS */}
      <section id='works' style={{ padding: '76px 0' }}>
        <div style={wrapStyle}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <div>
              <div className={bricolage.className} style={kickerStyle}>Our Works</div>
              <h2 style={{ ...hSecStyle, marginBottom: 0 }}>出店実績</h2>
            </div>
            <p style={{ ...leadStyle, marginBottom: '6px' }}>スーパー・工場・大学など、さまざまな場所でご活用いただいています。</p>
          </div>
          <div className='top2-works-grid'>
            {works.length === 0 && (
              <div style={{ color: C.muted, fontSize: '14px', padding: '20px 0' }}>読み込み中...</div>
            )}
            {works.map(w => (
              <Link key={w.id} href={'/places/' + w.id} className='top2-work' style={{ background: '#fff', border: '1px solid ' + C.line, borderRadius: '14px', overflow: 'hidden', textDecoration: 'none', color: C.ink, display: 'block' }}>
                <div style={{ height: '130px', background: w.image_url ? `url(${w.image_url}) center/cover no-repeat` : `linear-gradient(135deg,${C.paper2},${C.sky})`, display: 'grid', placeItems: 'center' }}>
                  {!w.image_url && <span style={{ fontSize: '34px', opacity: .4 }}>{typeIcon(w.place_type)}</span>}
                </div>
                <div style={{ padding: '14px 16px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: C.tomatoDeep, marginBottom: '3px' }}>{w.prefecture || 'エリア未設定'}</div>
                  <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '4px', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{w.title}</div>
                  <div style={{ fontSize: '12px', color: C.muted }}>{typeLabel(w.place_type)}</div>
                </div>
              </Link>
            ))}
          </div>
          <div style={{ textAlign: 'center', marginTop: '36px' }}>
            <Link href='/places' className='top2-btn-line' style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', border: '1.5px solid ' + C.ink, color: C.ink, textDecoration: 'none', fontWeight: 700, fontSize: '14px', padding: '12px 28px', borderRadius: '999px' }}>出店実績をもっと見る <span>→</span></Link>
          </div>
        </div>
      </section>

      {/* AREA */}
      <section style={{ padding: '76px 0', background: C.paper2 }}>
        <div style={wrapStyle}>
          <div className={bricolage.className} style={kickerStyle}>Area</div>
          <h2 style={hSecStyle}>対応エリア</h2>
          <p style={leadStyle}>千葉を中心に、首都圏エリアで出店先とキッチンカーをつないでいます。</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', marginTop: '28px' }}>
            {['千葉', '東京', '埼玉', '茨城'].map(p => (
              <span key={p} style={{ fontSize: '15px', fontWeight: 700, padding: '10px 22px', background: '#fff', border: '1px solid ' + C.line, borderRadius: '999px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: C.tomato }}></span>{p}
              </span>
            ))}
            <span style={{ fontSize: '15px', fontWeight: 700, padding: '10px 22px', background: '#fff', border: '1px solid ' + C.line, borderRadius: '999px', color: C.muted }}>順次拡大中</span>
          </div>
        </div>
      </section>

      {/* FINAL */}
      <section style={{ padding: '60px 0' }}>
        <div style={wrapStyle}>
          <div style={{ background: C.tomato, color: '#fff', textAlign: 'center', borderRadius: '26px', padding: '56px 30px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(circle at 18% 20%,rgba(255,255,255,.14),transparent 42%),radial-gradient(circle at 85% 82%,rgba(0,0,0,.12),transparent 45%)' }}></div>
            <div style={{ position: 'relative', zIndex: 2 }}>
              <h2 style={{ fontSize: 'clamp(24px,4vw,38px)', fontWeight: 900, letterSpacing: '-0.02em', marginBottom: '14px', color: '#fff', lineHeight: 1.3 }}>まずは、お気軽にご相談ください。</h2>
              <p style={{ fontSize: '15px', color: '#ffe9e3', maxWidth: '480px', margin: '0 auto 30px' }}>「呼びたい」も「出したい」も。あなたのご要望をお聞かせください。</p>
              <div style={{ display: 'flex', gap: '14px', justifyContent: 'center', flexWrap: 'wrap' }}>
                <Link href='/vendor' className='top2-fg' style={{ textDecoration: 'none', fontWeight: 800, fontSize: '15px', padding: '15px 32px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#fff', color: C.tomatoDeep }}>📣 キッチンカーを呼びたい</Link>
                <Link href='/space' className='top2-fg' style={{ textDecoration: 'none', fontWeight: 800, fontSize: '15px', padding: '15px 32px', borderRadius: '999px', display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'rgba(255,255,255,.15)', color: '#fff', border: '1.5px solid rgba(255,255,255,.5)' }}>🚚 キッチンカーを出したい</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ padding: '48px 0 40px', borderTop: '1px solid ' + C.line, background: C.paper }}>
        <div style={wrapStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px', flexWrap: 'wrap', marginBottom: '30px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', fontWeight: 900, fontSize: '18px', letterSpacing: '-0.02em', marginBottom: '10px' }}>
                <span style={{ width: '31px', height: '31px', borderRadius: '8px', background: C.tomato, color: '#fff', display: 'grid', placeItems: 'center', fontSize: '16px', transform: 'rotate(-4deg)' }}>出</span>
                出店コネクトナビ
              </div>
              <p style={{ fontSize: '13px', color: C.muted }}>キッチンカーと、場所をつなぐ。</p>
            </div>
            <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap' }}>
              <div className='top2-foot-col'>
                <h4 style={{ fontSize: '12px', color: C.muted, fontWeight: 700, marginBottom: '12px', letterSpacing: '.05em' }}>メニュー</h4>
                <Link href='/' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>トップ</Link>
                <a href='#works' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>出店実績</a>
                <a href='#service' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>サービス</a>
                <Link href='/blog' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>お知らせ</Link>
              </div>
              <div className='top2-foot-col'>
                <h4 style={{ fontSize: '12px', color: C.muted, fontWeight: 700, marginBottom: '12px', letterSpacing: '.05em' }}>ご利用の方へ</h4>
                <Link href='/vendor' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>キッチンカーを呼びたい</Link>
                <Link href='/space' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>キッチンカーを出したい</Link>
                <Link href='/login' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>出店者ログイン</Link>
              </div>
              <div className='top2-foot-col'>
                <h4 style={{ fontSize: '12px', color: C.muted, fontWeight: 700, marginBottom: '12px', letterSpacing: '.05em' }}>会社情報</h4>
                <Link href='/company' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>会社概要</Link>
                <Link href='/privacy' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>プライバシーポリシー</Link>
                <Link href='/terms' style={{ display: 'block', color: C.ink, textDecoration: 'none', fontSize: '13.5px', marginBottom: '8px' }}>利用規約</Link>
              </div>
            </div>
          </div>
          <div style={{ borderTop: '1px solid ' + C.line, paddingTop: '20px', fontSize: '12px', color: C.muted, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
            <span>© 2026 出店コネクトナビ</span>
            <span>千葉・東京・埼玉・茨城</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
