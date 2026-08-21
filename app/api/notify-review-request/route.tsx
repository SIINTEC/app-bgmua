import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushToUser } from '@/lib/push'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { clientId } = await req.json()
  if (!clientId) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  await sendPushToUser(clientId, {
    title: '¿Cómo estuvo tu servicio?',
    body: 'Nos encantaría conocer tu opinión. Califica tu cita.',
    url: '/mis-citas',
  })

  return NextResponse.json({ ok: true })
}