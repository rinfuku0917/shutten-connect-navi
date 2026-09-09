// SNSのリンクを、押せば必ず開く形に揃える。
//
// これまでプロフィールのSNS欄は自由入力で、案内の例が「@hana_sweets」だった。
// そのため皆さん「@名前」や表示名（「出店コネクトナビ」）をそのまま入れ、
// それがURLとして保存されて、施設の方がタップしても開けなかった。
// 実データでは Instagram 6件のうち4件が「@…」で壊れていた。
//
// 方針:
//   ・入力欄には固定の「instagram.com/」を出し、アカウント名だけ入れてもらう
//   ・URLを丸ごと貼られても（?stkn=…&utm_source=qr 付きでも）アカウント名を取り出す
//   ・表示名（日本語・空白）は受け付けず、その場で理由を返す
//   ・保存するのは常に https:// から始まる完全なURL
//   ・表示側は、昔の「@…」のままの値も同じ規則でURLに直す（保存し直しを待たない）
//   ・どんな入力でも例外を外に出さない（公開ページの描画中に呼ばれるため）

export type SnsPlatform = 'instagram' | 'twitter' | 'youtube' | 'tiktok'

export const SNS_PLATFORMS: SnsPlatform[] = ['instagram', 'twitter', 'youtube', 'tiktok']

export const SNS_LABEL: Record<SnsPlatform, string> = {
  instagram: 'Instagram', twitter: 'X（Twitter）', youtube: 'YouTube', tiktok: 'TikTok',
}

// 入力欄の左に固定で出す文字。ここに続けてアカウント名だけを打ってもらう
export const SNS_PREFIX: Record<SnsPlatform, string> = {
  instagram: 'instagram.com/',
  twitter: 'x.com/',
  youtube: 'youtube.com/',
  tiktok: 'tiktok.com/@',
}

// 入力例。「@」を付けた例は出さない（それが誤入力の元だった）。
// YouTube だけは「@名前」がそのままURLの一部なので @ 付きで示す
export const SNS_PLACEHOLDER: Record<SnsPlatform, string> = {
  instagram: 'hana_sweets',
  twitter: 'hana_sweets_jp',
  youtube: '@hana_sweets',
  tiktok: 'hana_sweets',
}

// 入力欄の下に出す、そのSNSに合わせた短い案内
export const SNS_HINT: Record<SnsPlatform, string> = {
  instagram: 'アカウント名だけ（「@」は付けない）。プロフィールのURLを貼っても大丈夫です',
  twitter: 'アカウント名だけ（「@」は付けない）。x.com／twitter.com のURLを貼っても大丈夫です',
  youtube: '「@名前」か、チャンネルのURL。動画のURLではなくチャンネルのURLを',
  tiktok: 'アカウント名だけ（「@」は左に付いています）。共有の短いリンク（vt.tiktok.com）は使えません',
}

const HANDLE: Record<SnsPlatform, RegExp> = {
  instagram: /^[A-Za-z0-9._]{1,30}$/,
  twitter: /^[A-Za-z0-9_]{1,15}$/,
  youtube: /^@[A-Za-z0-9._-]{3,30}$/,
  tiktok: /^[A-Za-z0-9._]{1,24}$/,
}

// URLとして受け付けるホスト。TikTok の共有用（vt./vm.）は、
// 短いIDがアカウント名に見えてしまうので受け付けない
const HOSTS: Record<SnsPlatform, RegExp> = {
  instagram: /^(www\.|m\.)?instagram\.com$/i,
  twitter: /^(www\.|mobile\.)?(twitter|x)\.com$/i,
  youtube: /^((www|m|music)\.)?youtube\.com$|^youtu\.be$/i,
  tiktok: /^(www\.|m\.)?tiktok\.com$/i,
}

// アカウントのページではない、サイト側の予約されたパス。アカウント名として受けない
const RESERVED: Record<SnsPlatform, Set<string>> = {
  instagram: new Set(['accounts', 'direct', 'explore', 'about', 'legal', 'developer', 'press', 'api', 'privacy', 'terms', 'web', 'challenge']),
  twitter: new Set(['i', 'home', 'search', 'explore', 'intent', 'settings', 'messages', 'notifications', 'compose', 'login', 'signup', 'tos', 'privacy', 'hashtag']),
  youtube: new Set(['feed', 'results', 'playlist', 'account', 'premium', 'gaming', 'about', 'ads', 'creators', 'howyoutubeworks', 't']),
  tiktok: new Set(['t', 'foryou', 'following', 'search', 'tag', 'discover', 'explore', 'live', 'music', 'upload', 'setting', 'login', 'signup', 'legal', 'about', 'business', 'embed']),
}

