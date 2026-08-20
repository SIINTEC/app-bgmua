'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export default function NotificationPrompt() {
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) return
    if (Notification.permission === 'default') {
      setVisible(true)
    }
  }, [])

  async function handleActivate() {
    setLoading(true)

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      setLoading(false)
      setVisible(false)
      return
    }

    const registration = await navigator.serviceWorker.ready
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    })

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const json = subscription.toJSON()
      await supabase.from('push_subscriptions').upsert(
        {
          user_id: user.id,
          endpoint: json.endpoint!,
          p256dh: json.keys!.p256dh,
          auth: json.keys!.auth,
        },
        { onConflict: 'endpoint' }
      )
    }

    setLoading(false)
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div className="bg-white rounded-xl shadow-sm ring-1 ring-gray-200 p-3 mb-4 flex items-center justify-between">
      <p className="text-sm text-gray-700">Activa las notificaciones para no perderte avisos de tus citas</p>
      <button
        onClick={handleActivate}
        disabled={loading}
        className="text-xs font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-50"
      >
        {loading ? 'Activando...' : 'Activar'}
      </button>
    </div>
  )
}