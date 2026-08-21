'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminZonas() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [zones, setZones] = useState<any[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadZones() {
    const { data } = await supabase.from('service_zones').select('*').order('created_at', { ascending: true })
    setZones(data ?? [])
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
      await loadZones()
      setLoading(false)
    }
    init()
  }, [router])

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!name || !price) {
      alert('Completa nombre y tarifa')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('service_zones').insert({ name, price: Number(price) })
    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }
    setName('')
    setPrice('')
    setSaving(false)
    await loadZones()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('service_zones').update({ active: !active }).eq('id', id)
    setZones((prev) => prev.map((z) => (z.id === id ? { ...z, active: !active } : z)))
  }

  async function eliminar(id: string) {
    await supabase.from('service_zones').delete().eq('id', id)
    setZones((prev) => prev.filter((z) => z.id !== id))
  }

  if (loading || !authorized) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Zonas de domicilio</h1>
          <Link href="/admin" className="text-sm text-gray-500 underline">Volver al panel</Link>
        </div>

        <form onSubmit={crear} className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-3">
          <input
            type="text"
            placeholder="Nombre de la zona (ej. Centro, Lomas, Zona industrial)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <input
            type="number"
            min="0"
            step="0.01"
            placeholder="Costo de traslado a esta zona"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Agregar zona'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {zones.length === 0 && <p className="text-gray-500">No hay zonas registradas.</p>}
          {zones.map((z) => (
            <div key={z.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">{z.name}</h2>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${z.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {z.active ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">+${Number(z.price).toLocaleString('es-MX')}</p>
              <div className="mt-3 flex gap-3">
                <button onClick={() => toggleActive(z.id, z.active)} className="text-xs font-medium text-blue-700">
                  {z.active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => eliminar(z.id)} className="text-xs font-medium text-red-600">
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