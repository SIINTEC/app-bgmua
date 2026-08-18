'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LogoutButton from '../components/LogoutButton'

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

export default function AdminPanel() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

      if (profile?.role !== 'admin') {
        router.push('/')
        return
      }

      setAuthorized(true)

      const { data } = await supabase
        .from('appointments')
        .select('*, services(name, price, duration_minutes), profiles(full_name, phone), appointment_addons(addons(name, extra_price))')
        .order('scheduled_at', { ascending: true })

      setAppointments(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  async function updateStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
  }

  function total(a: any) {
    const base = Number(a.services?.price ?? 0)
    const extras = (a.appointment_addons ?? []).reduce(
      (sum: number, ea: any) => sum + Number(ea.addons?.extra_price ?? 0),
      0
    )
    return base + extras
  }

  if (loading || !authorized) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Panel de citas</h1>
            <p className="mt-1 text-sm text-gray-500">Todas las citas agendadas por las clientas</p>
          </div>
          <LogoutButton />
        </div>

        <div className="mt-6 space-y-3">
          {appointments.length === 0 && <p className="text-gray-500">No hay citas todavía.</p>}

          {appointments.map((a) => (
            <div key={a.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-medium text-gray-900">{a.profiles?.full_name}</h2>
                  <p className="text-sm text-gray-500">{a.services?.name} · {a.profiles?.phone}</p>
                </div>
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

              <div className="mt-3 flex gap-3">
                {a.status === 'pendiente' && (
                  <button onClick={() => updateStatus(a.id, 'confirmada')} className="text-xs font-medium text-green-700">
                    Confirmar
                  </button>
                )}
                {a.status !== 'completada' && a.status !== 'cancelada' && (
                  <button onClick={() => updateStatus(a.id, 'completada')} className="text-xs font-medium text-blue-700">
                    Marcar completada
                  </button>
                )}
                {a.status !== 'cancelada' && (
                  <button onClick={() => updateStatus(a.id, 'cancelada')} className="text-xs font-medium text-red-600">
                    Cancelar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}