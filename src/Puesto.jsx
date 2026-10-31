// Indicador de posición: medalla para el podio y flecha contra el período anterior.
const MEDALLAS = { 1: ['#d4af37', 'oro'], 2: ['#b8c0c8', 'plata'], 3: ['#cd7f32', 'bronce'] }

export default function Puesto({ pos, anterior }) {
  const m = MEDALLAS[pos]
  let flecha
  if (anterior == null) {
    flecha = <span className="mu" style={{ fontSize: 12 }}>Nuevo</span>
  } else if (anterior > pos) {
    flecha = <span style={{ color: '#3fb950', fontSize: 13 }} title={'Antes: puesto ' + anterior} aria-label={'Subió ' + (anterior - pos)}>▲{anterior - pos}</span>
  } else if (anterior < pos) {
    flecha = <span style={{ color: '#f85149', fontSize: 13 }} title={'Antes: puesto ' + anterior} aria-label={'Bajó ' + (pos - anterior)}>▼{pos - anterior}</span>
  } else {
    flecha = <span className="mu" style={{ fontSize: 13 }} aria-label="Sin cambios">=</span>
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span
        aria-label={'Puesto ' + pos + (m ? ' (' + m[1] + ')' : '')}
        style={{
          width: 26, height: 26, borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 13, background: m ? m[0] : 'transparent', color: m ? '#1a1a1a' : 'inherit',
          border: m ? 'none' : '1px solid rgba(160,160,160,.5)',
        }}>{pos}</span>
      {flecha}
    </span>
  )
}
