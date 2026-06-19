'use client'
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet'
import { useEffect } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import Link from 'next/link'

// Next.js環境でデフォルトマーカー画像が壊れる問題への対処（CDNのアイコンを使う）
const icon = L.icon({
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
})

export type MapPin = {
  id: string
  title: string
  prefecture: string | null
  fee: string | null
  latitude: number
  longitude: number
}

// データ更新時に地図を作り直さず、setViewで滑らかに追従させる
function MapFollower({ pins }: { pins: MapPin[] }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length > 0) {
      map.setView([pins[0].latitude, pins[0].longitude], 10, { animate: true })
    }
  }, [pins, map])
  return null
}

export default function PlacesMap({ pins }: { pins: MapPin[] }) {
  // 初回マウント時の中心（データがあればその先頭、なければ日本全体）
  const center: [number, number] = pins.length > 0
    ? [pins[0].latitude, pins[0].longitude]
    : [36.2048, 138.2529]
  const zoom = pins.length > 0 ? 10 : 5

  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '420px', width: '100%', borderRadius: '12px' }} scrollWheelZoom={true}>
      <MapFollower pins={pins} />
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {pins.map(p => (
        <Marker key={p.id} position={[p.latitude, p.longitude]} icon={icon}>
          <Popup>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{p.title}</div>
            {p.prefecture && <div style={{ fontSize: '12px', color: '#555' }}>📍 {p.prefecture}</div>}
            <div style={{ fontSize: '12px', color: '#111', marginBottom: '6px' }}>{p.fee || '要相談'}</div>
            <Link href={'/places/' + p.id} style={{ fontSize: '12px', color: '#F5A623', fontWeight: 700 }}>詳細を見る →</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  )
}
