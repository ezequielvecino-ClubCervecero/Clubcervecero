// Íconos de la app instalada y de las notificaciones. El administrador sube una imagen y la app arma los tamaños.
import { useState } from 'react'
import { supabase } from './supabaseClient'

function cargarImagen(archivo) {
  return new Promise((ok, mal) => {
    const url = URL.createObjectURL(archivo)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); ok(img) }
    img.onerror = () => { URL.revokeObjectURL(url); mal(new Error('No se pudo leer la imagen. Probá con un PNG o JPG.')) }
    img.src = url
  })
}

// Dibuja la imagen dentro de un cuadrado, sin deformarla. "relleno" deja margen y "fondo" pinta el color de atrás.
function cuadrado(img, lado, { relleno = 0, fondo = null } = {}) {
  const c = document.createElement('canvas')
  c.width = lado; c.height = lado
  const g = c.getContext('2d')
  if (fondo) { g.fillStyle = fondo; g.fillRect(0, 0, lado, lado) }
  const caja = lado * (1 - relleno * 2)
  const esc = Math.min(caja / img.width, caja / img.height)
  const w = img.width * esc, h = img.height * esc
  g.drawImage(img, (lado - w) / 2, (lado - h) / 2, w, h)
  return new Promise((ok, mal) => c.toBlob((b) => (b ? ok(b) : mal(new Error('No se pudo preparar el ícono'))), 'image/png'))
}

async function subirPng(nombre, blob) {
  const ruta = nombre + '-' + Date.now() + '.png'
  const { error } = await supabase.storage.from('logos').upload(ruta, blob, { contentType: 'image/png' })
  if (error) throw new Error(error.message)
  return supabase.storage.from('logos').getPublicUrl(ruta).data.publicUrl
}

export default function IconosMarca({ marca, actualizar, setMsg }) {
  const [ocupado, setOcupado] = useState('')
  const [fondo, setFondo] = useState(marca.icono_fondo || '#120f1c')

  async function subirApp(archivo) {
    if (!archivo) return
    setMsg(null); setOcupado('app')
    try {
      const img = await cargarImagen(archivo)
      const [normal, mask] = await Promise.all([
        cuadrado(img, 512),
        cuadrado(img, 512, { relleno: 0.17, fondo }), // la zona segura de los íconos "maskable" es el 66% del centro
      ])
      const [u1, u2] = await Promise.all([subirPng('icono-app', normal), subirPng('icono-app-mask', mask)])
      if (await actualizar({ icono_app_url: u1, icono_app_mask_url: u2, icono_fondo: fondo }))
        setMsg({ tipo: 'ok', texto: 'Ícono de la app actualizado. En los celulares que ya la tienen instalada puede tardar en cambiar; si no cambia, desinstalala e instalala de nuevo.' })
    } catch (e) { setMsg({ tipo: 'error', texto: e.message }) }
    setOcupado('')
  }

  async function subirNotif(archivo) {
    if (!archivo) return
    setMsg(null); setOcupado('notif')
    try {
      const img = await cargarImagen(archivo)
      const url = await subirPng('icono-notif', await cuadrado(img, 192))
      if (await actualizar({ icono_notif_url: url })) setMsg({ tipo: 'ok', texto: 'Ícono de las notificaciones actualizado. Se ve en los próximos avisos.' })
    } catch (e) { setMsg({ tipo: 'error', texto: e.message }) }
    setOcupado('')
  }

  return (
    <>
      <div className="card">
        <h3>Ícono de la app</h3>
        <p className="mu">Es el que aparece en la pantalla de inicio del celular y en la pestaña del navegador. Subí una imagen cuadrada (PNG o JPG, ideal 512 × 512 o más grande); la app arma los tamaños.</p>
        {marca.icono_app_url
          ? <img src={marca.icono_app_url} alt="Ícono actual de la app" width="72" height="72" style={{ margin: '8px 0', borderRadius: 16 }} />
          : <p className="mu">Todavía no subiste uno: se usa el original.</p>}
        <label htmlFor="ico-fondo">Color de fondo (se usa cuando Android recorta el ícono en círculo)</label>
        <input id="ico-fondo" type="color" value={fondo} onChange={(e) => setFondo(e.target.value)} style={{ width: 80, height: 40, padding: 2 }} />
        <label htmlFor="ico-app">Imagen</label>
        <input id="ico-app" type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado === 'app'}
          onChange={(e) => { subirApp(e.target.files[0]); e.target.value = '' }} />
        {ocupado === 'app' && <p className="mu">Procesando...</p>}
        {marca.icono_app_url && <div style={{ marginTop: 10 }}><button type="button" className="btn" onClick={() => actualizar({ icono_app_url: null, icono_app_mask_url: null })}>Volver al original</button></div>}
      </div>
      <div className="card">
        <h3>Ícono de las notificaciones</h3>
        <p className="mu">Es el que acompaña a cada aviso en el celular. Subí una imagen cuadrada (PNG o JPG).</p>
        {marca.icono_notif_url
          ? <img src={marca.icono_notif_url} alt="Ícono actual de las notificaciones" width="64" height="64" style={{ margin: '8px 0', borderRadius: 12 }} />
          : <p className="mu">Todavía no subiste uno: se usa el original.</p>}
        <input type="file" accept="image/png,image/jpeg,image/webp" disabled={ocupado === 'notif'}
          onChange={(e) => { subirNotif(e.target.files[0]); e.target.value = '' }} />
        {ocupado === 'notif' && <p className="mu">Procesando...</p>}
        {marca.icono_notif_url && <div style={{ marginTop: 10 }}><button type="button" className="btn" onClick={() => actualizar({ icono_notif_url: null })}>Volver al original</button></div>}
      </div>
    </>
  )
}
