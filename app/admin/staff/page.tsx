'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminStaff() {
  const router = useRouter()
  const [staff, setStaff] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const [newName, setNewName] = useState('')
  const [newBio, setNewBio] = useState('')
  const [newPhoto, setNewPhoto] = useState<File | null>(null)
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
    const { data } = await supabase.from('staff').select('*').order('created_at', { ascending: true })
    setStaff(data ?? [])
  }

  function updateLocal(id: string, field: string, value: any) {
    setStaff((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  async function saveStaff(s: any) {
    setSaving(s.id)
    await supabase.from('staff').update({ full_name: s.full_name, bio: s.bio, active: s.active }).eq('id', s.id)
    setSaving(null)
  }

  async function handlePhotoChange(staffId: string, file: File) {
    const ext = file.name.split('.').pop()
    const path = `${staffId}-${Date.now()}.${ext}`

    const { error: uploadError } = await supabase.storage.from('staff-photos').upload(path, file)
    if (uploadError) {
      alert('Error al subir la foto: ' + uploadError.message)
      return
    }

    const { data: publicUrlData } = supabase.storage.from('staff-photos').getPublicUrl(path)

    await supabase.from('staff').update({ photo_url: publicUrlData.publicUrl }).eq('id', staffId)

    setStaff((prev) => prev.map((s) => (s.id === staffId ? { ...s, photo_url: publicUrlData.publicUrl } : s)))
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault()
    setError('')

    if (!newName) {
      setError('El nombre es obligatorio')
      return
    }

    setCreating(true)

    let photo_url: string | null = null
    if (newPhoto) {
      const ext = newPhoto.name.split('.').pop()
      const path = `${Date.now()}.${ext}`
      const { error: uploadError } = await supabase.storage.from('staff-photos').upload(path, newPhoto)
      if (uploadError) {
        setCreating(false)
        setError(uploadError.message)
        return
      }
      const { data: publicUrlData } = supabase.storage.from('staff-photos').getPublicUrl(path)
      photo_url = publicUrlData.publicUrl
    }

    const { error: insertError } = await supabase.from('staff').insert({
      full_name: newName,
      bio: newBio || null,
      photo_url,
    })

    setCreating(false)

    if (insertError) {
      setError(insertError.message)
      return
    }

    setNewName('')
    setNewBio('')
    setNewPhoto(null)
    load()
  }

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Equipo</h1>
        <p className="mt-1 text-sm text-gray-500">Maquillistas y peinadoras que atienden a las clientas</p>

        <div className="mt-6 space-y-3">
          {staff.map((s) => (
            <div key={s.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-2">
              <div className="flex items-center gap-3">
                {s.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.photo_url} alt={s.full_name} className="w-12 h-12 rounded-full object-cover" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gray-200" />
                )}
                <input
                  className="flex-1 font-medium text-gray-900 border-b border-transparent focus:border-gray-300 outline-none"
                  value={s.full_name}
                  onChange={(e) => updateLocal(s.id, 'full_name', e.target.value)}
                />
              </div>

              <label className="block text-xs text-gray-500">
                Cambiar foto:
                <input
                  type="file"
                  accept="image/*"
                  className="block mt-1 text-xs"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handlePhotoChange(s.id, file)
                  }}
                />
              </label>

              <textarea
                className="w-full text-sm text-gray-500 border rounded-lg px-2 py-1"
                value={s.bio ?? ''}
                onChange={(e) => updateLocal(s.id, 'bio', e.target.value)}
                placeholder="Biografía corta"
              />
              <label className="flex items-center gap-1 text-sm">
                <input type="checkbox" checked={s.active} onChange={(e) => updateLocal(s.id, 'active', e.target.checked)} />
                Activo
              </label>
              <button
                onClick={() => saveStaff(s)}
                disabled={saving === s.id}
                className="text-xs font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
              >
                {saving === s.id ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate} className="mt-8 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-2">
          <h2 className="font-medium text-gray-900">Agregar integrante</h2>
          <input className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Nombre completo" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <textarea className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" placeholder="Biografía corta (opcional)" value={newBio} onChange={(e) => setNewBio(e.target.value)} />
          <input type="file" accept="image/*" onChange={(e) => setNewPhoto(e.target.files?.[0] ?? null)} className="text-sm" />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={creating} className="rounded-lg bg-gray-900 text-white px-4 py-2 text-sm font-medium disabled:opacity-50">
            {creating ? 'Guardando...' : 'Agregar'}
          </button>
        </form>
      </div>
    </main>
  )
}