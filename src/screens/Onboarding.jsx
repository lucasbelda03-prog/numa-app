import { useState } from 'react'
import { Icon, Logo, Paw } from '../components.jsx'
import { api } from '../lib/api.js'
import { isoDate, addDays } from '../lib/metrics.js'

export function Welcome({ onStart, onLogin }) {
  return (
    <div className="screen welcome">
      <Logo size={56} color="var(--cream)" paws="var(--sand)" />
      <div className="art" aria-hidden="true">
        <svg width="220" height="220" viewBox="0 0 220 220">
          <circle cx="110" cy="110" r="100" fill="rgba(255,255,255,.04)" />
          <circle cx="110" cy="110" r="72" fill="rgba(255,255,255,.05)" />
          <path d="M58 132a56 56 0 1 1 104 0" fill="none" stroke="var(--sage)" strokeWidth="14" strokeLinecap="round" />
          <rect x="92" y="128" width="36" height="28" rx="8" fill="var(--clay)" />
          <circle cx="110" cy="142" r="4" fill="var(--sand)" />
        </svg>
      </div>
      <h1 className="display">Ellos no pueden decirte qué les pasa.</h1>
      <p className="body" style={{ color: 'rgba(255,255,255,.8)', marginTop: 10 }}>
        Nüma aprende cómo es tu perro y te avisa cuando algo cambia.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 32 }}>
        <button className="btn btn-light" onClick={onStart}>Crear cuenta</button>
        <button className="btn btn-ghost" style={{ color: 'var(--cream)' }} onClick={onLogin}>Ya tengo cuenta</button>
      </div>
    </div>
  )
}

