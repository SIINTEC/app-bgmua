import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { sendPushToUser } from '@/lib/push'

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const cutoff = new Date(Date.now() - 72 * 60 * 60 * 1000).toISOString()

  const { data: overdue } = await supabaseAdmin
    .from('appointments')
    .select('id, client_id, services(name)')
    .in('payment_status', ['pendiente', 'rechazado'])
    .not('status', 'in', '(cancelada,completada)')
    .lt('created_at', cutoff)

  for (const a of overdue ?? []) {
    await supabaseAdmin.from('appointments').update({ status: 'cancelada' }).eq('id', a.id)
    await sendPushToUser(a.client_id, {
      title: 'Tu cita fue cancelada',
      body: `No recibimos tu comprobante de anticipo a tiempo para ${(a.services as any)?.name ?? 'tu servicio'}. Puedes agendar una nueva fecha cuando gustes.`,
      url: '/mis-citas',
    })
  }

  return NextResponse.json({ cancelled: overdue?.length ?? 0 })
}