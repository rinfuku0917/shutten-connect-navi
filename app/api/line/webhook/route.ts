import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const events = body.events || []
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (url && serviceKey) {
      const db = createClient(url, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
      for (const ev of events) {
        const uid = ev.source?.userId
        if (uid) {
          await db.from('line_debug').insert({ user_id: uid })
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ ok: true })
  }
}

export async function GET() {
  return NextResponse.json({ status: 'webhook ready' })
}
