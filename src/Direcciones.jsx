// Direcciones de envío: botón "Usar mi ubicación" y lista de direcciones guardadas (máx. 3).
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

export const linkMapas = (lat, lng) => 'https://www.google.com/maps?q=' + Number(lat).toFixed(6) + ',' + Number(lng).toFixed(6)

// Convierte las coordenadas en una dirección escrita (OpenStreetMap). Si falla, deja las coordenadas.
async function direccionDesde(lat, lng) {
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&accept-language=es&lat=' + lat + '&lon=' + lng)
    if (!r.ok) throw new Error('sin respuesta')
    const a = (await r.json()).address || {}
    const calle = [a.road || a.pedestrian || a.footway, a.house_number].filter(Boolean).join(' ')
    const zona = a.suburb || a.neighbourhood || a.city_district
    const ciudad = a.city || a.town || a.village || a.municipality
    const texto = [calle, zona, ciudad].filter(Boolean).join(', ')
    if (texto.length > 4) return texto
  } catch (e) { /* se usa el respaldo */ }
  return 'Ubicación GPS (' + lat.toFixed(5) + ', ' + lng.toFixed(5) + ')'
}

// Pide la ubicación al dispositivo y devuelve { direccion, lat, lng } por onResultado.
export function BotonUbicacion({ onResultado }) {
  const [buscando, setBuscando] = useState(false)
  const [msg, setMsg] = useState(null)

  function usar() {
    setMsg(null)
    if (!navigator.geolocation) return setMsg({ tipo: 'error', texto: 'Este dispositivo no permite usar la ubicación. Escribí la dirección.' })
    setBuscando(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const direccion = await direccionDesde(lat, lng)
        setBuscando(false)
        onResultado({ direccion, lat, lng })
        setMsg({ tipo: 'ok', texto: 'Revisá que la dirección sea correcta y corregila si hace falta.' })
      },
      (err) => {
        setBuscando(false)
        setMsg({ tipo: 'error', texto: err.code === 1 ? 'No diste permiso para usar la ubicación. Podés escribir la dirección.' : 'No pude obtener la ubicación. Probá de nuevo o escribí la dirección.' })
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    )
  }

  return (
    <>
      <button type="button" className="btn" style={{ marginTop: 8 }} onClick={usar} disabled={buscando}>
        {buscando ? 'Buscando ubicación...' : 'Usar mi ubicación'}
      </button>
      <Msg m={msg} />
    </>
  )
}

// Direcciones guardadas del socio (para la tienda y para Perfil).
export function useDirecciones(socioId) {
  const [lista, setLista] = useState([])
  const cargar = useCallback(async () => {
    const { data } = await supabase.from('direcciones_envio').select('*').eq('socio_id', socioId)
      .order('usada_en', { ascending: false })
    setLista(data || [])
  }, [socioId])
  useEffect(() => { cargar() }, [cargar])
  return [lista, cargar]
}

// Perfil: ver, editar, borrar y agregar direcciones (hasta tres).
export function MisDirecciones({ perfil }) {
  const [lista, recargar] = useDirecciones(perfil.id)
  const [editando, setEditando] = useState(null)
  const [texto, setTexto] = useState('')
  const [nueva, setNueva] = useState(null)
  const [msg, setMsg] = useState(null)

  async function guardarEdicion(id) {
    setMsg(null)
    const { error } = await supabase.rpc('editar_direccion', { p_id: id, p_direccion: texto })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setEditando(null)
    recargar()
  }

  async function borrar(id) {
    setMsg(null)
    const { error } = await supabase.from('direcciones_envio').delete().eq('id', id)
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    recargar()
  }

  async function agregar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.rpc('guardar_direccion', { p_direccion: nueva.direccion, p_lat: nueva.lat ?? null, p_lng: nueva.lng ?? null })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setNueva(null)
    recargar()
  }

  return (
    <>
      <p className="mu">Se guardan al hacer un pedido con envío. Podés tener hasta 3: si cargás una nueva con tres guardadas, se borra la que menos usaste.</p>
      {lista.length === 0 && <p className="mu">Todavía no guardaste direcciones.</p>}
      {lista.map((d) => (
        <div key={d.id} className="card">
          {editando === d.id ? (
            <>
              <input value={texto} onChange={(e) => setTexto(e.target.value)} aria-label="Dirección" />
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                <button type="button" className="btn pri" onClick={() => guardarEdicion(d.id)}>Guardar</button>
                <button type="button" className="btn" onClick={() => setEditando(null)}>Cancelar</button>
              </div>
            </>
          ) : (
            <>
              <b>{d.direccion}</b>
              {d.lat != null && <p className="mu"><a href={linkMapas(d.lat, d.lng)} target="_blank" rel="noreferrer">Ver en el mapa</a></p>}
              <div className="row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
                <button type="button" className="btn" onClick={() => { setEditando(d.id); setTexto(d.direccion) }}>Editar</button>
                <button type="button" className="btn" onClick={() => borrar(d.id)}>Borrar</button>
              </div>
            </>
          )}
        </div>
      ))}
      {nueva ? (
        <form onSubmit={agregar}>
          <label htmlFor="nd">Nueva dirección</label>
          <input id="nd" value={nueva.direccion} onChange={(e) => setNueva({ ...nueva, direccion: e.target.value, lat: null, lng: null })} required minLength={5} />
          <BotonUbicacion onResultado={(r) => setNueva(r)} />
          <div className="row" style={{ marginTop: 8, justifyContent: 'flex-start' }}>
            <button className="btn pri">Guardar dirección</button>
            <button type="button" className="btn" onClick={() => setNueva(null)}>Cancelar</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn" onClick={() => setNueva({ direccion: '', lat: null, lng: null })}>Agregar dirección</button>
      )}
      <Msg m={msg} />
    </>
  )
}
