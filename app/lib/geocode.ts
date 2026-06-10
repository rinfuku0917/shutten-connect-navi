// OpenStreetMap Nominatim を使って住所→緯度経度を取得する（無料・APIキー不要）
// 利用規約上 1秒1リクエストまで。複数件は呼び出し側で間隔を空けること。
export async function geocodeAddress(address: string): Promise<{ lat: number; lon: number } | null> {
  if (!address || !address.trim()) return null
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=jp`
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
