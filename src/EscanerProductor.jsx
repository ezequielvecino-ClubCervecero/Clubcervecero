// Escáner del productor: cupones de canje (cobra los puntos) y entradas (solo da el ingreso).
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Icon, Msg, fmt } from './ui'
import Escaner from './Escaner'
import { FichaEscaneo } from './Entradas'

export default function EscanerProductor() {
  const [abierto, setAbierto] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [cupon, setCupon] = useState(null)
  const [ficha, setFicha] = useState(null)
  const [msg, setMsg] = useState(null)

  const limpiar = () => { setCupon(null); setFicha(null); setCodigo('') }

  async function consultar(texto) {
    const cod = texto.trim().toUpperCase()
    setMsg(null); setCupon(null); setFicha(null)
    if (!cod) return
    if (/^SOC-/.test(cod)) return setMsg({ tipo: 'error', texto: 'Ese es un QR de socio: lo escanea el personal del local. Acá escaneá cupones de canje y entradas.' })
    if (/^PRO-/.test(cod)) return setMsg({ tipo: 'error', texto: 'Ese es el QR de un productor: lo escanea el personal del club.' })
    if (/^PTS-/.test(cod)) return setMsg({ tipo: 'error', texto: 'Ese QR es para que los socios sumen puntos desde su app.' })
    if (/^ENT-/.test(cod)) {
      const { data, error } = await supabase.rpc('escanear_codigo', { p_codigo: cod })
      if (error) return setMsg({ tipo: 'error', texto: error.message })
      setCodigo(cod)
      return setFicha(data)
    }
    const { data, error } = await supabase.rpc('ver_cupon', { p_codigo: cod })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setCupon(data)
  }

  function leido(texto) {
    setEscaneando(false)
    setCodigo(texto.slice(0, 16))
    consultar(texto)
  }

  async function aceptar() {
    setMsg(null)
    const { data, error } = await supabase.rpc('canjear_cupon', { p_codigo: cupon.codigo })
    if (error) { limpiar(); return setMsg({ tipo: 'error', texto: error.message }) }
    setMsg({ tipo: 'ok', texto: 'Canje hecho: entregá "' + cupon.producto + '". Los ' + fmt(data.puntos) + ' puntos del canje quedaron a tu favor en tu rendición.' })
    limpiar()
  }

  async function rechazar() {
    setMsg(null)
    const { error } = await supabase.rpc('rechazar_cupon', { p_codigo: cupon.codigo })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Cupón cancelado. Los puntos quedaron liberados para el socio.' })
    limpiar()
  }

  if (!abierto) {
    return (
      <button type="button" className="btn pri" style={{ width: '100%', padding: '16px 12px', fontSize: 18, margin: '10px 0' }} onClick={() => setAbierto(true)}>
        <Icon name="gift" size={22} />Escanear
      </button>
    )
  }

  return (
    <div className="card">
      <h3>Escanear cupón o entrada</h3>
      {ficha && <FichaEscaneo ficha={ficha} onCambio={() => consultar(codigo)} onVolver={limpiar} soloIngreso />}
      {!cupon && !ficha && (
        <>
          <p className="mu" style={{ marginTop: 6 }}>Escaneá el QR del cupón de canje o de una entrada, o escribí el código.</p>
          {escaneando
            ? <Escaner onLeido={leido} onCerrar={() => setEscaneando(false)} />
            : <button type="button" className="btn pri" style={{ marginTop: 12 }} onClick={() => { setMsg(null); setEscaneando(true) }}>
                <Icon name="gift" size={18} />Escanear con la cámara
              </button>}
          <form onSubmit={(e) => { e.preventDefault(); consultar(codigo) }}>
            <label htmlFor="ep-cod">Código (cupón de 8 caracteres o entrada ENT-...)</label>
            <input id="ep-cod" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={16} required />
            <button className="btn" style={{ marginTop: 12 }}>Ver código</button>
          </form>
        </>
      )}
      {cupon && (
        <>
          <div className="estado warn" style={{ marginTop: 12 }}>
            <span>Producto a entregar</span>
            <b style={{ fontSize: 20 }}>{cupon.producto}</b>
            <span>{cupon.categoria} · {fmt(cupon.puntos)} puntos</span>
            <span>Socio N.º {String(cupon.socio_numero).padStart(4, '0')} · {cupon.socio_nombre || 'Sin nombre'}</span>
          </div>
          <p className="mu">Al aceptar, entregás el producto y esos puntos quedan a tu favor. Confirmá que lo tenés disponible.</p>
          <div className="row" style={{ marginTop: 12 }}>
            <button type="button" className="btn" onClick={rechazar}>No hay disponibilidad</button>
            <button type="button" className="btn pri" onClick={aceptar}><Icon name="gift" size={18} />Aceptar y canjear</button>
          </div>
          <div style={{ marginTop: 10 }}><button type="button" className="btn" onClick={limpiar}>Volver</button></div>
        </>
      )}
      <Msg m={msg} />
      <div style={{ marginTop: 12 }}><button type="button" className="btn" onClick={() => { setAbierto(false); setEscaneando(false); limpiar(); setMsg(null) }}>Cerrar escáner</button></div>
    </div>
  )
}
