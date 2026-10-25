import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Icon } from './ui'
import Login from './pages/Login'
import Socio from './pages/Socio'
import Panel from './pages/Panel'

const ROLES = { socio: 'Socio', personal: 'Personal del local', admin: 'Administrador' }

export default function App() {
  const [session, setSession] = useState(undefined) // undefined = todavia cargando
  const [perfil, setPerfil] = useState(null)
  const [error, setError] = useState('')

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
  if (!session) return <Login />
  if (error) return <p className="msg error">No se pudo cargar tu perfil: {error}</p>
  if (!perfil) return <p className="mu">Cargando tu perfil...</p>

  return (
    <>
      <header className="row" style={{ marginBottom: 14 }}>
        <div className="row" style={{ gap: 8 }}>
          <span style={{ color: 'var(--go)' }}><Icon name="hop" size={26} /></span>
          <h1 style={{ fontSize: 22 }}>Club Cervecero</h1>
        </div>
        <div className="row">
          <span className="mu">{perfil.nombre || session.user.email} · {ROLES[perfil.rol]}</span>
          <button className="btn" onClick={() => supabase.auth.signOut()}>Salir</button>
        </div>
      </header>
      {perfil.rol === 'socio' && <Socio perfil={perfil} />}
      {perfil.rol === 'personal' && <Panel esAdmin={false} />}
      {perfil.rol === 'admin' && <Panel esAdmin />}
    </>
  )
}
