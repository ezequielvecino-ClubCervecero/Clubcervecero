// Nombre de usuario para ingresar (alternativa al correo).
import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

export default function MiUsuario({ actual, onListo }) {
  const [usuario, setUsuario] = useState(actual || '')
  const [msg, setMsg] = useState(null)

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.rpc('cambiar_mi_usuario', { p_usuario: usuario })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Listo. Desde ahora podés ingresar con "' + usuario.trim().toLowerCase() + '" o con tu correo.' })
    if (onListo) onListo()
  }

  return (
    <form onSubmit={guardar}>
      <p className="mu">Con tu usuario podés ingresar en lugar del correo. De 3 a 20 caracteres: letras, números, punto, guion o guion bajo.</p>
      <label htmlFor="mu-u">Usuario</label>
      <input id="mu-u" value={usuario} maxLength={20} autoCapitalize="none" autoCorrect="off" onChange={(e) => setUsuario(e.target.value)} required />
      <button className="btn pri" style={{ marginTop: 12 }}>Guardar usuario</button>
      <Msg m={msg} />
    </form>
  )
}

// Para pantallas que no tienen el perfil a mano (administrador y personal): lo busca solo.
export function MiUsuarioPropio() {
  const [actual, setActual] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const id = data && data.user ? data.user.id : null
      if (!id) return setActual('')
      supabase.from('perfiles').select('usuario').eq('id', id).single().then((r) => setActual((r.data && r.data.usuario) || ''))
    })
  }, [])
  if (actual === null) return <p className="mu">Cargando...</p>
  return <MiUsuario actual={actual} />
}
