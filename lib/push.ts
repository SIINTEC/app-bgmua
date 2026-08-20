import webpush from 'web-push'
import { supabaseAdmin } from './supabaseAdmin'

webpush.setVapidDetails(
  'mailto:contacto@tudominio.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  const { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  console.log('DEBUG suscripciones encontradas:', subs?.length, 'error:', error)

  if (!subs || subs.length === 0) return

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
      console.log('DEBUG notificación enviada a:', sub.endpoint)
    } catch (err: any) {
      console.log('DEBUG error al enviar:', err.statusCode, err.body || err.message)
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}