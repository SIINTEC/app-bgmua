'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

function todayStr() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

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
  const [promotion, setPromotion] = useState<any>(null)
  const [salons, setSalons] = useState<any[]>([])
  const [zones, setZones] = useState<any[]>([])
  const [siteType, setSiteType] = useState('')
  const [salonLocationId, setSalonLocationId] = useState('')
  const [zoneId, setZoneId] = useState('')
  const [homeAddress, setHomeAddress] = useState('')
  const [quantity, setQuantity] = useState(1)

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

      const { data: salonsData } = await supabase.from('salon_locations').select('*').eq('active', true)
      const { data: zonesData } = await supabase.from('service_zones').select('*').eq('active', true)
      setSalons(salonsData ?? [])
      setZones(zonesData ?? [])

      const { data: promoLinks } = await supabase
        .from('promotion_services')
        .select('promotions(*)')
        .eq('service_id', id)

      const today = todayStr()
      const applicable = (promoLinks ?? [])
        .map((pl: any) => pl.promotions)
        .filter((p: any) => p && p.active && p.start_date <= today && p.end_date >= today)

      if (applicable.length > 0) {
        const best = applicable.reduce((a: any, b: any) => {
          const discountA =
            a.discount_type === 'porcentaje'
              ? Number(serviceData?.price ?? 0) * (Number(a.discount_value) / 100)
              : Number(a.discount_value)
          const discountB =
            b.discount_type === 'porcentaje'
              ? Number(serviceData?.price ?? 0) * (Number(b.discount_value) / 100)
              : Number(b.discount_value)
          return discountB > discountA ? b : a
        })
        setPromotion(best)
      }
    }
    init()
  }, [id, router])

  function toggleAddon(addonId: string) {
    setSelectedAddons((prev) =>
      prev.includes(addonId) ? prev.filter((a) => a !== addonId) : [...prev, addonId]
    )
  }

  const extrasTotal = addons
    .filter((a) => selectedAddons.includes(a.id))
    .reduce((sum, a) => sum + Number(a.extra_price), 0)

  const servicePriceUnit = Number(service?.price ?? 0)
  const servicePriceTotal = servicePriceUnit * quantity

  const discountAmount = promotion
    ? Math.min(
        promotion.discount_type === 'porcentaje'
          ? servicePriceTotal * (Number(promotion.discount_value) / 100)
          : Number(promotion.discount_value),
        servicePriceTotal
      )
    : 0

  const selectedZone = zones.find((z) => z.id === zoneId)
  const siteCost = siteType === 'domicilio' && selectedZone ? Number(selectedZone.price) : 0

  const subtotal = servicePriceTotal + extrasTotal + siteCost
  const total = subtotal - discountAmount
  const depositAmount = Number(service?.deposit_amount ?? 0) * quantity

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()

    if (quantity < 1) {
      setError('La cantidad de personas debe ser al menos 1')
      return
    }
    if (!siteType) {
      setError('Selecciona si la cita será en el estudio o a domicilio')
      return
    }
    if (siteType === 'estudio' && !salonLocationId) {
      setError('Selecciona en cuál de nuestros salones te atenderemos')
      return
    }
    if (siteType === 'domicilio' && (!zoneId || !homeAddress.trim())) {
      setError('Selecciona tu zona y escribe la dirección para el domicilio')
      return
    }
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

    const durationMinutesTotal = Number(service?.duration_minutes ?? 60) * quantity
    const scheduledDate = new Date(scheduledAt)
    const busyUntil = new Date(scheduledDate.getTime() + (durationMinutesTotal + 60) * 60000)

    const { data: appointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        client_id: user.id,
        service_id: id,
        scheduled_at: scheduledDate.toISOString(),
        busy_until: busyUntil.toISOString(),
        quantity,
        notes,
        terms_accepted: true,
        terms_accepted_at: new Date().toISOString(),
        deposit_amount: depositAmount,
        payment_status: 'pendiente',
        promotion_id: promotion?.id ?? null,
        discount_amount: discountAmount,
        site_type: siteType,
        salon_location_id: siteType === 'estudio' ? salonLocationId : null,
        zone_id: siteType === 'domicilio' ? zoneId : null,
        home_address: siteType === 'domicilio' ? homeAddress : null,
        site_cost: siteCost,
      })
      .select()
      .single()

    if (insertError || !appointment) {
      setLoading(false)
      if (insertError?.code === '23P01') {
        setError('Ese horario ya no está disponible (muy cerca de otra cita). Por favor elige otro horario.')
      } else {
        setError(insertError?.message ?? 'No se pudo crear la cita')
      }
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

        {promotion && (
          <div className="rounded-lg bg-pink-50 border border-pink-200 px-3 py-2 text-xs text-pink-700">
            🎉 Promoción aplicada: <strong>{promotion.name}</strong> (
            {promotion.discount_type === 'porcentaje'
              ? `${promotion.discount_value}% de descuento`
              : `-$${Number(promotion.discount_value).toLocaleString('es-MX')}`}
            )
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cantidad de personas</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          {quantity > 1 && (
            <p className="text-xs text-gray-400 mt-1">
              El precio y la duración se multiplican automáticamente por {quantity}.
            </p>
          )}
        </div>

        <div className="space-y-2 border-t pt-3">
          <p className="text-sm font-medium text-gray-700">¿Dónde te atenderemos?</p>
          <div className="flex gap-4 text-sm text-gray-700">
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="site"
                checked={siteType === 'estudio'}
                onChange={() => setSiteType('estudio')}
              />
              Estudio / salón
            </label>
            <label className="flex items-center gap-1">
              <input
                type="radio"
                name="site"
                checked={siteType === 'domicilio'}
                onChange={() => setSiteType('domicilio')}
              />
              A domicilio
            </label>
          </div>

          {siteType === 'estudio' && (
            <div className="space-y-2">
              {salons.length === 0 && <p className="text-xs text-gray-400">No hay salones disponibles por ahora.</p>}
              {salons.map((s) => (
                <label key={s.id} className="flex items-start gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg p-2">
                  <input
                    type="radio"
                    name="salon"
                    checked={salonLocationId === s.id}
                    onChange={() => setSalonLocationId(s.id)}
                    className="mt-1"
                  />
                  <span>
                    <span className="block font-medium text-gray-700">{s.name}</span>
                    <span className="block text-xs text-gray-500">{s.address}</span>
                  </span>
                </label>
              ))}
            </div>
          )}

          {siteType === 'domicilio' && (
            <div className="space-y-2">
              <select
                value={zoneId}
                onChange={(e) => setZoneId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Selecciona tu zona</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} (+${Number(z.price).toLocaleString('es-MX')})
                  </option>
                ))}
              </select>
              <textarea
                placeholder="Dirección completa para el domicilio"
                value={homeAddress}
                onChange={(e) => setHomeAddress(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          )}
        </div>

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

        {depositAmount > 0 && (
          <div className="border-t pt-3">
            <p className="text-sm font-medium text-gray-700 mb-1">
              Anticipo requerido: ${depositAmount.toLocaleString('es-MX')}
            </p>
            <div className="text-xs text-gray-500 bg-gray-50 rounded-lg p-2 whitespace-pre-line">
              {paymentInstructions}
            </div>
            <p className="text-xs text-amber-600 mt-1 font-medium">
              Tienes 72 horas para subir tu comprobante o la cita se cancelará automáticamente.
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Podrás subir tu comprobante desde &quot;Mis citas&quot; después de agendar.
            </p>
          </div>
        )}

        <div className="border-t pt-3 space-y-1">
          {(siteCost > 0 || discountAmount > 0 || quantity > 1) && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Subtotal</span>
              <span>${(servicePriceTotal + extrasTotal).toLocaleString('es-MX')}</span>
            </div>
          )}
          {siteCost > 0 && (
            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Costo de domicilio</span>
              <span>+${siteCost.toLocaleString('es-MX')}</span>
            </div>
          )}
          {discountAmount > 0 && (
            <div className="flex items-center justify-between text-sm text-pink-600">
              <span>Descuento</span>
              <span>-${discountAmount.toLocaleString('es-MX')}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">Total</span>
            <span className="font-semibold text-gray-900">${total.toLocaleString('es-MX')}</span>
          </div>
        </div>

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