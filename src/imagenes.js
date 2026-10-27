// Subida de imagenes de productos: se reducen en el navegador antes de subir.
import { supabase } from './supabaseClient'

async function reducir(archivo, max = 480) {
  const img = await createImageBitmap(archivo)
  const escala = Math.min(1, max / Math.max(img.width, img.height))
  const w = Math.round(img.width * escala)
  const h = Math.round(img.height * escala)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return new Promise((ok, fallo) =>
    canvas.toBlob((b) => (b ? ok(b) : fallo(new Error('sin imagen'))), 'image/jpeg', 0.82))
}

export async function subirImagenProducto(archivo) {
  if (!archivo.type.startsWith('image/')) throw new Error('El archivo tiene que ser una imagen')
  let blob
  try { blob = await reducir(archivo) } catch { throw new Error('No se pudo leer la imagen. Probá con otra, en JPG o PNG.') }
  const ruta = 'prod-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg'
  const { error } = await supabase.storage.from('productos').upload(ruta, blob, { contentType: 'image/jpeg' })
  if (error) throw new Error(error.message)
  return supabase.storage.from('productos').getPublicUrl(ruta).data.publicUrl
}
