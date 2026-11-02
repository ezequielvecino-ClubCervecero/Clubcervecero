// Preferencias de cada persona: tema de color y avisos (notificaciones).
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'
import { estadoPush, activarPush, desactivarPush } from './push'

const TEMAS = [['', 'Predeterminado del club'], ['violeta', 'Violeta'], ['claro', 'Claro'], ['oscuro', 'Oscuro']]

// Avisos que existen para cada rol.
const AVISOS = {
  socio: [['pedido_aceptado', 'Cuando aceptan mi pedido'], ['puntos', 'Cuando recibo puntos'], ['entrada', 'Cuando recibo una entrada (comprada o pasada)']],
  productor: [['pedido_nuevo', 'Cuando entra un pedido nuevo'], ['pedido_por_vencer', 'Cuando un pedido está por vencer (a los 20 minutos)']],
  admin: [['pedido_club', 'Pedidos nuevos de la tienda del club'], ['compra_entradas', 'Compras de entradas'], ['cuota_mp', 'Cuotas pagadas por Mercado Pago']],
  personal: [['pedido_club', 'Pedidos nuevos de la tienda del club']],
}
const ESTADOS = {
  'no-soportado': 'Este navegador no permite avisos.',
  instalar: 'En iPhone, primero agregá la app a la pantalla de inicio (Compartir > Agregar a inicio) y abrila desde ahí.',
  denegado: 'Los avisos están bloqueados en este navegador. Podés habilitarlos en los ajustes del sitio.',
  activo: 'Los avisos están activados en este dispositivo.',
  inactivo: 'Los avisos no están activados en este dispositivo.',
}

export default function Preferencias({ perfil }) {
  const [tema, setTema] = useState(perfil.tema || '')
  const [apagados, setApagados] = useState(perfil.avisos_apagados || [])
  const [estado, setEstado] = useState(null)
  const [msg, setMsg] = useState(null)
  const [msgAvisos, setMsgAvisos] = useState(null)
  const lista = AVISOS[perfil.rol] || []

  useEffect(() => { estadoPush().then(setEstado) }, [])

  async function elegir(t) {
    setMsg(null)
    const { error } = await supabase.rpc('guardar_mi_tema', { p_tema: t || null })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setTema(t)
    window.dispatchEvent(new CustomEvent('perfil-tema', { detail: t || null }))
    setMsg({ tipo: 'ok', texto: 'Listo, tema cambiado.' })
  }

  async function dispositivo(activar) {
    setMsgAvisos(null)
    try {
      if (activar) await activarPush(); else await desactivarPush()
    } catch (e) {
      setMsgAvisos({ tipo: 'error', texto: e.message })
    }
    setEstado(await estadoPush())
  }

  async function alternar(id) {
    setMsgAvisos(null)
    const nuevo = apagados.includes(id) ? apagados.filter((x) => x !== id) : [...apagados, id]
    const { error } = await supabase.rpc('guardar_mis_avisos', { p_apagados: nuevo })
    if (error) return setMsgAvisos({ tipo: 'error', texto: error.message })
    setApagados(nuevo)
    window.dispatchEvent(new CustomEvent('perfil-avisos', { detail: nuevo }))
  }

  return (
    <>
      <div className="card">
        <h3>Tema de color</h3>
        <p className="mu">Elegí cómo ver la app en tu cuenta. "Predeterminado del club" usa el tema que define el administrador.</p>
        <div className="chips chips-parejos">
          {TEMAS.map(([id, nombre]) => (
            <button key={id || 'def'} type="button" className={'chip' + (tema === id ? ' on' : '')} onClick={() => elegir(id)}>{nombre}</button>
          ))}
        </div>
        <Msg m={msg} />
      </div>

      <div className="card">
        <h3>Avisos</h3>
        {estado && <p className="mu">{ESTADOS[estado]}</p>}
        {estado === 'inactivo' && <button type="button" className="btn pri" style={{ marginTop: 10 }} onClick={() => dispositivo(true)}>Activar avisos en este dispositivo</button>}
        {estado === 'activo' && <button type="button" className="btn" style={{ marginTop: 10 }} onClick={() => dispositivo(false)}>Desactivar en este dispositivo</button>}
        <p className="mu" style={{ marginTop: 12 }}>Elegí cuáles querés recibir (todos arrancan activados):</p>
        {lista.map(([id, texto]) => (
          <label key={id} htmlFor={'av-' + id} style={{ display: 'flex', gap: 10, alignItems: 'center', margin: '8px 0', color: 'var(--ink)', fontSize: 15 }}>
            <input id={'av-' + id} type="checkbox" style={{ width: 'auto' }} checked={!apagados.includes(id)} onChange={() => alternar(id)} />
            {texto}
          </label>
        ))}
        <Msg m={msgAvisos} />
      </div>
    </>
  )
}
