'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import LogoutButton from '../components/LogoutButton'

const statusLabels: Record<string, string> = {
  pendiente: 'Pendiente',
  confirmada: 'Confirmada',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

const paymentStatusLabels: Record<string, string> = {
  pendiente: 'Anticipo pendiente',
  comprobante_subido: 'Comprobante en revisión',
  confirmado: 'Anticipo confirmado',
  rechazado: 'Comprobante rechazado',
}

function monthKey(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string) {
  const [y, m] = key.split('-').map(Number)
  const d = new Date(y, m - 1, 1)
  const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function AdminPanel() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [staffList, setStaffList] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [authorized, setAuthorized] = useState(false)
  const [statusFilter, setStatusFilter] = useState('todas')
  const [monthFilter, setMonthFilter] = useState('todas')

  async function loadAppointments() {
    const { data } = await supabase
      .from('appointments')
      .select('*, services(name, price, duration_minutes), profiles(full_name, phone), appointment_addons(addons(name, extra_price)), appointment_staff(staff(id, full_name)), promotions(name), salon_locations(name, address), service_zones(name)')
      .order('scheduled_at', { ascending: true })

    setAppointments(data ?? [])
  }

  async function loadStaff() {
    const { data } = await supabase.from('staff').select('*').eq('active', true)
    setStaffList(data ?? [])
  }

  useEffect(() => {
    async function init() {
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
      await Promise.all([loadAppointments(), loadStaff()])
      setLoading(false)
    }
    init()
  }, [router])

  async function handleRefresh() {
    setRefreshing(true)
    await Promise.all([loadAppointments(), loadStaff()])
    setRefreshing(false)
  }

  async function updateStatus(id: string, status: string) {
    await supabase.from('appointments').update({ status }).eq('id', id)
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)))
  }

  async function updatePaymentStatus(id: string, payment_status: string) {
    await supabase.from('appointments').update({ payment_status }).eq('id', id)
    setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, payment_status } : a)))
  }

  async function toggleStaffAssignment(
    appointmentId: string,
    staffId: string,
    isAssigned: boolean,
    clientId: string,
    staffName: string
  ) {
    if (isAssigned) {
      await supabase.from('appointment_staff').delete().eq('appointment_id', appointmentId).eq('staff_id', staffId)
    } else {
      await supabase.from('appointment_staff').insert({ appointment_id: appointmentId, staff_id: staffId })

      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        fetch('/api/notify-staff-assigned', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({
            clientId,
            title: 'Personal asignado a tu cita',
            body: `${staffName} te atenderá en tu próxima cita.`,
            url: '/mis-citas',
          }),
        }).catch(() => {})
      }
    }
    await loadAppointments()
  }

  async function viewComprobante(path: string) {
    const { data } = await supabase.storage.from('comprobantes').createSignedUrl(path, 60 * 5)
    if (data?.signedUrl) {
      window.open(data.signedUrl, '_blank')
    } else {
      alert('No se pudo abrir el comprobante')
    }
  }

  function total(a: any) {
    const base = Number(a.services?.price ?? 0)
    const extras = (a.appointment_addons ?? []).reduce(
      (sum: number, ea: any) => sum + Number(ea.addons?.extra_price ?? 0),
      0
    )
    const siteCost = Number(a.site_cost ?? 0)
    const discount = Number(a.discount_amount ?? 0)
    return Math.max(base + extras + siteCost - discount, 0)
  }

  const monthOptions = Array.from(new Set(appointments.map((a) => monthKey(a.scheduled_at)))).sort()

  const filtered = appointments.filter((a) => {
    const statusOk = statusFilter === 'todas' || a.status === statusFilter
    const monthOk = monthFilter === 'todas' || monthKey(a.scheduled_at) === monthFilter
    return statusOk && monthOk
  })

  if (loading || !authorized) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Panel de citas</h1>
            <p className="mt-1 text-sm text-gray-500">Todas las citas agendadas por las clientas</p>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={handleRefresh} disabled={refreshing} className="text-sm text-gray-500 underline disabled:opacity-50">
              {refreshing ? 'Actualizando...' : 'Actualizar'}
            </button>
            <Link href="/admin/promociones" className="text-sm text-gray-500 underline">Promociones</Link>
            <Link href="/admin/noticias" className="text-sm text-gray-500 underline">Noticias</Link>
            <Link href="/admin/staff" className="text-sm text-gray-500 underline">Equipo</Link>
            <Link href="/admin/servicios" className="text-sm text-gray-500 underline">Servicios</Link>
            <Link href="/admin/terminos" className="text-sm text-gray-500 underline">Editar términos</Link>
            <Link href="/admin/salones" className="text-sm text-gray-500 underline">Salones</Link>
            <Link href="/admin/zonas" className="text-sm text-gray-500 underline">Zonas</Link>
            <Link href="/admin/extras" className="text-sm text-gray-500 underline">Extras</Link>
            <LogoutButton />
          </div>
        </div>

        {appointments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700"
            >
              <option value="todas">Todos los estatus</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={monthFilter}
              onChange={(e) => setMonthFilter(e.target.value)}
              className="text-sm rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-700"
            >
              <option value="todas">Todos los meses</option>
              {monthOptions.map((key) => (
                <option key={key} value={key}>{monthLabel(key)}</option>
              ))}
            </select>
          </div>
        )}

        <div className="mt-6 space-y-3">
          {appointments.length === 0 && <p className="text-gray-500">No hay citas todavía.</p>}
          {appointments.length > 0 && filtered.length === 0 && (
            <p className="text-gray-500">No hay citas que coincidan con los filtros seleccionados.</p>
          )}

          {filtered.map((a) => (
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

              {a.site_type === 'estudio' && a.salon_locations && (
                <p className="text-xs text-gray-500 mt-1">
                  📍 En salón: {a.salon_locations.name} — {a.salon_locations.address}
                </p>
              )}
              {a.site_type === 'domicilio' && (
                <p className="text-xs text-gray-500 mt-1">
                  🏠 A domicilio{a.service_zones?.name ? ` (zona ${a.service_zones.name})` : ''}
                  {a.home_address ? `: ${a.home_address}` : ''}
                </p>
              )}

              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">Equipo asignado:</p>
                <div className="flex flex-wrap gap-3">
                  {staffList.map((s) => {
                    const isAssigned = a.appointment_staff?.some((as: any) => as.staff?.id === s.id)
                    return (
                      <label key={s.id} className="flex items-center gap-1 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={!!isAssigned}
                          onChange={() => toggleStaffAssignment(a.id, s.id, !!isAssigned, a.client_id, s.full_name)}
                        />
                        {s.full_name}
                      </label>
                    )
                  })}
                </div>
              </div>

              {a.appointment_addons?.length > 0 && (
                <ul className="mt-2 text-xs text-gray-500 list-disc list-inside">
                  {a.appointment_addons.map((ea: any, i: number) => (
                    <li key={i}>{ea.addons?.name} (+${Number(ea.addons?.extra_price).toLocaleString('es-MX')})</li>
                  ))}
                </ul>
              )}

              {a.discount_amount > 0 && (
                <p className="text-xs text-pink-600 mt-1">
                  Descuento aplicado{a.promotions?.name ? ` (${a.promotions.name})` : ''}: -$
                  {Number(a.discount_amount).toLocaleString('es-MX')}
                </p>
              )}

              <p className="text-sm font-medium text-gray-700 mt-2">Total: ${total(a).toLocaleString('es-MX')}</p>

              {a.notes && <p className="text-sm text-gray-400 mt-1">{a.notes}</p>}

              {a.deposit_amount > 0 && (
                <div className="mt-3 border-t pt-3">
                  <p className="text-xs font-medium text-gray-700">
                    Anticipo: ${Number(a.deposit_amount).toLocaleString('es-MX')} — {paymentStatusLabels[a.payment_status]}
                  </p>
                  {a.payment_proof_path && (
                    <button onClick={() => viewComprobante(a.payment_proof_path)} className="text-xs text-blue-700 underline mt-1">
                      Ver comprobante
                    </button>
                  )}
                  {a.payment_status !== 'confirmado' && (
                    <div className="flex gap-3 mt-2">
                      <button onClick={() => updatePaymentStatus(a.id, 'confirmado')} className="text-xs font-medium text-green-700">
                        Confirmar pago
                      </button>
                      <button onClick={() => updatePaymentStatus(a.id, 'rechazado')} className="text-xs font-medium text-red-600">
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 flex gap-3">
                {a.status === 'pendiente' && (
                  <button onClick={() => updateStatus(a.id, 'confirmada')} className="text-xs font-medium text-green-700">
                    Confirmar cita
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