'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export default function MisCitas() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('appointments')
        .select('*, services(name, price, duration_minutes), appointment_addons(addons(name, extra_price))')
        .eq('client_id', user.id)
        .order('scheduled_at', { ascending: true })

      setAppointments(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function cancelar(id: string) {
    await supabase.from('appointments').update({ status: 'cancelada' }).eq('id', id)
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: 'cancelada' } : a)))
  }

  function total(a: any) {
    const base = Number(a.services?.price ?? 0)
    const extras = (a.appointment_addons ?? []).reduce(
      (sum: number, ea: any) => sum + Number(ea.addons?.extra_price ?? 0),
      0
    )
    return base + extras
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Mis citas</h1>

        <div className="mt-6 space-y-3">
          {appointments.length === 0 && <p className="text-gray-500">Todavía no tienes citas agendadas.</p>}

          {appointments.map((a) => (
            <div key={a.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">{a.services?.name}</h2>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-700">
                  {statusLabels[a.status] ?? a.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {new Date(a.scheduled_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>

              {a.appointment_addons?.length > 0 && (
                <ul className="mt-2 text-xs text-gray-500 list-disc list-inside">
                  {a.appointment_addons.map((ea: any, i: number) => (
                    <li key={i}>{ea.addons?.name} (+${Number(ea.addons?.extra_price).toLocaleString('es-MX')})</li>
                  ))}
                </ul>
              )}

              <p className="text-sm font-medium text-gray-700 mt-2">Total: ${total(a).toLocaleString('es-MX')}</p>

              {a.notes && <p className="text-sm text-gray-400 mt-1">{a.notes}</p>}

              {a.status !== 'cancelada' && a.status !== 'completada' && (
                <button onClick={() => cancelar(a.id)} className="mt-3 text-xs font-medium text-red-600">
                  Cancelar cita
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}