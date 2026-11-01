// Administración de usuarios (solo administrador): ver y editar nombre, apellido y apodo,
// mandar el correo para restablecer la clave y suspender o reactivar la cuenta.
import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { Msg } from './ui'

const ROLES = { socio: 'Socio', personal: 'Personal', admin: 'Administrador', productor: 'Productor' }

function Ficha({ u, onCambio }) {
  const [f, setF] = useState({ nombre: u.nombre || '', apellido: u.apellido || '', apodo: u.apodo || '' })
  const [msg, setMsg] = useState(null)

  async function guardar(e) {
    e.preventDefault()
    setMsg(null)
    const { error } = await supabase.rpc('admin_editar_usuario', { p_id: u.id, p_nombre: f.nombre, p_apellido: f.apellido, p_apodo: f.apodo })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: 'Datos guardados.' })
    onCambio()
  }

  async function restablecer() {
    setMsg(null)
    if (!window.confirm('¿Mandar a ' + u.email + ' un correo para que elija una clave nueva?')) return
    const { error } = await supabase.auth.resetPasswordForEmail(u.email, { redirectTo: window.location.origin })
    setMsg(error ? { tipo: 'error', texto: error.message } : { tipo: 'ok', texto: 'Correo enviado a ' + u.email + '. La persona elige su clave nueva desde el enlace.' })
  }

  async function suspender() {
    setMsg(null)
    const suspender = !u.suspendido
    const pregunta = suspender
      ? '¿Suspender a ' + (u.nombre || u.email) + '? No va a poder ingresar. Su historial queda intacto y lo podés reactivar cuando quieras.'
      : '¿Reactivar la cuenta de ' + (u.nombre || u.email) + '?'
    if (!window.confirm(pregunta)) return
    const { error } = await supabase.rpc('admin_suspender_usuario', { p_id: u.id, p_suspender: suspender })
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setMsg({ tipo: 'ok', texto: suspender ? 'Cuenta suspendida.' : 'Cuenta reactivada.' })
    onCambio()
  }

  return (
    <form onSubmit={guardar} style={{ marginTop: 8 }}>
      <p className="mu">Correo: {u.email}{u.usuario ? ' · Usuario: ' + u.usuario : ''}{u.telefono ? ' · Tel.: ' + u.telefono : ''}</p>
      <label htmlFor={'un-' + u.id}>Nombre</label>
      <input id={'un-' + u.id} value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} required />
      <label htmlFor={'ua-' + u.id}>Apellido</label>
      <input id={'ua-' + u.id} value={f.apellido} onChange={(e) => setF({ ...f, apellido: e.target.value })} />
      <label htmlFor={'up-' + u.id}>Apodo (vacío = sin apodo, sale del ranking)</label>
      <input id={'up-' + u.id} value={f.apodo} maxLength={20} onChange={(e) => setF({ ...f, apodo: e.target.value })} />
      <div className="row" style={{ marginTop: 10, justifyContent: 'flex-start' }}>
        <button className="btn pri">Guardar</button>
        <button type="button" className="btn" onClick={restablecer}>Enviar correo para restablecer clave</button>
        {u.rol !== 'admin' && (
          <button type="button" className="btn" onClick={suspender}>{u.suspendido ? 'Reactivar cuenta' : 'Suspender cuenta'}</button>
        )}
      </div>
      <Msg m={msg} />
    </form>
  )
}

export default function Usuarios() {
  const [lista, setLista] = useState(null)
  const [buscar, setBuscar] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [msg, setMsg] = useState(null)

  const cargar = useCallback(async () => {
    const { data, error } = await supabase.rpc('listar_usuarios')
    if (error) return setMsg({ tipo: 'error', texto: error.message })
    setLista(data || [])
  }, [])
  useEffect(() => { cargar() }, [cargar])

  const q = buscar.trim().toLowerCase()
  const filtrada = (lista || []).filter((u) => !q ||
    [u.nombre, u.apellido, u.apodo, u.usuario, u.email, String(u.numero_socio)].some((x) => (x || '').toLowerCase().includes(q)))

  return (
    <div className="card">
      <h3>Usuarios</h3>
      <p className="mu">Todos los usuarios de la app. Tocá uno para cambiar su nombre, apellido o apodo, mandarle el correo para restablecer su clave o suspender su cuenta. Nadie ve las contraseñas.</p>
      <input placeholder="Buscar por nombre, apodo, usuario o correo" value={buscar} onChange={(e) => setBuscar(e.target.value)} />
      <Msg m={msg} />
      {lista === null && !msg && <p className="mu">Cargando...</p>}
      {filtrada.map((u) => (
        <div key={u.id} className="card" style={u.suspendido ? { borderColor: '#f87171' } : undefined}>
          <button type="button" className="row" style={{ width: '100%', background: 'none', border: 0, color: 'inherit', textAlign: 'left', padding: 0 }}
            onClick={() => setAbierto(abierto === u.id ? null : u.id)}>
            <span>
              <b>{[u.nombre, u.apellido].filter(Boolean).join(' ') || 'Sin nombre'}</b>
              <span className="mu"> · N.º {String(u.numero_socio).padStart(4, '0')} · {ROLES[u.rol] || u.rol}</span>
              {u.apodo && <span className="mu"> · «{u.apodo}»</span>}
            </span>
            {u.suspendido && <span className="pill bad">Suspendido</span>}
          </button>
          {abierto === u.id && <Ficha u={u} onCambio={cargar} />}
        </div>
      ))}
      {lista && filtrada.length === 0 && <p className="mu">No hay usuarios que coincidan.</p>}
    </div>
  )
}
