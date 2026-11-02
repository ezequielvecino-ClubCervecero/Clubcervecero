// Palabras fijas del mensaje de WhatsApp de cada pedido (las edita el administrador en Marca).
export const WA_BASE = {
  saludo: 'Hola! Hice el pedido N.º {numero} en la app del club.',
  socio: 'Socio N.º',
  total: 'Total:',
  pago: 'Forma de pago:',
  envio: 'Entrega: envío a',
  retiro: 'Entrega: retiro en el local',
  ubicacion: 'Ubicación:',
  cierre: '',
}
export const WA_ETIQUETAS = {
  saludo: 'Saludo (usá {numero} donde va el número de pedido)',
  socio: 'Título del socio',
  total: 'Título del total',
  pago: 'Título de la forma de pago',
  envio: 'Entrega con envío (después va la dirección)',
  retiro: 'Entrega con retiro',
  ubicacion: 'Título de la ubicación',
  cierre: 'Frase final (opcional)',
}
export const textosWa = (guardados) => {
  const g = guardados && typeof guardados === 'object' ? guardados : {}
  return Object.fromEntries(Object.keys(WA_BASE).map((k) => [k, typeof g[k] === 'string' && (g[k].trim() !== '' || k === 'cierre') ? g[k] : WA_BASE[k]]))
}
