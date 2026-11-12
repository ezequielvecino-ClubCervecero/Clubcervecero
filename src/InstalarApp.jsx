// Instalación de la app en el celular: un cartel la primera vez y un recordatorio chico en el Inicio hasta que se instale.
// Android con Chrome: botón "Instalar" que abre el diálogo directo. iPhone: instrucciones de Safari.
// Si lo abrieron desde WhatsApp u otro navegador interno, les pide abrirlo en Chrome (Android) o Safari (iPhone).
import { useEffect, useState } from 'react'
import { Icon, Msg } from './ui'

const K_VISTO = 'instalar_cartel_visto'
const K_INSTALADA = 'app_instalada'
const leer = (k) => { try { return localStorage.getItem(k) === '1' } catch { return false } }
const guardar = (k) => { try { localStorage.setItem(k, '1') } catch { /* sin almacenamiento: no pasa nada */ } }
const avisar = () => window.dispatchEvent(new Event('instalar-cambio'))

// Chrome avisa cuando la app se puede instalar: guardamos el aviso para mostrarlo cuando el usuario toque "Instalar".
let promptDiferido = null
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); promptDiferido = e; avisar() })
  window.addEventListener('appinstalled', () => { promptDiferido = null; guardar(K_INSTALADA); avisar() })
}

const ua = () => (typeof navigator === 'undefined' ? '' : navigator.userAgent)
const abiertaComoApp = () => typeof window !== 'undefined' && (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true)
const navegadorInterno = () => /FBAN|FBAV|Instagram|WhatsApp|Line\/|MicroMessenger|Snapchat|TikTok|musical_ly|; wv\)|Twitter/i.test(ua())

// 'instalada' | 'pc' | 'android-prompt' | 'android-manual' | 'android-interno' | 'iphone-safari' | 'iphone-otro'
export function tipoInstalacion() {
  if (abiertaComoApp()) { guardar(K_INSTALADA); return 'instalada' }
  if (leer(K_INSTALADA)) return 'instalada'
  const u = ua()
  if (/iphone|ipad|ipod/i.test(u)) {
    const safari = /Safari/i.test(u) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(u) && !navegadorInterno()
    return safari ? 'iphone-safari' : 'iphone-otro'
  }
  if (/android/i.test(u)) {
    if (navegadorInterno()) return 'android-interno'
    return promptDiferido ? 'android-prompt' : 'android-manual'
  }
  return 'pc'
}

function useTipo() {
  const [tipo, setTipo] = useState(tipoInstalacion())
  useEffect(() => {
    const f = () => setTipo(tipoInstalacion())
    window.addEventListener('instalar-cambio', f)
    f()
    return () => window.removeEventListener('instalar-cambio', f)
  }, [])
  return tipo
}

// ¿Está pendiente el cartel grande? (los avisos esperan a que se resuelva)
export function useInstalarPendiente() {
  const tipo = useTipo()
  const [visto, setVisto] = useState(leer(K_VISTO))
  useEffect(() => {
    const f = () => setVisto(leer(K_VISTO))
    window.addEventListener('instalar-cambio', f)
    return () => window.removeEventListener('instalar-cambio', f)
  }, [])
  return tipo !== 'instalada' && tipo !== 'pc' && !visto
}

async function instalar(setMsg) {
  if (!promptDiferido) return false
  try {
    promptDiferido.prompt()
    const r = await promptDiferido.userChoice
    promptDiferido = null
    if (r && r.outcome === 'accepted') { guardar(K_INSTALADA); avisar(); return true }
  } catch (e) {
    setMsg({ tipo: 'error', texto: 'No se pudo abrir la instalación. Probá desde el menú de Chrome (los tres puntos).' })
  }
  avisar()
  return false
}

async function copiarLink(setMsg) {
  try {
    await navigator.clipboard.writeText(window.location.origin)
    setMsg({ tipo: 'ok', texto: 'Link copiado. Abrí Chrome y pegalo en la barra de direcciones.' })
  } catch {
    setMsg({ tipo: 'error', texto: 'No se pudo copiar. Escribí el link a mano en Chrome: ' + window.location.origin })
  }
}