// Instagram で、プロフィールではなく投稿などを指す先頭の区切り。
// これらは2段目まで残す（https://www.instagram.com/p/XXXX）
const IG_NON_PROFILE = new Set(['p', 'reel', 'reels', 'stories', 'tv'])

export type SnsParse =
  | { ok: true; handle: string; url: string }
  | { ok: false; error: string }

function urlOf(platform: SnsPlatform, handle: string): string {
  switch (platform) {
    case 'instagram': return 'https://www.instagram.com/' + handle
    case 'twitter': return 'https://x.com/' + handle
    case 'youtube': return 'https://www.youtube.com/' + handle
    case 'tiktok': return 'https://www.tiktok.com/@' + handle
  }
}

// %が壊れていても落とさない（昔の自由入力の値がそのまま残っているため）
function safeDecode(x: string): string {
  try { return decodeURIComponent(x) } catch { return x }
}

// URLらしい文字列から、そのSNSのアカウント名（ハンドル）を取り出す。
// 取り出せなければ null（URLではない、別のサイト、予約パス、共有用の短いリンク）
function handleFromUrl(platform: SnsPlatform, raw: string): string | null {
  let s = raw.trim()
  if (!/^https?:\/\//i.test(s)) {
    // 「www.instagram.com/xxx」「m.youtube.com/xxx」のように scheme 無しで貼られたとき
    if (/^([a-z0-9-]+\.)*(instagram\.com|twitter\.com|x\.com|youtube\.com|youtu\.be|tiktok\.com)\//i.test(s)) s = 'https://' + s
    else return null
  }
  let u: URL
  try { u = new URL(s) } catch { return null }
  if (!HOSTS[platform].test(u.hostname)) return null

  // 追跡パラメータ（?stkn=…&utm_source=qr、?igsh=…）は捨てる
  const segs = u.pathname.split('/').filter(Boolean).map(safeDecode)
  if (segs.length === 0) return null
  const first = segs[0]
  if (RESERVED[platform].has(first.toLowerCase())) return null

  // URLから取り出したものも、アカウント名として正しい形かを最後に確かめる
  // （「100%」のような、昔の自由入力で壊れた値がそのまま通らないように）
  const checked = (h: string | null) => (h && handleOk(platform, h) ? h : null)

  switch (platform) {
    case 'instagram': {
      if (IG_NON_PROFILE.has(first.toLowerCase())) return checked(segs.length >= 2 ? segs.slice(0, 2).join('/') : null)
      return checked(first)
    }
    case 'twitter':
      return checked(first)
    case 'tiktok': {
      // アカウントのページは必ず「/@名前」。それ以外（短いリンクのIDなど）は受けない
      if (!first.startsWith('@') || first.length < 2) return null
      return checked(first.slice(1))
    }
    case 'youtube': {
      // youtu.be/xxxx や watch?v= は動画。プロフィールではないが、開ける先ではあるので残す
      if (/^youtu\.be$/i.test(u.hostname)) return checked('watch?v=' + first)
      if (first === 'watch') {
        const v = u.searchParams.get('v')
        return v ? checked('watch?v=' + v) : null
      }
      // @handle は1段目だけ（/videos や /featured のタブは捨てる）
      if (first.startsWith('@')) return checked(first)
      // channel/UC… / c/xxx / user/xxx / shorts/xxx / live/xxx は2段目まで
      if (['channel', 'c', 'user', 'shorts', 'live'].includes(first.toLowerCase())) {
        return checked(segs.length >= 2 ? segs.slice(0, 2).join('/') : null)
      }
      return null
    }
  }
}

// 手入力のアカウント名（URLではない）が、そのSNSの形になっているか
function handleOk(platform: SnsPlatform, h: string): boolean {
  // 「instagram.com」のような、ドメインだけ・接頭辞だけを打ったもの
  if (/^(www\.)?(instagram\.com|x\.com|twitter\.com|youtube\.com|youtu\.be|tiktok\.com)$/i.test(h)) return false
  switch (platform) {
    case 'instagram':
      return HANDLE.instagram.test(h) || /^(p|reel|reels|stories|tv)\/[A-Za-z0-9._-]+$/.test(h)
    case 'twitter':
      return HANDLE.twitter.test(h)
    case 'tiktok':
      return HANDLE.tiktok.test(h)
    case 'youtube':
      return HANDLE.youtube.test(h)
        || /^(channel|c|user|shorts|live)\/[A-Za-z0-9._-]+$/.test(h)
        || /^watch\?v=[A-Za-z0-9_-]+$/.test(h)
  }
}

// 入力された文字列を、保存できる形に直す。
// 空は ok（未設定）として扱う。どんな入力でも例外は出さない
export function parseSns(platform: SnsPlatform, raw: string): SnsParse | { ok: true; handle: ''; url: '' } {
  try {
    // 全角の「＠」や全角スペースも、半角と同じに扱う
    const s = String(raw ?? '').replace(/＠/g, '@').replace(/[　\s]+/g, ' ').trim()
    if (!s) return { ok: true, handle: '', url: '' }

    // 1) URLを貼られた
    const fromUrl = handleFromUrl(platform, s)
    if (fromUrl) return { ok: true, handle: fromUrl, url: urlOf(platform, fromUrl) }

    // 2) 「@名前」か、アカウント名だけ
    let h = s.replace(/^@+/, '').replace(/\/+$/, '')
    if (platform === 'youtube' && !/^(channel|c|user|shorts|live)\//.test(h) && !h.startsWith('watch?v=')) {
      h = '@' + h
    }
    if (handleOk(platform, h)) return { ok: true, handle: h, url: urlOf(platform, h) }

    // 3) それ以外（表示名・日本語・空白入り・別サイトのURL・共有用の短いリンク）
    const isUrlLike = /^(https?:\/\/|www\.)/i.test(s) || /\.(com|be|jp|net)\//i.test(s)
    if (isUrlLike) {
      if (platform === 'tiktok' && /tiktok\.com/i.test(s)) {
        return { ok: false, error: 'TikTok は共有用の短いリンクではなく、プロフィールのURL（tiktok.com/@名前）かアカウント名を入れてください' }
      }
      if (platform === 'youtube' && /youtu/i.test(s)) {
        return { ok: false, error: 'YouTube はチャンネルのURL（youtube.com/@名前）か「@名前」を入れてください' }
      }
      return { ok: false, error: SNS_LABEL[platform] + 'のURLではないようです。' + SNS_LABEL[platform] + 'のプロフィールのURLかアカウント名を入れてください' }
    }
    const hasWide = /[^\x20-\x7E]/.test(s)
    if (hasWide || /\s/.test(s)) {
      return { ok: false, error: '「' + s.slice(0, 20) + '」は表示名のようです。アカウント名（英数字・ピリオド・アンダースコア）か、プロフィールのURLを入れてください' }
    }
    return { ok: false, error: SNS_LABEL[platform] + 'のアカウント名かURLの形になっていません' }
  } catch {
    return { ok: false, error: SNS_LABEL[platform] + 'のアカウント名かURLの形になっていません' }
  }
}

// 保存されている値（URL・昔の「@…」・生のアカウント名）から、押せるURLを返す。
// 直せなければ空。空のときはリンクにしない（開けないリンクを出すほうが困る）
export function snsHref(platform: string, stored: string | null | undefined): string {
  try {
    if (!SNS_PLATFORMS.includes(platform as SnsPlatform)) {
      // 知らない platform は、http(s) のURLならそのまま
      const s = String(stored ?? '').trim()
      return /^https?:\/\//i.test(s) ? s : ''
    }
    const r = parseSns(platform as SnsPlatform, stored || '')
    return r.ok ? r.url : ''
  } catch {
    return ''
  }
}

// 保存されている値を、入力欄に出すアカウント名に直す（固定の接頭辞のうしろに出す分）
export function snsHandle(platform: SnsPlatform, stored: string | null | undefined): string {
  const r = parseSns(platform, stored || '')
  if (r.ok) return r.handle
  // 直せない古い値は、そのまま見せて直してもらう
  return String(stored ?? '').trim()
}
