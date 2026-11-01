// Reloj de un pedido que espera respuesta: cuándo se hizo, cuánto falta y a qué hora se cancela.
import { useEffect, useState } from 'react'

export const LIMITE_PEDIDO_MIN = 30
const hora = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/Argentina/Buenos_Aires' })

export default function Reloj({ creado, minutos = LIMITE_PEDIDO_MIN }) {
  const [ahora, setAhora] = useState(Date.now())
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const inicio = new Date(creado).getTime()
  const fin = inicio + minutos * 60000
  const falta = Math.max(0, Math.ceil((fin - ahora) / 1000))
  const mm = String(Math.floor(falta / 60)).padStart(2, '0')
  const ss = String(falta % 60).padStart(2, '0')
  const urgente = falta <= 300

  return (
    <div style={{ marginTop: 8, padding: '8px 10px', borderRadius: 10, border: '1px solid ' + (urgente ? '#f87171' : 'var(--am)') }}>
      <div className="row" style={{ flexWrap: 'nowrap' }}>
        <span className="mu">Pedido a las {hora(inicio)}</span>
        <b style={{ fontVariantNumeric: 'tabular-nums', color: urgente ? '#f87171' : 'var(--go, inherit)' }}>
          {falta > 0 ? mm + ':' + ss : 'Venció'}
        </b>
      </div>
      <p className="mu" style={{ margin: '4px 0 0' }}>
        {falta > 0 ? 'Quedan ' + mm + ':' + ss + ' · se cancela a las ' + hora(fin) + ' si no se confirma.' : 'Se cancela en un momento y se devuelven stock y puntos.'}
      </p>
    </div>
  )
}
