'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const typeLabels: Record<string, string> = {
  porcentaje: 'Porcentaje',
  monto_fijo: 'Monto fijo',
}

export default function AdminPromociones() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [promotions, setPromotions] = useState<any[]>([])
  const [services, setServices] = useState<any[]>([])

  const [name, setName] = useState('')
  const [discountType, setDiscountType] = useState('porcentaje')
  const [discountValue, setDiscountValue] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  async function loadPromotions() {
    const { data } = await supabase
      .from('promotions')
      .select('*, promotion_services(service_id, services(name))')
      .order('start_date', { ascending: false })
    setPromotions(data ?? [])
  }

  async function loadServices() {
    const { data } = await supabase.from('services').select('id, name').order('name')
    setServices(data ?? [])
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
      await Promise.all([loadPromotions(), loadServices()])
      setLoading(false)
    }
    init()
  }, [router])

  function toggleService(id: string) {
    setSelectedServiceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    )
  }

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!name || !discountValue || !startDate || !endDate || selectedServiceIds.length === 0) {
      alert('Completa todos los campos y selecciona al menos un servicio')
      return
    }
    if (endDate < startDate) {
      alert('La fecha "hasta" no puede ser anterior a la fecha "desde". Revisa los años.')
      return
    }
    setSaving(true)

    const { data: promo, error: promoError } = await supabase
      .from('promotions')
      .insert({
        name,
        discount_type: discountType,
        discount_value: Number(discountValue),
        start_date: startDate,
        end_date: endDate,
      })
      .select()
      .single()

    if (promoError || !promo) {
      alert('Error al crear promoción: ' + promoError?.message)
      setSaving(false)
      return
    }

    const rows = selectedServiceIds.map((serviceId) => ({ promotion_id: promo.id, service_id: serviceId }))
    const { error: linkError } = await supabase.from('promotion_services').insert(rows)
    if (linkError) {
      alert('Error al asociar servicios: ' + linkError.message)
    }

    setName('')
    setDiscountType('porcentaje')
    setDiscountValue('')
    setStartDate('')
    setEndDate('')
    setSelectedServiceIds([])
    setSaving(false)
    await loadPromotions()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('promotions').update({ active: !active }).eq('id', id)
    setPromotions((prev) => prev.map((p) => (p.id === id ? { ...p, active: !active } : p)))
  }

  async function eliminar(id: string) {
    await supabase.from('promotions').delete().eq('id', id)
    setPromotions((prev) => prev.filter((p) => p.id !== id))
  }

  if (loading || !authorized) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Promociones</h1>
          <Link href="/admin" className="text-sm text-gray-500 underline">Volver al panel</Link>
        </div>

        <form onSubmit={crear} className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-3">
          <input
            type="text"
            placeholder="Nombre de la promoción (ej. Promo de verano)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />

          <div className="flex gap-3">
            <select
              value={discountType}
              onChange={(e) => setDiscountType(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="porcentaje">Porcentaje (%)</option>
              <option value="monto_fijo">Monto fijo ($)</option>
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              placeholder={discountType === 'porcentaje' ? 'Ej. 15' : 'Ej. 100'}
              value={discountValue}
              onChange={(e) => setDiscountValue(e.target.value)}
              className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Desde</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">Hasta</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Aplica a los servicios:</p>
            <div className="flex flex-wrap gap-3">
              {services.map((s) => (
                <label key={s.id} className="flex items-center gap-1 text-xs text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedServiceIds.includes(s.id)}
                    onChange={() => toggleService(s.id)}
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Crear promoción'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {promotions.length === 0 && <p className="text-gray-500">No hay promociones creadas.</p>}

          {promotions.map((p) => (
            <div key={p.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">{p.name}</h2>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {typeLabels[p.discount_type]}:{' '}
                {p.discount_type === 'porcentaje'
                  ? `${p.discount_value}%`
                  : `$${Number(p.discount_value).toLocaleString('es-MX')}`}
              </p>
              <p className="text-sm text-gray-500">Vigencia: {p.start_date} a {p.end_date}</p>
              <p className="text-xs text-gray-400 mt-1">
                Servicios: {p.promotion_services?.map((ps: any) => ps.services?.name).join(', ')}
              </p>
              <div className="mt-3 flex gap-3">
                <button onClick={() => toggleActive(p.id, p.active)} className="text-xs font-medium text-blue-700">
                  {p.active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => eliminar(p.id)} className="text-xs font-medium text-red-600">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}