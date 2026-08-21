'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminOpiniones() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [reviews, setReviews] = useState<any[]>([])

  async function loadReviews() {
    const { data } = await supabase
      .from('reviews')
      .select('*, profiles(full_name), appointments(services(name))')
      .order('created_at', { ascending: false })
    setReviews(data ?? [])
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
      await loadReviews()
      setLoading(false)
    }
    init()
  }, [router])

  async function togglePublished(id: string, published: boolean) {
    await supabase.from('reviews').update({ published: !published }).eq('id', id)
    setReviews((prev) => prev.map((r) => (r.id === id ? { ...r, published: !published } : r)))
  }

  async function eliminar(id: string) {
    await supabase.from('reviews').delete().eq('id', id)
    setReviews((prev) => prev.filter((r) => r.id !== id))
  }

  if (loading || !authorized) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Opiniones de clientas</h1>
          <Link href="/admin" className="text-sm text-gray-500 underline">Volver al panel</Link>
        </div>

        <div className="mt-6 space-y-3">
          {reviews.length === 0 && <p className="text-gray-500">Todavía no hay calificaciones.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-gray-900">{r.profiles?.full_name}</h2>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${r.published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {r.published ? 'Publicada' : 'Sin publicar'}
                </span>
              </div>
              <p className="text-yellow-400 text-lg">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
              {r.appointments?.services?.name && (
                <p className="text-xs text-gray-400">{r.appointments.services.name}</p>
              )}
              {r.comment && <p className="text-sm text-gray-600 mt-1">{r.comment}</p>}
              <p className="text-xs text-gray-400 mt-1">
                {new Date(r.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
              </p>
              <div className="mt-3 flex gap-3">
                <button onClick={() => togglePublished(r.id, r.published)} className="text-xs font-medium text-blue-700">
                  {r.published ? 'Ocultar de Opiniones' : 'Publicar en Opiniones'}
                </button>
                <button onClick={() => eliminar(r.id)} className="text-xs font-medium text-red-600">
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