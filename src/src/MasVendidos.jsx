// Ranking de productos mas vendidos (ultimos 30 dias, pedidos confirmados).
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'

export default function MasVendidos() {
  const [filas, setFilas] = useState(null)
  useEffect(() => { supabase.rpc('productos_mas_vendidos').then(({ data }) => setFilas(data || [])) }, [])

  if (filas === null) return <p className="mu">Cargando...</p>
  if (filas.length === 0) return <p className="mu">Todavía no hay ventas confirmadas en los últimos 30 días.</p>
  return (
    <>
      <p className="mu" style={{ marginBottom: 8 }}>Unidades vendidas en los últimos 30 días.</p>
      {filas.map((f) => (
        <div key={f.posicion} className="card row">
          <div className="row" style={{ gap: 12, flexWrap: 'nowrap', justifyContent: 'flex-start' }}>
            <b>{f.posicion}.</b>
            {f.imagen_url && <img className="prod-img" style={{ width: 48, height: 48 }} src={f.imagen_url} alt="" />}
            <span>{f.nombre}{f.formato ? <span className="mu"> · {f.formato}</span> : null}</span>
          </div>
          <span className="pts" style={{ fontSize: 15 }}>{f.unidades} vendidos</span>
        </div>
      ))}
    </>
  )
}
