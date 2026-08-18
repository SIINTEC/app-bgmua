'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function EditarTerminos() {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')

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

      const { data } = await supabase.from('app_settings').select('value').eq('key', 'terms_and_conditions').single()
      setContent(data?.value ?? '')
      setLoading(false)
    }
    init()
  }, [router])

  async function handleSave() {
    setSaving(true)
    setMessage('')
    const { error } = await supabase
      .from('app_settings')
      .update({ value: content, updated_at: new Date().toISOString() })
      .eq('key', 'terms_and_conditions')

    setSaving(false)
    setMessage(error ? `Error: ${error.message}` : 'Guardado correctamente')
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Editar términos y condiciones</h1>
        <p className="mt-1 text-sm text-gray-500">Este texto se muestra a las clientas antes de confirmar su cita.</p>

        <textarea
          className="mt-4 w-full h-64 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />

        {message && <p className="mt-2 text-sm text-gray-600">{message}</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="mt-4 rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </main>
  )
}