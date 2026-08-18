'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Agendar() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [service, setService] = useState<any>(null)
  const [addons, setAddons] = useState<any[]>([])
  const [selectedAddons, setSelectedAddons] = useState<string[]>([])
  const [terms, setTerms] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [paymentInstructions, setPaymentInstructions] = useState('')

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data: serviceData } = await supabase.from('services').select('*').eq('id', id).single()
      const { data: addonsData } = await supabase.from('addons').select('*').eq('active', true)
      const { data: termsData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'terms_and_conditions')
        .single()
      setService(serviceData)
      setAddons(addonsData ?? [])
      setTerms(termsData?.value ?? '')
      setChecking(false)
      const { data: paymentData } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'payment_instructions')
        .single()
      setPaymentInstructions(paymentData?.value ?? '')
    }
    init()
  }, [id, router])

  function toggleAddon(addonId: string) {
    setSelectedAddons((prev) =>
      prev.includes(addonId) ? prev.filter((a) => a !== addonId) : [...prev, addonId]
    )
  }

  const total =
    Number(service?.price ?? 0) +
    addons.filter((a) => selectedAddons.includes(a.id)).reduce((sum, a) => sum + Number(a.extra_price), 0)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (!acceptedTerms) {
      setError('Debes aceptar los términos y condiciones para continuar')
      return
    }

    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        client_id: user.id,
        service_id: id,
        scheduled_at: new Date(scheduledAt).toISOString(),
        notes,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        deposit_amount: service?.deposit_amount ?? 0,
        payment_status: 'pendiente',
      })
      .select()
      .single()

    if (insertError || !appointment) {
      setLoading(false)
      setError(insertError?.message ?? 'No se pudo crear la cita')
      return
    }

    if (selectedAddons.length > 0) {
      const rows = selectedAddons.map((addon_id) => ({ appointment_id: appointment.id, addon_id }))
      const { error: addonsError } = await supabase.from('appointment_addons').insert(rows)
      if (addonsError) {
        setLoading(false)
        setError(addonsError.message)
        return
      }
    }

    setLoading(false)
    router.push('/mis-citas')
  }

  if (checking) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-200 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Agendar: {service?.name}</h1>
        <p className="text-sm text-gray-500">
          ${Number(service?.price).toLocaleString('es-MX')} · {service?.duration_minutes} min
        </p>

        {addons.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-700">Extras (opcional)</p>
            {addons.map((a) => (
              <label key={a.id} className="flex items-center justify-between text-sm text-gray-600">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedAddons.includes(a.id)} onChange={() => toggleAddon(a.id)} />
                  {a.name}
                </span>
                <span>+${Number(a.extra_price).toLocaleString('es-MX')}</span>
              </label>
            ))}
          </div>
        )}

        <input
          type="datetime-local"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          placeholder="Notas (opcional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        <div className="flex items-center justify-between border-t pt-3">
          <span className="text-sm font-medium text-gray-700">Total</span>
          <span className="font-semibold text-gray-900">${total.toLocaleString('es-MX')}</span>
        </div>
        {service?.deposit_amount > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-700 mb-1">
              Anticipo requerido: ${Number(service.deposit_amount).toLocaleString('es-MX')}
            </p>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 whitespace-pre-line">
              {paymentInstructions}
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Podrás subir tu comprobante desde &quot;Mis citas&quot; después de agendar.
            </p>
          </div>
        )} 
        {terms && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Términos y condiciones</p>
            <div className="h-28 overflow-y-auto text-xs text-gray-500 bg-gray-50 rounded-lg p-2 whitespace-pre-line">
              {terms}
            </div>
            <label className="flex items-center gap-2 mt-2 text-sm text-gray-700">
              <input type="checkbox" checked={acceptedTerms} onChange={(e) => setAcceptedTerms(e.target.checked)} />
              He leído y acepto los términos y condiciones
            </label>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-gray-900 text-white py-2 text-sm font-medium disabled:opacity-50"
        >
          {loading ? 'Guardando...' : 'Confirmar cita'}
        </button>
      </form>
    </main>
  )
}