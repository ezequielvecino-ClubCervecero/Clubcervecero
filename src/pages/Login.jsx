import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Coin, Msg } from '../ui'

export default function Login({ marca }) {
  const [modo, setModo] = useState('ingresar')
  const [usuario, setUsuario] = useState('')
  const [ident, setIdent] = useState('')
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [mayor, setMayor] = useState(false)
  const [email, setEmail] = useState('')
  const [clave, setClave] = useState('')
  const [referente, setReferente] = useState('')
  const [msg, setMsg] = useState(null)
  const [enviando, setEnviando] = useState(false)

  async function olvide() {
    setMsg(null)
    let correo = ident.trim()
    if (!correo) return setMsg({ tipo: 'error', texto: 'Escribí tu usuario o correo y volvé a tocar "Olvidé mi clave".' })
    if (!correo.includes('@')) {
      const r = await supabase.rpc('email_de_usuario', { p_usuario: correo })
      correo = r.data || ''
    }
    if (correo) await supabase.auth.resetPasswordForEmail(correo, { redirectTo: window.location.origin })
    // Siempre el mismo mensaje, exista o no la cuenta.
    setMsg({ tipo: 'ok', texto: 'Si la cuenta existe, te mandamos un correo para elegir una clave nueva.' })
  }

  async function enviar(e) {
    e.preventDefault()
    setMsg(null)
    if (modo === 'registrarse' && !mayor) return setMsg({ tipo: 'error', texto: 'Tenés que confirmar que sos mayor de 18 años para crear la cuenta.' })
    setEnviando(true)
    let res
    if (modo === 'ingresar') {
      // Con usuario (sin @) se busca primero el correo de esa cuenta.
      let correo = ident.trim()
      if (!correo.includes('@')) {
        const r = await supabase.rpc('email_de_usuario', { p_usuario: correo })
        correo = r.data || ''
      }
      res = correo
        ? await supabase.auth.signInWithPassword({ email: correo, password: clave })
        : { error: { message: 'Usuario o contraseña incorrectos' } }
    } else {
      const usr = usuario.trim().toLowerCase()
      const libre = await supabase.rpc('usuario_disponible', { p_usuario: usr })
      if (libre.error || !libre.data) {
        setEnviando(false)
        return setMsg({ tipo: 'error', texto: /^[a-z0-9._-]{3,20}$/.test(usr) ? 'Ese nombre de usuario ya está en uso. Elegí otro.' : 'El usuario debe tener de 3 a 20 caracteres: letras, números, punto, guion o guion bajo.' })
      }
      res = await supabase.auth.signUp({ email, password: clave, options: { data: { usuario: usr, nombre: nombre.trim(), apellido: apellido.trim(), referente: referente.trim(), mayor_de_edad: 'true', registro_app: 'true' } } })
    }
    setEnviando(false)
    if (res.error) {
      const m = res.error.message || ''
      return setMsg({ tipo: 'error', texto: /banned/i.test(m) ? 'Tu cuenta está suspendida. Consultá con el administrador del club.' : m })
    }
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
        {modo === 'ingresar' ? (
          <>
            <label htmlFor="ident">Usuario o correo</label>
            <input id="ident" autoCapitalize="none" autoCorrect="off" value={ident} onChange={(e) => setIdent(e.target.value)} required />
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" type="password" minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} required />
            <button type="button" className="btn" style={{ marginTop: 10 }} onClick={olvide}>Olvidé mi clave</button>
          </>
        ) : (
          <>
            <label htmlFor="usuario">Usuario</label>
            <input id="usuario" autoCapitalize="none" autoCorrect="off" maxLength={20} value={usuario} onChange={(e) => setUsuario(e.target.value)} required />
            <p className="mu" style={{ marginTop: 6 }}>Es el que vas a usar para ingresar, en lugar del correo si querés.</p>
            <label htmlFor="nombre">Nombre</label>
            <input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required />
            <label htmlFor="apellido">Apellido</label>
            <input id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} required />
            <label htmlFor="email">Correo</label>
            <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label htmlFor="clave">Contraseña</label>
            <input id="clave" type="password" minLength={6} value={clave} onChange={(e) => setClave(e.target.value)} required />
            <label htmlFor="referente">Número de socio o apodo de quien te invitó (opcional)</label>
            <input id="referente" value={referente} onChange={(e) => setReferente(e.target.value)} />
            <p className="mu" style={{ marginTop: 6 }}>Si lo escribís bien, esa persona suma puntos una sola vez, cuando te hagas Gold (al confirmarse tu primera cuota).</p>
            <label htmlFor="mayor" style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 14 }}>
              <input id="mayor" type="checkbox" style={{ width: 'auto' }} checked={mayor} onChange={(e) => setMayor(e.target.checked)} required />
              Confirmo que soy mayor de 18 años
            </label>
          </>
        )}
        <button className="btn pri" style={{ width: '100%', marginTop: 16 }} disabled={enviando}>
          {modo === 'ingresar' ? 'Ingresar' : 'Crear mi cuenta'}
        </button>
        <Msg m={msg} />
      </form>
    </div>
  )
}