export function Auth({ initialMode = 'signup', onBack, onDone }) {
  const [mode, setMode] = useState(initialMode)
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [confirm, setConfirm] = useState(false)
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const valid = f.email.includes('@') && f.password.length >= 6 && (mode === 'login' || f.name.trim().length > 1)

  async function submit(e) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true); setErr('')
    try {
      const r = mode === 'signup' ? await api.signUp(f) : await api.signIn(f)
      if (r.needsConfirm) setConfirm(true)
      else onDone(r.user)
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  if (confirm) {
    return (
      <div className="screen"><div className="center-state">
        <div className="icon-chip" style={{ width: 64, height: 64, borderRadius: 20 }}><Icon name="mail" size={30} /></div>
        <h1 className="title">Revisá tu email</h1>
        <p className="body">Te mandamos un link a <b>{f.email}</b> para confirmar tu cuenta. Después volvé y tocá «Ya tengo cuenta».</p>
        <button className="btn btn-primary" onClick={() => { setConfirm(false); setMode('login') }}>Entendido</button>
      </div></div>
    )
  }

  return (
    <div className="screen"><div className="scroll"><form className="content" onSubmit={submit} noValidate>
      <div className="topbar"><button type="button" className="icon-btn" onClick={onBack} aria-label="Volver"><Icon name="back" /></button></div>
      <div>
        <h1 className="title">{mode === 'signup' ? 'Creá tu cuenta' : 'Hola de nuevo'}</h1>
        <p className="body" style={{ marginTop: 6 }}>{mode === 'signup' ? 'Vas a poder ver cómo está tu perro desde cualquier lugar.' : 'Entrá para ver cómo está tu perro.'}</p>
      </div>
      <div className="segmented" role="group" aria-label="Tipo de acceso">
        <button type="button" aria-pressed={mode === 'signup'} onClick={() => setMode('signup')}>Crear cuenta</button>
        <button type="button" aria-pressed={mode === 'login'} onClick={() => setMode('login')}>Iniciar sesión</button>
      </div>
      {mode === 'signup' && (
        <label className="field"><span>Nombre</span>
          <input className="input" autoComplete="name" value={f.name} onChange={set('name')} placeholder="Juan García" /></label>
      )}
      <label className="field"><span>Email</span>
        <input className="input" type="email" inputMode="email" autoComplete="email" value={f.email} onChange={set('email')} placeholder="tu@email.com" /></label>
      <label className="field"><span>Contraseña</span>
        <input className="input" type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={f.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" /></label>
      {err && <div className="error" role="alert"><Icon name="info" size={18} />{err}</div>}
      <button className="btn btn-primary" type="submit" disabled={!valid || busy} style={{ marginTop: 4 }}>
        {busy ? 'Un momento…' : mode === 'signup' ? 'Crear cuenta' : 'Entrar'}
      </button>
      {mode === 'signup' && <p className="caption" style={{ textAlign: 'center' }}>Tus datos y los de tu perro no se comparten sin tu autorización.</p>}
    </form></div></div>
  )
}

const BREEDS = ['Golden retriever', 'Labrador retriever', 'Caniche', 'Bulldog francés', 'Ovejero alemán', 'Border collie', 'Beagle', 'Mestizo', 'Otra']

export function DogSetup({ onDone }) {
  const [f, setF] = useState({ name: '', breed: 'Golden retriever', age: '', weight: '', sex: 'female', neutered: true, known_conditions: '' })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const age = Number(f.age), weight = Number(String(f.weight).replace(',', '.'))
  const valid = f.name.trim() && age > 0 && age < 30 && weight > 0 && weight < 150

  async function submit(e) {
    e.preventDefault()
    if (!valid || busy) return
    setBusy(true); setErr('')
    try {
      const dog = await api.createDog({
        name: f.name.trim(), breed: f.breed, sex: f.sex, neutered: f.neutered,
        weight_kg: weight, birth_date: isoDate(addDays(new Date(), -Math.round(age * 365.25))),
        known_conditions: f.known_conditions.trim() || null,
      })
      onDone(dog)
    } catch (ex) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <div className="screen"><div className="scroll"><form className="content" onSubmit={submit} noValidate>
      <div className="topbar"><div className="progress" aria-label="Paso 1 de 3"><i className="on" /><i /><i /></div></div>
      <div>
        <h1 className="title">Contanos sobre tu perro</h1>
        <p className="body" style={{ marginTop: 6 }}>Con esto le damos contexto a sus datos y personalizamos las recomendaciones.</p>
      </div>
      <div style={{ display: 'grid', placeItems: 'center', padding: '4px 0' }}>
        <div className="avatar" style={{ width: 88, height: 88, fontSize: 34 }}>{f.name ? f.name[0].toUpperCase() : <Paw size={38} />}</div>
      </div>
      <label className="field"><span>Nombre</span><input className="input" value={f.name} onChange={set('name')} placeholder="Lola" autoComplete="off" /></label>
      <label className="field"><span>Raza</span>
        <select className="input" value={f.breed} onChange={set('breed')}>{BREEDS.map((b) => <option key={b}>{b}</option>)}</select></label>
      <div className="row-2">
        <label className="field"><span>Edad (años)</span><input className="input" inputMode="numeric" value={f.age} onChange={set('age')} placeholder="4" /></label>
        <label className="field"><span>Peso (kg)</span><input className="input" inputMode="decimal" value={f.weight} onChange={set('weight')} placeholder="29" /></label>
      </div>
      <div className="field"><span>Sexo</span>
        <div className="segmented" role="group" aria-label="Sexo">
          <button type="button" aria-pressed={f.sex === 'female'} onClick={() => setF({ ...f, sex: 'female' })}>Hembra</button>
          <button type="button" aria-pressed={f.sex === 'male'} onClick={() => setF({ ...f, sex: 'male' })}>Macho</button>
        </div></div>
      <div className="field"><span>¿Está {f.sex === 'female' ? 'castrada' : 'castrado'}?</span>
        <div className="segmented" role="group" aria-label="Castración">
          <button type="button" aria-pressed={f.neutered} onClick={() => setF({ ...f, neutered: true })}>Sí</button>
          <button type="button" aria-pressed={!f.neutered} onClick={() => setF({ ...f, neutered: false })}>No</button>
        </div></div>
      <label className="field"><span>Condiciones diagnosticadas (opcional)</span>
        <input className="input" value={f.known_conditions} onChange={set('known_conditions')} placeholder="Ninguna" /></label>
      {err && <div className="error" role="alert"><Icon name="info" size={18} />{err}</div>}
      <button className="btn btn-primary" type="submit" disabled={!valid || busy}>{busy ? 'Guardando…' : 'Continuar'}</button>
    </form></div></div>
  )
}

export function Pair({ dog, onDone }) {
  const [state, setState] = useState('idle')
  const [err, setErr] = useState('')
  const [device, setDevice] = useState(null)
  function search() { setState('searching'); setTimeout(() => setState('found'), 1800) }
  async function link() {
    setState('linking'); setErr('')
    try { setDevice(await api.pairCollar(dog)); setState('linked') } catch (ex) { setErr(ex.message); setState('found') }
  }
  return (
    <div className="screen"><div className="scroll"><div className="content">
      <div className="topbar"><div className="progress" aria-label="Paso 2 de 3"><i className="on" /><i className="on" /><i /></div></div>
      <div>
        <h1 className="title">{state === 'linked' ? '¡Collar vinculado!' : 'Vinculá el collar'}</h1>
        <p className="body" style={{ marginTop: 6 }}>
          {state === 'linked' ? `El collar de ${dog.name} ya está enviando datos.` : 'Mantené presionado el botón del collar 3 segundos y acercalo al celular.'}
        </p>
      </div>
      {state !== 'linked' ? (
        <div className="radar" aria-hidden="true">{state === 'searching' && <><span /><span /><span /></>}<div className="core"><Icon name="bluetooth" size={28} /></div></div>
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', margin: '24px 0' }}>
          <div style={{ width: 112, height: 112, borderRadius: '50%', background: 'var(--green)', color: '#fff', display: 'grid', placeItems: 'center' }}><Icon name="check" size={52} stroke={2.6} /></div>
        </div>
      )}
      {state === 'idle' && <button className="btn btn-primary" onClick={search}>Buscar mi collar</button>}
      {state === 'searching' && <p className="callout" role="status" style={{ textAlign: 'center' }}>Buscando collares cerca…</p>}
      {(state === 'found' || state === 'linking') && (
        <>
          <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="icon-chip" style={{ width: 48, height: 48, borderRadius: 14 }}><Icon name="collar" size={26} /></div>
            <div className="grow"><div style={{ fontWeight: 700 }}>Collar Nüma</div><div className="caption">Batería 100% · señal excelente</div></div>
          </div>
          {err && <div className="error" role="alert"><Icon name="info" size={18} />{err}</div>}
          <button className="btn btn-primary" onClick={link} disabled={state === 'linking'}>{state === 'linking' ? 'Vinculando…' : `Vincular a ${dog.name}`}</button>
        </>
      )}
      {state === 'linked' && (
        <>
          <div className="card card-tight">
            <div className="list-row"><div className="grow">Número de serie</div><div className="end">{device?.serial}</div></div>
            <div className="list-row"><div className="grow">Batería</div><div className="end">{device?.battery_pct ?? 100}%</div></div>
          </div>
          <button className="btn btn-primary" onClick={onDone}>Continuar</button>
        </>
      )}
    </div></div></div>
  )
}

export function Fit({ dog, onDone }) {
  const tips = [
    ['ruler', 'Regla de los dos dedos', 'Entre el collar y el cuello tienen que entrar dos dedos.'],
    ['heart', 'Sensor debajo del cuello', 'El módulo va apoyado en la parte inferior del cuello.'],
    ['battery', 'Carga cada varios días', 'Te avisamos cuando la batería esté baja. Es resistente al agua.'],
  ]
  return (
    <div className="screen"><div className="scroll"><div className="content">
      <div className="topbar"><div className="progress" aria-label="Paso 3 de 3"><i className="on" /><i className="on" /><i className="on" /></div></div>
      <div>
        <h1 className="title">Colocalo bien</h1>
        <p className="body" style={{ marginTop: 6 }}>Un collar bien ajustado mide mejor.</p>
      </div>
      <div className="card card-tight">
        {tips.map(([i, t, s]) => (
          <div key={t} className="list-row"><div className="icon-chip"><Icon name={i} size={19} /></div>
            <div className="grow"><div className="title-sm">{t}</div><div className="sub">{s}</div></div></div>
        ))}
      </div>
      <div className="card" style={{ background: 'var(--sage-50)', boxShadow: 'none' }}>
        <div className="headline" style={{ fontSize: 16 }}>Las primeras dos semanas, Nüma aprende</div>
        <p className="callout" style={{ marginTop: 6 }}>Durante 14 días registra cómo es {dog.name} normalmente. Después compara cada día con su propio patrón y te avisa si algo cambia de forma sostenida.</p>
      </div>
      <button className="btn btn-primary" onClick={onDone}>Empezar</button>
    </div></div></div>
  )
}
