import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Icon } from './ui'
import Login from './pages/Login'
import Socio from './pages/Socio'
import Panel from './pages/Panel'
import Productor from './pages/Productor'

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

  const cargarMarca = useCallback(() => {
    supabase.from('configuracion').select('*').eq('id', 1).single()
      .then(({ data }) => { if (data) setMarca(data) })
  }, [])
  useEffect(() => { cargarMarca() }, [cargarMarca])
  useEffect(() => { document.title = marca.nombre_app }, [marca.nombre_app])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data } = supabase.auth.onAuthStateChange((_evento, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.from('perfiles').select('*').eq('id', session.user.id).single()
      .then(({ data, error }) => (error ? setError(error.message) : setPerfil(data)))
  }, [session])

  if (session === undefined) return <p className="mu">Cargando...</p>
  if (!session) return <Login marca={marca} />
  if (error) return <p className="msg error">No se pudo cargar tu perfil: {error}</p>
  if (!perfil) return <p className="mu">Cargando tu perfil...</p>

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
          <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      {perfil.rol === 'socio' && <Socio perfil={perfil} />}
      {perfil.rol === 'personal' && <Panel esAdmin={false} />}
      {perfil.rol === 'productor' && <Productor perfil={perfil} />}
      {perfil.rol === 'admin' && <Panel esAdmin marca={marca} onMarca={cargarMarca} />}
    </>
  )
}
