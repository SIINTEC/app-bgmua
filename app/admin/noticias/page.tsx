'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function AdminNoticias() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null)
  const [viewers, setViewers] = useState<any[]>([])

  async function loadPosts() {
    const { data } = await supabase
      .from('news_posts')
      .select('*, news_post_views(count)')
      .order('created_at', { ascending: false })
    setPosts(data ?? [])
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
      await loadPosts()
      setLoading(false)
    }
    init()
  }, [router])

  async function publicar(e: FormEvent) {
    e.preventDefault()
    if (!imageFile || !title) {
      alert('Falta título o imagen')
      return
    }
    setUploading(true)

    const { data: { user } } = await supabase.auth.getUser()
    const ext = imageFile.name.split('.').pop()
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { error: uploadError } = await supabase.storage.from('noticias').upload(path, imageFile)
    if (uploadError) {
      alert('Error al subir imagen: ' + uploadError.message)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('noticias').getPublicUrl(path)

    const { error: insertError } = await supabase.from('news_posts').insert({
      title,
      description,
      image_url: urlData.publicUrl,
      created_by: user?.id,
    })

    if (insertError) {
      alert('Error al publicar: ' + insertError.message)
      setUploading(false)
      return
    }

    const { data: { session } } = await supabase.auth.getSession()
    if (session) {
      fetch('/api/publicar-noticia', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ title }),
      }).catch(() => {})
    }

    setTitle('')
    setDescription('')
    setImageFile(null)
    setUploading(false)
    await loadPosts()
  }

  async function eliminar(id: string) {
    await supabase.from('news_posts').delete().eq('id', id)
    setPosts((prev) => prev.filter((p) => p.id !== id))
  }

  async function verVisualizaciones(postId: string) {
    if (expandedPostId === postId) {
      setExpandedPostId(null)
      return
    }
    const { data } = await supabase
      .from('news_post_views')
      .select('viewed_at, profiles(full_name)')
      .eq('post_id', postId)
      .order('viewed_at', { ascending: false })
    setViewers(data ?? [])
    setExpandedPostId(postId)
  }

  if (loading || !authorized) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Noticias y promociones</h1>
          <Link href="/admin" className="text-sm text-gray-500 underline">Volver al panel</Link>
        </div>

        <form onSubmit={publicar} className="mt-6 rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-200 space-y-3">
          <input
            type="text"
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
          <textarea
            placeholder="Descripción breve (opcional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            rows={3}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
            className="text-sm"
          />
          <button
            type="submit"
            disabled={uploading}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {uploading ? 'Publicando...' : 'Publicar'}
          </button>
        </form>

        <div className="mt-6 space-y-3">
          {posts.length === 0 && <p className="text-gray-500">Todavía no hay publicaciones.</p>}

          {posts.map((post) => (
            <div key={post.id} className="rounded-xl bg-white shadow-sm ring-1 ring-gray-200 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={post.image_url} alt={post.title} className="w-full object-cover" />
              <div className="p-4">
                <h2 className="font-medium text-gray-900">{post.title}</h2>
                {post.description && <p className="text-sm text-gray-600 mt-1">{post.description}</p>}
                <p className="text-xs text-gray-400 mt-2">
                  {new Date(post.created_at).toLocaleDateString('es-MX', { dateStyle: 'medium' })}
                </p>

                <div className="mt-3 flex items-center gap-4">
                  <button
                    onClick={() => verVisualizaciones(post.id)}
                    className="text-xs font-medium text-blue-700 underline"
                  >
                    {post.news_post_views?.[0]?.count ?? 0} vistas — ver detalle
                  </button>
                  <button onClick={() => eliminar(post.id)} className="text-xs font-medium text-red-600">
                    Eliminar
                  </button>
                </div>

                {expandedPostId === post.id && (
                  <ul className="mt-2 text-xs text-gray-500 list-disc list-inside">
                    {viewers.length === 0 && <li>Nadie la ha visto todavía</li>}
                    {viewers.map((v: any, i: number) => (
                      <li key={i}>
                        {v.profiles?.full_name} —{' '}
                        {new Date(v.viewed_at).toLocaleString('es-MX', { dateStyle: 'medium', timeStyle: 'short' })}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}