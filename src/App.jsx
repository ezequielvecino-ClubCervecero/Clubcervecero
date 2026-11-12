import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Icon, Msg } from './ui'
import Login from './pages/Login'
import Socio from './pages/Socio'
import Panel from './pages/Panel'
import Productor from './pages/Productor'
import Preferencias from './Preferencias'
import { AvisosCartel } from './AvisosActivar'

const MARCA_BASE = {
  nombre_app: 'Club Cervecero',
  descripcion: 'Tu tarjeta de socio, tus puntos y tus recargas',
  logo_login_url: null,
  logo_app_url: null,
}

const ROLES = { socio: 'Socio', personal: 'Personal del local', admin: 'Administrador', productor: 'Productor' }

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = todavia cargando
  const [perfil, setPerfil] = useState(null)
  const [error, setError] = useState('')
  const [marca, setMarca] = useState(MARCA_BASE)
  const [recuperando, setRecuperando] = useState(false)
  const [verPrefs, setVerPrefs] = useState(false)

  const cargarMarca = useCallback(() => {
    supabase.from('configuracion').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setMarca(data) })
  }, [])
  useEffect(() => { cargarMarca() }, [cargarMarca])
  useEffect(() => { document.title = marca.nombre_app }, [marca.nombre_app])
  // Ícono de la app elegido en Marca: pestaña, pantalla de inicio de iPhone y manifiesto de la app instalada.
  useEffect(() => {
    if (!marca.icono_app_url) return
    const link = (rel) => {
      let el = document.head.querySelector('link[rel="' + rel + '"]')
      if (!el) { el = document.createElement('link'); el.setAttribute('rel', rel); document.head.appendChild(el) }
      return el
    }
    link('icon').setAttribute('href', marca.icono_app_url)
    link('apple-touch-icon').setAttribute('href', marca.icono_app_url)
    const base = window.location.origin
    const manifiesto = {
      name: marca.nombre_app, short_name: marca.nombre_app, description: marca.descripcion,
      start_url: base + '/', scope: base + '/', display: 'standalone', orientation: 'portrait',
      background_color: marca.icono_fondo || '#120f1c', theme_color: '#120f1c', lang: 'es-AR',
      icons: [
        { src: marca.icono_app_url, sizes: '512x512', type: 'image/png', purpose: 'any' },
        { src: marca.icono_app_mask_url || marca.icono_app_url, sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    }
    const url = URL.createObjectURL(new Blob([JSON.stringify(manifiesto)], { type: 'application/manifest+json' }))
    link('manifest').setAttribute('href', url)
    return () => URL.revokeObjectURL(url)
  }, [marca.icono_app_url, marca.icono_app_mask_url, marca.icono_fondo, marca.nombre_app, marca.descripcion])
  // Tema de color elegido por el administrador (vale para todos). Sin dato, queda el violeta de siempre.
  useEffect(() => {
    const elegido = perfil && perfil.tema ? perfil.tema : marca.tema
    const t = ['claro', 'oscuro'].includes(elegido) ? elegido : 'violeta'
    document.documentElement.dataset.tema = t
    const color = { violeta: '#120f1c', claro: '#f6f4fb', oscuro: '#0b0b0c' }[t]
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', color)
  }, [marca.tema, perfil])
  useEffect(() => {
    const f = (e) => setPerfil((p) => (p ? { ...p, tema: e.detail } : p))
    const g = (e) => setPerfil((p) => (p ? { ...p, avisos_apagados: e.detail } : p))
    window.addEventListener('perfil-tema', f)
    window.addEventListener('perfil-avisos', g)
    return () => { window.removeEventListener('perfil-tema', f); window.removeEventListener('perfil-avisos', g) }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((evento, s) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true)
      setSession(s)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => (error ? setError(error.message) : setPerfil(data)))
  }, [session])

  if (session === undefined) return <p className="mu">Cargando...</p>
  if (!session) return <Login marca={marca} />
  if (recuperando) return <NuevaClave marca={marca} onListo={() => setRecuperando(false)} />
  if (error) return <p className="msg error">No se pudo cargar tu perfil: {error}</p>
  if (!perfil) return <p className="mu">Cargando tu perfil...</p>
  if (perfil.suspendido) {
    return (
      <div className="login">
        <div className="card">
          <h2>Cuenta suspendida</h2>
          <p className="mu" style={{ margin: '8px 0 12px' }}>Tu cuenta está suspendida. Consultá con el administrador del club.</p>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </div>
    )
  }

  return (
    <>
      <header className="row" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          {marca.logo_app_url
            ? <img className="logo" src={marca.logo_app_url} alt="" style={{ maxHeight: 36 }} />
            : <span style={{ color: 'var(--go)' }}><Icon name="hop" size={26} /></span>}
          <h1 style={{ fontSize: 22 }}>{marca.nombre_app}</h1>
        </div>
        <div className="row">
          <span className="mu">{perfil.nombre || session.user.email} · {ROLES[perfil.rol]}</span>
          {perfil.rol !== 'socio' && <button className="btn" onClick={() => setVerPrefs((v) => !v)}>{verPrefs ? 'Volver' : 'Mis preferencias'}</button>}
          <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      <AvisosCartel rol={perfil.rol} />
      {perfil.rol !== 'socio' && verPrefs && <Preferencias perfil={perfil} />}
      {perfil.rol === 'socio' && <Socio perfil={perfil} />}
      {!verPrefs && perfil.rol === 'personal' && <Panel esAdmin={false} />}
      {!verPrefs && perfil.rol === 'productor' && <Productor perfil={perfil} />}
      {!verPrefs && perfil.rol === 'admin' && <Panel esAdmin marca={marca} onMarca={cargarMarca} />}
    </>
  )
}

// Pantalla a la que se llega desde el correo de "restablecer clave".
function NuevaClave({ marca, onListo }) {
  const [clave, setClave] = useState('')
  const [msg, setMsg] = useState(null)

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.auth.updateUser({ password: clave })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Clave actualizada.' })
    setTimeout(onListo, 1200)
  }

  return (
    <div className="login">
      <h1 style={{ textAlign: 'center' }}>{marca.nombre_app}</h1>
      <form className="card" onSubmit={guardar}>
        <h3>Elegí tu clave nueva</h3>
        <label htmlFor="nc">Contraseña nueva</label>
        <input id="nc" type="password" minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} required />
        <button className="btn pri" style={{ width: '100%', marginTop: 16 }}>Guardar clave</button>
        <Msg m={msg} />
      </form>
    </div>
  )
}
