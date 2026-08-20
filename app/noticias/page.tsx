'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Noticias() {
  const router = useRouter()
  const [posts, setPosts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/login')
        return
      }

      const { data } = await supabase
        .from('news_posts')
        .select('*')
        .order('created_at', { ascending: false })

      setPosts(data ?? [])
      setLoading(false)

      for (const post of data ?? []) {
        const { error: viewError } = await supabase
          .from('news_post_views')
          .upsert({ post_id: post.id, user_id: user.id }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
        if (viewError) console.log('DEBUG error al registrar vista:', viewError)
      }
    }
    load()
  }, [router])

  if (loading) {
    return <main className="min-h-screen flex items-center justify-center text-gray-500">Cargando...</main>
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">Noticias y promociones</h1>

        <div className="mt-6 space-y-4">
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
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  )
}