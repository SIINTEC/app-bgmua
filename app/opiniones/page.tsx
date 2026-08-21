'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Opiniones() {
  const router = useRouter()
  const [reviews, setReviews] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase
        .from('reviews')
        .select('*, profiles(full_name)')
        .eq('published', true)
        .order('created_at', { ascending: false })
      setReviews(data ?? [])
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Opiniones de nuestras clientas</h1>

        <div className="mt-6 space-y-4">
          {reviews.length === 0 && <p className="text-gray-500">Todavía no hay opiniones publicadas.</p>}
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200">
              <p className="text-yellow-400 text-lg">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</p>
              {r.comment && <p className="text-sm text-gray-700 mt-1">{r.comment}</p>}
              <p className="text-xs text-gray-400 mt-2">
                {r.profiles?.full_name ?? 'Clienta'} ·{' '}
                {new Date(r.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
              </p>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}