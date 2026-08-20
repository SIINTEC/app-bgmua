import webpush from 'web-push'
import { supabaseAdmin } from './supabaseAdmin'

webpush.setVapidDetails(
  'mailto:contacto@tudominio.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

async function sendToSubscriptions(subs: any[], payload: { title: string; body: string; url?: string }) {
  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
      }
    }
  }
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)

  if (!subs || subs.length === 0) return
  await sendToSubscriptions(subs, payload)
}

export async function sendPushToAll(payload: { title: string; body: string; url?: string }) {
  const { data: subs } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')

  if (!subs || subs.length === 0) return
  await sendToSubscriptions(subs, payload)
}