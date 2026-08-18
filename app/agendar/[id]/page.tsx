'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Agendar() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [service, setService] = useState<any>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }
      const { data } = await supabase.from('services').select('*').eq('id', id).single()
      setService(data)
      setChecking(false)
    }
    init()
  }, [id, router])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    const { error } = await supabase.from('appointments').insert({
      client_id: user.id,
      service_id: id,
      scheduled_at: new Date(scheduledAt).toISOString(),
      notes,
    })

    setLoading(false)

    if (error) {
      setError(error.message)
      return
    }

    router.push('/')
  }

  if (checking) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-white p-6 rounded-xl shadow-sm ring-1 ring-gray-200 space-y-4">
        <h1 className="text-xl font-semibold text-gray-900">Agendar: {service?.name}</h1>
        <p className="text-sm text-gray-500">
          ${Number(service?.price).toLocaleString('es-MX')} · {service?.duration_minutes} min
        </p>

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