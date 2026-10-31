// Ranking de productos más vendidos (últimos 30 días, pedidos entregados).
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import Puesto from './Puesto'

export default function MasVendidos() {
  const [filas, setFilas] = useState(null)
  useEffect(() => { supabase.rpc('productos_mas_vendidos').then(({ data }) => setFilas(data || [])) }, [])

  if (filas === null) return <p className="mu">Cargando...</p>
  if (filas.length === 0) return <p className="mu">Todavía no hay ventas entregadas en los últimos 30 días.</p>
  return (
    <>
      <p className="mu" style={{ marginBottom: 8 }}>Unidades entregadas en los últimos 30 días. Las flechas comparan con los 30 días anteriores.</p>
      {filas.map((f) => (
        <div key={f.posicion} className="card row">
          <div className="row" style={{ gap: 12, flexWrap: 'nowrap', justifyContent: 'flex-start' }}>
            <Puesto pos={f.posicion} anterior={f.pos_anterior} />
            {f.imagen_url && <img className="prod-img" style={{ width: 48, height: 48 }} src={f.imagen_url} alt="" />}
            <div>
              <span>{f.nombre}{f.formato ? <span className="mu"> · {f.formato}</span> : null}</span>
              <p className="mu">Cervecería: {f.cerveceria}</p>
            </div>
          </div>
          <span className="pts" style={{ fontSize: 15 }}>{f.unidades} vendidos</span>
        </div>
      ))}
    </>
  )
}
