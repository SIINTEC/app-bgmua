'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import NotificationPrompt from '../components/NotificationPrompt'

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
  rechazado: 'Comprobante rechazado, sube uno nuevo',
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

export default function MisCitas() {
  const router = useRouter()
  const [appointments, setAppointments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('todas')
  const [monthFilter, setMonthFilter] = useState('todas')

  const [reviewDrafts, setReviewDrafts] = useState<Record<string, { rating: number; comment: string }>>({})
  const [submittingReview, setSubmittingReview] = useState<string | null>(null)

  function setDraftRating(appointmentId: string, rating: number) {
    setReviewDrafts((prev) => ({ ...prev, [appointmentId]: { rating, comment: prev[appointmentId]?.comment ?? '' } }))
  }

  function setDraftComment(appointmentId: string, comment: string) {
    setReviewDrafts((prev) => ({ ...prev, [appointmentId]: { rating: prev[appointmentId]?.rating ?? 0, comment } }))
  }

  async function submitReview(appointmentId: string) {
    const draft = reviewDrafts[appointmentId]
    if (!draft || !draft.rating) {
      alert('Selecciona una calificación de estrellas')
      return
    }
    setSubmittingReview(appointmentId)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setSubmittingReview(null)
      return
    }
    const { error } = await supabase.from('reviews').insert({
      appointment_id: appointmentId,
      client_id: user.id,
      rating: draft.rating,
      comment: draft.comment || null,
    })
    if (error) {
      alert('Error al enviar tu calificación: ' + error.message)
      setSubmittingReview(null)
      return
    }
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, reviews: [{ rating: draft.rating, comment: draft.comment }] } : a))
    )
    setSubmittingReview(null)
  }

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('appointments')
        .select('*, services(name, price, duration_minutes), appointment_addons(addons(name, extra_price)), appointment_staff(staff(full_name, bio, photo_url)), promotions(name), salon_locations(name, address), service_zones(name), reviews(rating, comment)')
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

  async function uploadComprobante(appointmentId: string, file: File) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const ext = file.name.split('.').pop()
    const path = `${user.id}/${appointmentId}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('comprobantes').upload(path, file)
    if (uploadError) {
      alert('Error al subir: ' + uploadError.message)
      return
    }

    await supabase
      .from('appointments')
      .update({ payment_proof_path: path, payment_status: 'comprobante_subido' })
      .eq('id', appointmentId)

    setAppointments((prev) =>
      prev.map((a) =>
        a.id === appointmentId ? { ...a, payment_proof_path: path, payment_status: 'comprobante_subido' } : a
      )
    )
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

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Mis citas</h1>
        <div className="mt-1">
        <Link href="/noticias" className="text-sm text-pink-600 underline mr-4">Ver noticias y promociones</Link>
        <Link href="/opiniones" className="text-sm text-pink-600 underline">Ver opiniones de clientas</Link>
        </div>
        <NotificationPrompt />

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
          {appointments.length === 0 && <p className="text-gray-500">Todavía no tienes citas agendadas.</p>}
          {appointments.length > 0 && filtered.length === 0 && (
            <p className="text-gray-500">No hay citas que coincidan con los filtros seleccionados.</p>
          )}

          {filtered.map((a) => (
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

              {a.appointment_staff?.length > 0 && (
                <div className="mt-2 space-y-2">
                  {a.appointment_staff.map((as: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                      {as.staff?.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={as.staff.photo_url} alt={as.staff.full_name} className="w-9 h-9 rounded-full object-cover" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gray-200" />
                      )}
                      <div>
                        <p className="text-xs font-medium text-gray-700">Te atenderá: {as.staff?.full_name}</p>
                        {as.staff?.bio && <p className="text-xs text-gray-500">{as.staff.bio}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
                  {(a.payment_status === 'pendiente' || a.payment_status === 'rechazado') && (
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      className="mt-2 text-xs"
                      onChange={(e) => {
                        const file = e.target.files?.[0]
                        if (file) uploadComprobante(a.id, file)
                      }}
                    />
                  )}
                </div>
              )}

              {(() => {
                const review = Array.isArray(a.reviews) ? a.reviews[0] : a.reviews
                if (a.status === 'completada' && !review) {
                  return (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-sm font-medium text-gray-700 mb-1">¿Cómo estuvo tu servicio?</p>
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setDraftRating(a.id, star)}
                            className={`text-xl ${(reviewDrafts[a.id]?.rating ?? 0) >= star ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                      <textarea
                        placeholder="Cuéntanos tu experiencia (opcional)"
                        value={reviewDrafts[a.id]?.comment ?? ''}
                        onChange={(e) => setDraftComment(a.id, e.target.value)}
                        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm mt-2"
                      />
                      <button
                        onClick={() => submitReview(a.id)}
                        disabled={submittingReview === a.id}
                        className="mt-2 rounded-lg bg-gray-900 px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
                      >
                        {submittingReview === a.id ? 'Enviando...' : 'Enviar calificación'}
                      </button>
                    </div>
                  )
                }
                if (review) {
                  return (
                    <div className="mt-3 border-t pt-3">
                      <p className="text-sm font-medium text-gray-700">Tu calificación</p>
                      <p className="text-yellow-400 text-lg">
                        {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                      </p>
                      {review.comment && <p className="text-xs text-gray-500 mt-1">{review.comment}</p>}
                    </div>
                  )
                }
                return null
              })()}

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