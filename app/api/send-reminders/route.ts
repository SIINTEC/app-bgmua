import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushToUser } from '@/lib/push'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const tomorrowStart = new Date()
  tomorrowStart.setDate(tomorrowStart.getDate() + 1)
  tomorrowStart.setHours(0, 0, 0, 0)

  const tomorrowEnd = new Date(tomorrowStart)
  tomorrowEnd.setHours(23, 59, 59, 999)

  const { data: appointments } = await supabaseAdmin
    .from('appointments')
    .select('*, services(name)')
    .gte('scheduled_at', tomorrowStart.toISOString())
    .lte('scheduled_at', tomorrowEnd.toISOString())
    .in('status', ['pendiente', 'confirmada'])
    .eq('reminder_sent', false)

  for (const a of appointments ?? []) {
    await sendPushToUser(a.client_id, {
      title: 'Recordatorio de tu cita',
      body: `Mañana tienes tu cita de ${a.services?.name ?? 'tu servicio'}.`,
      url: '/mis-citas',
    })
    await supabaseAdmin.from('appointments').update({ reminder_sent: true }).eq('id', a.id)
  }

  return NextResponse.json({ sent: appointments?.length ?? 0 })
}