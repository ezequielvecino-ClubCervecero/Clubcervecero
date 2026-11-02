// Avisos push: registrar y quitar este celular o navegador.
import { supabase } from './supabaseClient'

const esIphone = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
const instalada = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true

function aBytes(base64url) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// 'no-soportado' | 'instalar' (iPhone sin instalar) | 'denegado' | 'activo' | 'inactivo'
export async function estadoPush() {
  if (esIphone() && !instalada()) return 'instalar'
  if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) return 'no-soportado'
  if (Notification.permission === 'denied') return 'denegado'
  try {
    const reg = await navigator.serviceWorker.getRegistration()
    const sub = reg ? await reg.pushManager.getSubscription() : null
    return sub && Notification.permission === 'granted' ? 'activo' : 'inactivo'
  } catch { return 'inactivo' }
}

export async function activarPush() {
  const permiso = await Notification.requestPermission()
  if (permiso !== 'granted') throw new Error('No diste permiso para mostrar avisos. Podés cambiarlo en los ajustes del navegador.')
  const { data, error } = await supabase.functions.invoke('push-clave')
  if (error || !data || !data.clave) throw new Error('Las notificaciones todavía no están configuradas.')
  const reg = (await navigator.serviceWorker.getRegistration()) || (await navigator.serviceWorker.register('/sw.js'))
  await navigator.serviceWorker.ready
  let sub = await reg.pushManager.getSubscription()
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(data.clave) })
  const j = sub.toJSON()
  const r = await supabase.rpc('guardar_suscripcion_push', { p_endpoint: j.endpoint, p_p256dh: j.keys.p256dh, p_auth: j.keys.auth })
  if (r.error) throw new Error(r.error.message)
}

export async function desactivarPush() {
  const reg = await navigator.serviceWorker.getRegistration()
  const sub = reg ? await reg.pushManager.getSubscription() : null
  if (sub) {
    await supabase.rpc('borrar_suscripcion_push', { p_endpoint: sub.endpoint })
    await sub.unsubscribe()
  }
}
