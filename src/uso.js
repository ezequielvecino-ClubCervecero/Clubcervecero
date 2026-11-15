// Registro liviano de uso: avisa a la base que la app se abrió (como mucho una vez cada 30 minutos por dispositivo).
import { supabase } from './supabaseClient'

const CLAVE = 'uso_ultimo_registro'
const MINUTOS = 30

export function registrarUso() {
  try {
    const ultimo = Number(localStorage.getItem(CLAVE) || 0)
    if (Date.now() - ultimo < MINUTOS * 60000) return
    localStorage.setItem(CLAVE, String(Date.now()))
  } catch (e) { /* sin almacenamiento: se registra igual */ }
  supabase.rpc('registrar_uso').then(() => {}, () => {})
}
