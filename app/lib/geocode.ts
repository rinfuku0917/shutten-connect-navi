// OpenStreetMap Nominatim で住所→緯度経度を取得（無料・APIキー不要）
// 「丁目＋番地」など詳細すぎる住所は失敗しやすいので、段階的に粗くして再試行する。
// 利用規約上 1秒1リクエストまで。複数件は呼び出し側で間隔を空けること。

async function tryGeocode(query: string): Promise<{ lat: number; lon: number } | null> {
  if (!query || !query.trim()) return null
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=jp`
  try {
    const res = await fetch(url, { headers: { 'Accept-Language': 'ja' } })
    if (!res.ok) return null
    const data = await res.json()
    if (!Array.isArray(data) || data.length === 0) return null
    const lat = parseFloat(data[0].lat)
    const lon = parseFloat(data[0].lon)
    if (isNaN(lat) || isNaN(lon)) return null
    return { lat, lon }
  } catch {
    return null
  }
}

function coarser(address: string): string {
  let a = address.trim()
  a = a.replace(/[0-9０-９]+\s*(丁目|番地|番|号|F|階)?\s*$/u, '').trim()
  a = a.replace(/[-－―ー]\s*$/u, '').trim()
  return a
}

export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address || !address.trim()) return null
  let hit = await tryGeocode(address)
  if (hit) return hit
  let a = address
  for (let i = 0; i < 4; i++) {
    const prev = a
    a = coarser(a)
    if (!a || a === prev) break
    await new Promise(res => setTimeout(res, 1000))
    hit = await tryGeocode(a)
    if (hit) return hit
  }
  return null
}
