'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminServicios() {
  const router = useRouter()
  const [services, setServices] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [newPrice, setNewPrice] = useState('')
  const [newDuration, setNewDuration] = useState('')
  const [newDeposit, setNewDeposit] = useState('')
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

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
      await load()
      setLoading(false)
    }
    init()
  }, [router])

  async function load() {
    const { data } = await supabase.from('services').select('*').order('price', { ascending: true })
    setServices(data ?? [])
  }

  function updateLocal(id: string, field: string, value: any) {
    setServices((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  async function saveService(s: any) {
    setSaving(s.id)
    await supabase
      .from('services')
      .update({
        name: s.name,
        description: s.description,
        price: s.price,
        duration_minutes: s.duration_minutes,
        deposit_amount: s.deposit_amount,
        active: s.active,
      })
      .eq('id', s.id)
    setSaving(null)
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!newName || !newPrice || !newDuration) {
      setError('Nombre, precio y duración son obligatorios')
      return
    }

    setCreating(true)
    const { error: insertError } = await supabase.from('services').insert({
      name: newName,
      description: newDescription || null,
      price: Number(newPrice),
      duration_minutes: Number(newDuration),
      deposit_amount: Number(newDeposit || 0),
    })
    setCreating(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setNewName('')
    setNewDescription('')
    setNewPrice('')
    setNewDuration('')
    setNewDeposit('')
    load()
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-gray-900">Servicios</h1>
        <p className="mt-1 text-sm text-gray-500">Edita precios, anticipos y da de alta nuevos servicios</p>

        <div className="mt-6 space-y-3">
          {services.map((s) => (
            <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-2">
              <input
                className="w-full font-medium text-gray-900 border-b border-transparent focus:border-gray-300 outline-none"
                value={s.name}
                onChange={(e) => updateLocal(s.id, 'name', e.target.value)}
              />
              <input
                className="w-full text-sm text-gray-500 border-b border-transparent focus:border-gray-300 outline-none"
                value={s.description ?? ''}
                onChange={(e) => updateLocal(s.id, 'description', e.target.value)}
                placeholder="Descripción"
              />
              <div className="flex flex-wrap gap-4 text-sm">
                <label className="flex items-center gap-1">
                  Precio $
                  <input type="number" className="w-20 border rounded px-1" value={s.price} onChange={(e) => updateLocal(s.id, 'price', e.target.value)} />
                </label>
                <label className="flex items-center gap-1">
                  Duración (min)
                  <input type="number" className="w-16 border rounded px-1" value={s.duration_minutes} onChange={(e) => updateLocal(s.id, 'duration_minutes', e.target.value)} />
                </label>
                <label className="flex items-center gap-1">
                  Anticipo $
                  <input type="number" className="w-20 border rounded px-1" value={s.deposit_amount} onChange={(e) => updateLocal(s.id, 'deposit_amount', e.target.value)} />
                </label>
                <label className="flex items-center gap-1">
                  <input type="checkbox" checked={s.active} onChange={(e) => updateLocal(s.id, 'active', e.target.checked)} />
                  Activo
                </label>
              </div>
              <button
                onClick={() => saveService(s)}
                disabled={saving === s.id}
                className="text-xs font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {saving === s.id ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate} className="mt-8 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-2">
          <h2 className="font-medium text-gray-900">Agregar nuevo servicio</h2>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Descripción (opcional)" value={newDescription} onChange={(e) => setNewDescription(e.target.value)} />
          <div className="flex gap-2">
            <input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Precio" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
            <input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Duración (min)" value={newDuration} onChange={(e) => setNewDuration(e.target.value)} />
            <input type="number" className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Anticipo" value={newDeposit} onChange={(e) => setNewDeposit(e.target.value)} />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            {creating ? 'Guardando...' : 'Agregar servicio'}
          </button>
        </form>
      </div>
    </main>
  )
}