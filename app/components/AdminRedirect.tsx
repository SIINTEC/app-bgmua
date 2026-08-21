'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AdminRedirect() {
  const router = useRouter()

  useEffect(() => {
    async function checkAndRedirect(userId: string) {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error al verificar rol de admin:', error)
        return
      }

      if (profile?.role === 'admin') {
        router.replace('/admin')
      }
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) checkAndRedirect(user.id)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) checkAndRedirect(session.user.id)
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  return null
}