function Pasos({ tipo, setMsg }) {
  if (tipo === 'android-prompt') {
    return <p className="mu">Queda en tu pantalla de inicio como cualquier aplicación y te llegan los avisos.</p>
  }
  if (tipo === 'android-manual') {
    return <p className="mu">En Chrome tocá los tres puntos ⋮ (arriba a la derecha) y elegí <b>Instalar app</b> o <b>Agregar a pantalla de inicio</b>. Si no ves esa opción, abrí este link directamente en <b>Chrome</b> (⋮ y <b>Abrir en Chrome</b>). Después abrila desde el ícono nuevo.</p>
  }
  if (tipo === 'android-interno') {
    return (
      <>
        <p className="mu">Estás en un navegador dentro de otra app (por ejemplo WhatsApp) y desde acá no se puede instalar. Abrí este link en <b>Chrome</b>: tocá los tres puntos ⋮ y elegí <b>Abrir en Chrome</b>, o copiá el link y pegalo en Chrome.</p>
        <button type="button" className="btn" style={{ marginTop: 10, width: '100%' }} onClick={() => copiarLink(setMsg)}>Copiar link</button>
      </>
    )
  }
  if (tipo === 'iphone-safari') {
    return <p className="mu">En Safari tocá <b>Compartir</b> (el cuadrado con la flecha) y elegí <b>Agregar a inicio</b>. Después abrila desde el ícono nuevo.</p>
  }
  return (
    <>
      <p className="mu">En iPhone la app se instala desde <b>Safari</b>. Abrí este link en Safari y después tocá <b>Compartir</b> y <b>Agregar a inicio</b>.</p>
      <button type="button" className="btn" style={{ marginTop: 10, width: '100%' }} onClick={() => copiarLink(setMsg)}>Copiar link</button>
    </>
  )
}

// Cartel grande: aparece una vez; si lo cierran sin instalar queda el recordatorio chico.
export function InstalarCartel() {
  const tipo = useTipo()
  const [cerrado, setCerrado] = useState(leer(K_VISTO))
  const [forzado, setForzado] = useState(false)
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  useEffect(() => {
    const f = () => { setForzado(true); setMsg(null) }
    window.addEventListener('instalar-abrir', f)
    return () => window.removeEventListener('instalar-abrir', f)
  }, [])
  if (tipo === 'instalada' || tipo === 'pc' || (cerrado && !forzado)) return null

  const cerrar = () => { guardar(K_VISTO); setCerrado(true); setForzado(false); avisar() }
  async function tocarInstalar() {
    setOcupado(true)
    const ok = await instalar(setMsg)
    setOcupado(false)
    if (ok) cerrar()
  }

  return (
    <div role="dialog" aria-label="Instalar la app" style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', marginBottom: 0 }}>
        <div style={{ color: 'var(--go)', marginBottom: 6 }}><Icon name="hop" size={30} /></div>
        <h3>Instalá la app en tu celular</h3>
        <p style={{ margin: '8px 0' }}>Es más rápida, queda en tu pantalla de inicio y podés recibir los avisos de pedidos, puntos y novedades.</p>
        <Pasos tipo={tipo} setMsg={setMsg} />
        {tipo === 'android-prompt'
          ? <button type="button" className="btn pri" style={{ marginTop: 12, width: '100%', padding: 16, fontSize: 18 }} disabled={ocupado} onClick={tocarInstalar}>Instalar</button>
          : null}
        <button type="button" className="btn" style={{ marginTop: 8, width: '100%' }} onClick={cerrar}>{tipo === 'android-prompt' ? 'Ahora no' : 'Entendido'}</button>
        <Msg m={msg} />
      </div>
    </div>
  )
}

// Recordatorio chico para el Inicio de cada rol: desaparece cuando la app queda instalada.
export function InstalarRecordatorio() {
  const tipo = useTipo()
  const [visto, setVisto] = useState(leer(K_VISTO))
  useEffect(() => {
    const f = () => setVisto(leer(K_VISTO))
    window.addEventListener('instalar-cambio', f)
    return () => window.removeEventListener('instalar-cambio', f)
  }, [])
  if (tipo === 'instalada' || tipo === 'pc' || !visto) return null
  return (
    <div className="row" style={{ background: 'var(--sf)', border: '1px solid var(--ln)', borderRadius: 12, padding: '8px 12px', marginBottom: 10, gap: 8 }}>
      <span className="mu" style={{ flex: 1, minWidth: 180 }}>Instalá la app en tu celular: es más rápida y te llegan los avisos.</span>
      <button type="button" className="btn" onClick={() => window.dispatchEvent(new Event('instalar-abrir'))}>Instalar</button>
    </div>
  )
}
