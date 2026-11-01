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

// Primera letra en mayuscula (ej. "octubre de 2026" -> "Octubre de 2026").
export const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s)

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const $ = (n) => '$ ' + fmt(n)
const mes = (iso) => cap(new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }))

// Abre una hoja limpia lista para imprimir o "Guardar como PDF" desde el navegador.
export function imprimirHoja(titulo, cuerpoHtml) {
  const w = window.open('', '_blank')
  if (!w) {
    window.alert('El navegador bloqueó la ventana. Permití las ventanas emergentes de este sitio y probá de nuevo.')
    return
  }
  w.document.write(
    '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>' + esc(titulo) + '</title>' +
    '<style>body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:32px;max-width:720px}' +
    'h1{font-size:22px;margin:0 0 4px}h2{font-size:16px;margin:0 0 18px;font-weight:normal;color:#444}' +
    'table{width:100%;border-collapse:collapse;margin-top:8px}td,th{padding:7px 4px;border-bottom:1px solid #ccc;text-align:left;font-size:14px}' +
    'td.n,th.n{text-align:right}.tot td{font-weight:bold;border-top:2px solid #111;font-size:16px}' +
    '.pie{margin-top:24px;font-size:12px;color:#666}.estado{display:inline-block;border:1px solid #111;padding:2px 10px;border-radius:12px;font-size:13px}' +
    '@media print{button{display:none}body{margin:12mm}}</style></head><body>' + cuerpoHtml +
    '<p class="pie">Impreso el ' + esc(new Date().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })) + '</p>' +
    '<button onclick="window.print()" style="margin-top:12px;padding:8px 16px">Imprimir / Guardar PDF</button>' +
    '</body></html>')
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 350)
}

// Ticket de rendicion mensual de un productor (lo usan el productor y el administrador).
export function imprimirTicket(t, cerveceria, club) {
  const res = Number(t.resultado)
  const fila = (a, b) => '<tr><td>' + a + '</td><td class="n">' + b + '</td></tr>'
  imprimirHoja('Ticket ' + t.id,
    '<h1>' + esc(club || 'Club Cervecero') + '</h1>' +
    '<h2>Rendición mensual · Ticket N.º ' + esc(t.id) + '</h2>' +
    '<table>' +
    fila('Cervecería', esc(cerveceria || 'Productor')) +
    fila('Mes', esc(mes(t.periodo))) +
    fila('Pedidos entregados', esc(t.pedidos)) +
    fila('Cobrado en pesos', $(t.ingreso_pesos)) +
    fila('Puntos obtenidos', esc(fmt(t.puntos)) + ' pts (valen ' + $(t.puntos_pesos) + ')') +
    fila('Ingreso total', $(Number(t.ingreso_pesos) + Number(t.puntos_pesos))) +
    fila('Porcentaje acordado', esc(t.porcentaje) + '% = ' + $(t.comision)) +
    fila('Menos: valor de los puntos', $(t.puntos_pesos)) +
    '<tr class="tot"><td>' + (res > 0 ? 'A pagar por el productor' : res < 0 ? 'A pagar por el club' : 'Sin saldo') + '</td><td class="n">' + $(Math.abs(res)) + '</td></tr>' +
    '</table>' +
    '<p style="margin-top:16px">Estado: <span class="estado">' + (t.estado === 'pagado' ? 'Pagado' : 'Pendiente') + '</span>' +
    (t.estado === 'pagado' && t.pagado_en ? ' · ' + esc(new Date(t.pagado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })) : '') + '</p>')
}

// Detalle de ventas entregadas de un productor.
export function imprimirVentas(cerveceria, filas, club) {
  const m = new Map()
  filas.forEach((f) => {
    const k = f.producto + (f.formato ? ' (' + f.formato + ')' : '')
    m.set(k, (m.get(k) || 0) + f.cantidad)
  })
  const totales = [...m.entries()].sort((a, b) => b[1] - a[1])
  imprimirHoja('Ventas ' + (cerveceria || ''),
    '<h1>' + esc(club || 'Club Cervecero') + '</h1><h2>Ventas entregadas · ' + esc(cerveceria || 'Productor') + '</h2>' +
    '<h3>Total por producto</h3><table>' + totales.map(([k, n]) => '<tr><td>' + esc(k) + '</td><td class="n">' + n + '</td></tr>').join('') + '</table>' +
    '<h3 style="margin-top:20px">Detalle</h3><table><tr><th>Entrega</th><th>Pedido</th><th>Producto</th><th class="n">Cant.</th></tr>' +
    filas.map((f) => '<tr><td>' + esc(fechaHora(f.fecha)) + '</td><td>' + esc(f.pedido) + '</td><td>' +
      esc(f.producto + (f.formato ? ' (' + f.formato + ')' : '')) + '</td><td class="n">' + esc(f.cantidad) + '</td></tr>').join('') + '</table>')
}
