// Botón del socio para sumar puntos escaneando un QR de puntos que muestra el club.
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Icon, Msg, fmt } from './ui'
import Escaner from './Escaner'

export default function EscanerPuntos({ onListo, fijo = false }) {
  const [abierto, setAbierto] = useState(fijo)
  const [escaneando, setEscaneando] = useState(false)
  const [codigo, setCodigo] = useState('')
  const [msg, setMsg] = useState(null)
  const [ocupado, setOcupado] = useState(false)

  async function canjear(texto) {
    const cod = texto.trim().toUpperCase()
    if (!cod || ocupado) return
    setOcupado(true); setMsg(null)
    const { data, error } = await supabase.rpc('canjear_qr_puntos', { p_codigo: cod })
    setOcupado(false)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setCodigo('')
    setMsg({ tipo: 'ok', texto: '¡Ganaste ' + fmt(data.puntos) + ' puntos! (' + data.nombre + ')' })
    if (onListo) onListo()
  }

  function leido(texto) {
    setEscaneando(false)
    canjear(texto)
  }

  if (!abierto && !fijo) {
    return (
      <button type="button" className="btn pri" style={{ width: '100%', margin: '10px 0' }} onClick={() => setAbierto(true)}>
        <Icon name="gift" size={18} />Escanear QR de puntos
      </button>
    )
  }
  return (
    <div className="card">
      <h3>Escanear QR de puntos</h3>
      <p className="mu">Escaneá el QR que te muestran en el local y sumás puntos al instante.</p>
      {escaneando
        ? <Escaner onLeido={leido} onCerrar={() => setEscaneando(false)} />
        : <button type="button" className="btn pri" style={{ marginTop: 8 }} onClick={() => { setMsg(null); setEscaneando(true) }}>
            <Icon name="gift" size={18} />Abrir la cámara
          </button>}
      <form onSubmit={(e) => { e.preventDefault(); canjear(codigo) }}>
        <label htmlFor="qp-cod">O escribí el código</label>
        <input id="qp-cod" value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} maxLength={16} />
        <button className="btn" style={{ marginTop: 10 }} disabled={ocupado}>Sumar puntos</button>
      </form>
      <Msg m={msg} />
      {!fijo && <div style={{ marginTop: 12 }}><button type="button" className="btn" onClick={() => { setAbierto(false); setEscaneando(false); setMsg(null) }}>Cerrar</button></div>}
    </div>
  )
}
