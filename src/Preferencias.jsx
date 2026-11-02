// Preferencias de cada persona: tema de color (y, más adelante, avisos).
import { useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

const TEMAS = [['', 'Predeterminado del club'], ['violeta', 'Violeta'], ['claro', 'Claro'], ['oscuro', 'Oscuro']]

export default function Preferencias({ perfil }) {
  const [tema, setTema] = useState(perfil.tema || '')
  const [msg, setMsg] = useState(null)

  async function elegir(t) {
    setMsg(null)
    const { error } = await supabase.rpc('guardar_mi_tema', { p_tema: t || null })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setTema(t)
    window.dispatchEvent(new CustomEvent('perfil-tema', { detail: t || null }))
    setMsg({ tipo: 'ok', texto: 'Listo, tema cambiado.' })
  }

  return (
    <div className="card">
      <h3>Tema de color</h3>
      <p className="mu">Elegí cómo ver la app en tu cuenta. "Predeterminado del club" usa el tema que define el administrador.</p>
      <div className="chips chips-parejos">
        {TEMAS.map(([id, nombre]) => (
          <button key={id || 'def'} type="button" className={'chip' + (tema === id ? ' on' : '')} onClick={() => elegir(id)}>{nombre}</button>
        ))}
      </div>
      <Msg m={msg} />
    </div>
  )
}
