import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushToUser } from '@/lib/push'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    console.log('DEBUG: no llegó token')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  console.log('DEBUG userError:', userError)
  console.log('DEBUG user:', user?.id, user?.email)

  if (userError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log('DEBUG profileError:', profileError)
  console.log('DEBUG profile:', profile)

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { clientId, title, body, url } = await req.json()
  if (!clientId || !title) {
    return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
  }

  await sendPushToUser(clientId, { title, body: body ?? '', url: url ?? '/mis-citas' })

  return NextResponse.json({ ok: true })
}