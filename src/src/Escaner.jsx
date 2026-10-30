// Lector de codigos QR con la camara. Usa la libreria html5-qrcode.
import { useEffect, useState } from 'react'
import { Html5Qrcode } from 'html5-qrcode'

export default function Escaner({ onLeido, onCerrar }) {
  const [error, setError] = useState('')

  useEffect(() => {
    let vivo = true
    let inicio = null
    const qr = new Html5Qrcode('lector-qr')
    // El pequeño retraso evita arrancar dos veces la camara en modo desarrollo.
    const t = setTimeout(() => {
      inicio = qr.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 220, height: 220 } },
        (texto) => {
          if (!vivo) return
          vivo = false
          onLeido(texto.trim().toUpperCase())
        },
        () => {},
      )
      inicio.catch(() => {
        if (vivo) setError('No se pudo abrir la cámara. Revisá el permiso del navegador o escribí el código a mano.')
      })
    }, 150)
    return () => {
      clearTimeout(t)
      vivo = false
      if (inicio) inicio.then(() => qr.stop()).then(() => qr.clear()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div style={{ marginTop: 12 }}>
      <div id="lector-qr" style={{ width: '100%', borderRadius: 12, overflow: 'hidden' }} />
      {error && <p className="msg error">{error}</p>}
      <div style={{ marginTop: 10 }}><button type="button" className="btn" onClick={onCerrar}>Cerrar cámara</button></div>
    </div>
  )
}
