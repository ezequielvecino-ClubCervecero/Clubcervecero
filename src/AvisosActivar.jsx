// Invita a activar las notificaciones: un cartel al entrar (una sola vez) y un recordatorio chico en el Inicio.
import { useCallback, useEffect, useState } from 'react'
import { estadoPush, activarPush } from './push'
import { Icon, Msg } from './ui'

const CLAVE = 'avisos_cartel_visto'
const yaVisto = () => { try { return localStorage.getItem(CLAVE) === '1' } catch { return false } }
const marcarVisto = () => { try { localStorage.setItem(CLAVE, '1') } catch { /* sin almacenamiento: no pasa nada */ } }

const PARA_QUE = {
  socio: 'cuando acepten tu pedido, recibas puntos o una entrada, y las novedades de las cervecerías',
  productor: 'cuando entre un pedido nuevo o uno esté por vencer, para que no se cancele solo',
  admin: 'cuando entren pedidos, compras de entradas o cuotas pagadas',
  personal: 'cuando entren pedidos nuevos de la tienda del club',
}

function useEstadoPush() {
  const [estado, setEstado] = useState(null)
  const refrescar = useCallback(async () => { setEstado(await estadoPush()) }, [])
  useEffect(() => {
    refrescar()
    window.addEventListener('avisos-cambio', refrescar)
    return () => window.removeEventListener('avisos-cambio', refrescar)
  }, [refrescar])
  return estado
}

async function activar(setMsg) {
  setMsg(null)
  try {
    await activarPush()
    return true
  } catch (e) {
    setMsg({ tipo: 'error', texto: e.message })
    return false
  } finally {
    window.dispatchEvent(new Event('avisos-cambio'))
  }
}

// Cartel grande: aparece una vez (si los rechaza o lo cierra, no vuelve; queda el recordatorio chico).
export function AvisosCartel({ rol }) {
  const estado = useEstadoPush()
  const [cerrado, setCerrado] = useState(yaVisto())
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  if (cerrado || (estado !== 'inactivo' && estado !== 'instalar')) return null

  const cerrar = () => { marcarVisto(); setCerrado(true) }
  async function aceptar() {
    setOcupado(true)
    const ok = await activar(setMsg)
    setOcupado(false)
    if (ok) cerrar()
    else if (typeof Notification !== 'undefined' && Notification.permission === 'denied') cerrar()
  }

  return (
    <div role="dialog" aria-label="Activar avisos" style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div className="card" style={{ maxWidth: 400, width: '100%', marginBottom: 0 }}>
        <div style={{ color: 'var(--go)', marginBottom: 6 }}><Icon name="hop" size={30} /></div>
        <h3>Activá los avisos</h3>
        <p style={{ margin: '8px 0' }}>Te avisamos al celular {PARA_QUE[rol] || PARA_QUE.socio}. Sin avisos te podés perder cosas importantes.</p>
        {estado === 'instalar' ? (
          <>
            <p className="mu">En iPhone, primero instalá la app: en Safari tocá Compartir y después "Agregar a inicio". Abrila desde el ícono nuevo y activá los avisos ahí.</p>
            <button type="button" className="btn pri" style={{ marginTop: 12, width: '100%' }} onClick={cerrar}>Entendido</button>
          </>
        ) : (
          <>
            <p className="mu">Te va a aparecer un permiso del celular: tocá "Permitir". Podés apagar los que no quieras en tus preferencias.</p>
            <button type="button" className="btn pri" style={{ marginTop: 12, width: '100%' }} disabled={ocupado} onClick={aceptar}>Activar avisos</button>
            <button type="button" className="btn" style={{ marginTop: 8, width: '100%' }} onClick={cerrar}>Ahora no</button>
          </>
        )}
        <Msg m={msg} />
      </div>
    </div>
  )
}

// Recordatorio chico para el Inicio: no ocupa casi nada y desaparece cuando los avisos están activos.
export function AvisosRecordatorio() {
  const estado = useEstadoPush()
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)
  if (estado !== 'inactivo' && estado !== 'instalar' && estado !== 'denegado') return null
  const texto = estado === 'instalar'
    ? 'Para recibir avisos en iPhone, instalá la app (Compartir > Agregar a inicio) y abrila desde ahí.'
    : estado === 'denegado'
      ? 'Los avisos están bloqueados en este navegador: habilitalos en los ajustes del sitio.'
      : 'Tenés los avisos apagados: activalos para no perderte pedidos, puntos ni novedades.'
  return (
    <div className="row" style={{ background: 'var(--sf)', border: '1px solid var(--ln)', borderRadius: 12, padding: '8px 12px', marginBottom: 10, gap: 8 }}>
      <span className="mu" style={{ flex: 1, minWidth: 180 }}>{texto}</span>
      {estado === 'inactivo' && (
        <button type="button" className="btn" disabled={ocupado} onClick={async () => { setOcupado(true); await activar(setMsg); setOcupado(false) }}>Activar</button>
      )}
      {msg && <span className="msg error" style={{ width: '100%' }}>{msg.texto}</span>}
    </div>
  )
}
