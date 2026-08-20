import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushToAll } from '@/lib/push'

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    console.log('DEBUG: no llego token')
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
  console.log('DEBUG userError:', userError, 'user:', user?.id)

  if (userError || !user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  console.log('DEBUG profileError:', profileError, 'profile:', profile)

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { title } = await req.json()

  await sendPushToAll({
    title: 'Nueva publicación',
    body: title || 'Bianka Gómez Maquillaje publicó algo nuevo.',
    url: '/noticias',
  })

  return NextResponse.json({ ok: true })
}