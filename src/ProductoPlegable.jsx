// Tarjeta de producto minimizada: nombre, precio y stock; al tocarla se abre para editar.
import { plata, fmt } from './ui'

export default function ProductoPlegable({ r, abierto, onToggle, children }) {
  return (
    <div className="card" style={{ opacity: r.activo ? 1 : 0.6 }}>
      <button type="button" onClick={onToggle} aria-expanded={abierto}
        style={{ all: 'unset', cursor: 'pointer', display: 'flex', width: '100%', alignItems: 'center', gap: 10, justifyContent: 'space-between' }}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <b>{r.nombre || 'Sin nombre'}</b>
          {!r.activo && <span className="mu"> · Oculto</span>}
        </span>
        <span className="mu" style={{ whiteSpace: 'nowrap' }}>$ {plata(r.precio_pesos || 0)} · Stock {r.stock === '' || r.stock == null ? '-' : r.stock}</span>
        <span aria-hidden="true">{abierto ? '▴' : '▾'}</span>
      </button>
      {abierto && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}
