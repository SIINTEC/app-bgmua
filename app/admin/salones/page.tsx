'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminSalones() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [salons, setSalons] = useState<any[]>([])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [saving, setSaving] = useState(false)

  async function loadSalons() {
    const { data } = await supabase.from('salon_locations').select('*').order('created_at', { ascending: true })
    setSalons(data ?? [])
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
      await loadSalons()
      setLoading(false)
    }
    init()
  }, [router])

  async function crear(e: FormEvent) {
    e.preventDefault()
    if (!name || !address) {
      alert('Completa nombre y dirección')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('salon_locations').insert({ name, address })
    if (error) {
      alert('Error: ' + error.message)
      setSaving(false)
      return
    }
    setName('')
    setAddress('')
    setSaving(false)
    await loadSalons()
  }

  async function toggleActive(id: string, active: boolean) {
    await supabase.from('salon_locations').update({ active: !active }).eq('id', id)
    setSalons((prev) => prev.map((s) => (s.id === id ? { ...s, active: !active } : s)))
  }

  async function eliminar(id: string) {
    await supabase.from('salon_locations').delete().eq('id', id)
    setSalons((prev) => prev.filter((s) => s.id !== id))
  }

  if (loading || !authorized) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Salones</h1>
          <Link href="/admin" className="text-sm text-gray-500 underline">Volver al panel</Link>
        </div>

        <form onSubmit={crear} className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-3">
          <input
            type="text"
            placeholder="Nombre del salón (ej. Sucursal Centro)"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Dirección completa"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? 'Guardando...' : 'Agregar salón'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {salons.length === 0 && <p className="text-gray-500">No hay salones registrados.</p>}
          {salons.map((s) => (
            <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">{s.name}</h2>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${s.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {s.active ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{s.address}</p>
              <div className="mt-3 flex gap-3">
                <button onClick={() => toggleActive(s.id, s.active)} className="text-xs font-medium text-blue-700">
                  {s.active ? 'Desactivar' : 'Activar'}
                </button>
                <button onClick={() => eliminar(s.id)} className="text-xs font-medium text-red-600">
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