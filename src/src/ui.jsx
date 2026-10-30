// Piezas compartidas: formato, iconos de cerveza y mensajes.
export const fmt = (n) =>
  Number(n ?? 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export const fechaHora = (s) =>
  new Date(s).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })

export const TIPOS = {
  carga: 'Carga',
  canje: 'Canje',
  ajuste: 'Ajuste',
  descuento_cuota: 'Descuento por cuota',
  transferencia: 'Transferencia',
  compra: 'Compra',
  bonificacion: 'Bonificación',
}

export const CATS = ['Recargas', 'Cervezas especiales', 'Merchandise', 'Entradas a eventos']

const P = {
  pint: (<><path d="M6 3h12l-1.5 17a2 2 0 0 1-2 1.8h-5a2 2 0 0 1-2-1.8z" /><path d="M6.5 8h11" /></>),
  recarga: (<><path d="M10 2h4v3l2 3v12a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2V8l2-3z" /><path d="M8 13h8" /></>),
  barrel: (<><ellipse cx="12" cy="5" rx="8" ry="2.5" /><path d="M4 5v14c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5V5M4 12c0 1.4 3.6 2.5 8 2.5s8-1.1 8-2.5" /></>),
  hop: (<><path d="M12 2c3 1 5 3.5 5 6.5 0 4-2.5 8-5 12.5-2.5-4.5-5-8.5-5-12.5C7 5.5 9 3 12 2z" /><path d="M7.5 9c2 1 7 1 9 0M8.5 14c1.5.8 5.5.8 7 0" /></>),
  crown: <path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z" />,
  gift: (<><path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7" /><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" /></>),
}

export function Icon({ name, size = 20 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  )
}

export function Coin({ size = 40 }) {
  return (
    <span className="coin" style={{ width: size, height: size }}>
      <Icon name="pint" size={Math.round(size * 0.55)} />
    </span>
  )
}

export function Msg({ m }) {
  if (!m) return null
  return <p className={'msg ' + m.tipo} role="status">{m.texto}</p>
}

export function Acordeon({ titulo, icono, abierto, onToggle, children }) {
  return (
    <section className="acordeon">
      <button type="button" className={'acc-btn' + (abierto ? ' on' : '')} aria-expanded={abierto} onClick={onToggle}>
        <span className="row" style={{ gap: 10 }}><Icon name={icono} size={20} />{titulo}</span>
        <span aria-hidden="true">{abierto ? '▲' : '▼'}</span>
      </button>
      {abierto && <div className="acc-cuerpo">{children}</div>}
    </section>
  )
}

// Barra de navegacion fija al pie: pocos botones grandes.
export function Navegacion({ items, actual, onElegir }) {
  return (
    <nav className="nav-pie" aria-label="Secciones">
      {items.map(([id, texto, icono, aviso]) => (
        <button key={id} type="button" className={'nav-btn' + (actual === id ? ' on' : '')}
          aria-current={actual === id ? 'page' : undefined} onClick={() => onElegir(id)}>
          <span className="nav-ico">
            <Icon name={icono} size={22} />
            {aviso > 0 && <span className="nav-aviso">{aviso}</span>}
          </span>
          <span>{texto}</span>
        </button>
      ))}
    </nav>
  )
}

// Categoria del socio: Miembro o Miembro Gold (en dorado).
export function Categoria({ valor }) {
  const gold = valor === 'gold'
  return <span className={'pill ' + (gold ? 'gold' : 'cel')}>{gold ? 'Miembro Gold' : 'Miembro'}</span>
}
