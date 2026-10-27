import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Coin, Msg } from '../ui'

export default function Login({ marca }) {
  const [modo, setModo] = useState('ingresar')
  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [referente, setReferente] = useState('')
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function enviar(e) {
    e.preventDefault()
    setMsg(null)
    setEnviando(true)
    const res = modo === 'ingresar'
      ? await supabase.auth.signInWithPassword({ email, password: clave })
      : await supabase.auth.signUp({ email, password: clave, options: { data: { nombre, referente: referente.trim() } } })
    setEnviando(false)
    if (res.error) return setMsg({ tipo: 'error', texto: res.error.message })
    if (modo === 'registrarse' && !res.data.session) {
      setMsg({ tipo: 'ok', texto: 'Cuenta creada. Revisá tu correo para confirmarla y después ingresá.' })
    }
  }

  return (
    <div className="login">
      <div className="member" style={{ textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {marca.logo_login_url
            ? <img className="logo" src={marca.logo_login_url} alt="" style={{ maxHeight: 96 }} />
            : <Coin size={56} />}
        </div>
        <h1 style={{ marginTop: 10 }}>{marca.nombre_app}</h1>
        <p className="mu">{marca.descripcion}</p>
      </div>
      <div className="chips" role="tablist">
        <button type="button" className={'chip' + (modo === 'ingresar' ? ' on' : '')} onClick={() => setModo('ingresar')}>Ingresar</button>
        <button type="button" className={'chip' + (modo === 'registrarse' ? ' on' : '')} onClick={() => setModo('registrarse')}>Crear cuenta</button>
      </div>
      <form className="card" onSubmit={enviar}>
        {modo === 'registrarse' && (
          <>
            <label htmlFor="nombre">Nombre y apellido</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <label htmlFor="referente">Número de socio o apodo de quien te invitó (opcional)</label>
            <input id="referente" value={referente} onChange={(e) => setReferente(e.target.value)} />
            <p className="mu" style={{ marginTop: 6 }}>Si lo escribís bien, esa persona suma 0,25 puntos cuando confirmes tu correo.</p>
          </>
        )}
        <label htmlFor="email">Correo</label>
        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <label htmlFor="clave">Contraseña</label>
        <input id="clave" type="password" minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} required />
        <button className="btn pri" style={{ width: '100%', marginTop: 16 }} disabled={enviando}>
          {modo === 'ingresar' ? 'Ingresar' : 'Crear mi cuenta'}
        </button>
        <Msg m={msg} />
      </form>
    </div>
  )
}
