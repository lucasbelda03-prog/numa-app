import { useState } from 'react'
import { Icon, NavBar } from '../components.jsx'
import { MODE } from '../lib/api.js'
import { STORY, BASELINE_DAYS, fmtNum, fmtDM, parseISO } from '../lib/metrics.js'

export function Profile({ data, user, busy, onBack, onSetDay, onReset, onPlans, onSignOut }) {
  const { dog, device, day, subscription, profile } = data
  const premium = subscription?.plan_code === 'premium'
  const [confirmReset, setConfirmReset] = useState(false)
  const presets = [
    [BASELINE_DAYS, 'Fin del aprendizaje', `Día ${BASELINE_DAYS} · ya tiene su patrón`],
    [STORY.normalDay, 'Un día normal', `Día ${STORY.normalDay} · todo como siempre`],
    [STORY.alertDay, 'Cambio de comportamiento', `Día ${STORY.alertDay} · aparece la alerta`],
  ]
  return (
    <div className="screen push"><div className="scroll"><div className="page">
      <NavBar onBack={onBack} />
      <h1 className="large-title">Perfil</h1>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="avatar" style={{ background: 'var(--green)', color: '#fff' }}>{(profile?.full_name || user?.email || '?')[0].toUpperCase()}</div>
        <div style={{ minWidth: 0 }}><div className="headline">{profile?.full_name || 'Tu cuenta'}</div>
          <div className="caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div></div>
      </div>

      <h2 className="section">Simulación</h2>
      <div className="card">
        <p className="callout">Como el collar todavía no existe, la app simula sus datos. Elegí qué día de {dog.name} querés mostrar.</p>
        <div className="stepper" style={{ margin: '14px 0 6px' }}>
          <button className="icon-btn" onClick={() => onSetDay(Math.max(1, day - 1))} disabled={busy || day <= 1} aria-label="Retroceder un día"><Icon name="minus" /></button>
          <div className="day" aria-live="polite">Día {day}</div>
          <button className="icon-btn" onClick={() => onSetDay(Math.min(90, day + 1))} disabled={busy || day >= 90} aria-label="Avanzar un día"><Icon name="plus" /></button>
        </div>
        {presets.map(([d, t, s]) => (
          <button key={d} className="row" onClick={() => onSetDay(d)} disabled={busy} aria-pressed={day === d}>
            <span className="bubble-ic" style={day === d ? { background: 'var(--green)', color: '#fff' } : { background: 'var(--green-50)', color: 'var(--green)' }}><Icon name="play" size={16} /></span>
            <span className="grow"><span className="t" style={{ display: 'block' }}>{t}</span><span className="s" style={{ display: 'block' }}>{s}</span></span>
            {day === d && <span style={{ color: 'var(--green)' }}><Icon name="check" size={20} stroke={2.6} /></span>}
          </button>
        ))}
        {!confirmReset
          ? <button className="btn btn-ghost" onClick={() => setConfirmReset(true)} disabled={busy}><Icon name="reset" size={17} />Volver al día 1</button>
          : <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => setConfirmReset(false)}>Cancelar</button>
              <button className="btn btn-danger" style={{ minHeight: 48 }} onClick={() => { setConfirmReset(false); onReset() }}>Borrar y reiniciar</button>
            </div>}
        {busy && <p className="caption" role="status" style={{ textAlign: 'center' }}>Sincronizando datos…</p>}
      </div>

      <h2 className="section">Tu plan</h2>
      <div className="group">
        <button className="row" onClick={onPlans}>
          <span className="bubble-ic" style={premium ? { background: 'var(--green)', color: '#fff' } : { background: 'var(--amber-50)', color: 'var(--amber-ink)' }}><Icon name={premium ? 'spark' : 'star'} size={20} /></span>
          <span className="grow"><span className="t" style={{ display: 'block' }}>{premium ? 'Premium' : 'Básico'}</span>
            <span className="s" style={{ display: 'block' }}>{premium ? `Prueba sin cargo hasta el ${subscription.trial_ends_at ? fmtDM(new Date(subscription.trial_ends_at)) : '—'}` : 'Gratis, incluido con el collar'}</span></span>
          <span style={{ color: 'var(--green)', fontWeight: 750, fontSize: 14.5 }}>{premium ? 'Gestionar' : 'Ver planes'}</span>
        </button>
      </div>

      <h2 className="section">{dog.name}</h2>
      <div className="group">
        <div className="row"><span className="grow">Raza</span><span className="end">{dog.breed}</span></div>
        <div className="row"><span className="grow">Peso</span><span className="end">{fmtNum(dog.weight_kg, dog.weight_kg % 1 ? 1 : 0)} kg</span></div>
        <div className="row"><span className="grow">Monitoreo desde</span><span className="end">{dog.monitoring_started_on ? fmtDM(parseISO(dog.monitoring_started_on)) : '—'}</span></div>
      </div>

      <h2 className="section">Collar</h2>
      <div className="group">
        <div className="row"><span className="bubble-ic tint-ic c-leaf"><Icon name="collar" size={20} /></span>
          <span className="grow"><span className="t" style={{ display: 'block' }}>Collar Nüma</span><span className="s" style={{ display: 'block' }}>{device?.serial}</span></span>
          <span className="chip chip-ok">Conectado</span></div>
        <div className="row"><span className="grow">Batería</span><span className="end">{device?.battery_pct ?? 100}%</span></div>
        <div className="row"><span className="grow">Firmware</span><span className="end">{device?.firmware_version ?? '1.0.0'}</span></div>
      </div>

      <button className="btn btn-secondary" style={{ marginTop: 8 }} onClick={onSignOut}><Icon name="logout" size={18} />Cerrar sesión</button>
      <p className="caption" style={{ textAlign: 'center' }}>Nüma · prototipo académico{MODE === 'demo' ? ' · modo sin conexión' : ''}</p>
    </div></div></div>
  )
}

export function Plans({ data, onBack, onStart, onCancel, busy }) {
  const premium = data.subscription?.plan_code === 'premium'
  const [basic, prem] = data.plans
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="screen push"><div className="scroll"><div className="page">
      <NavBar onBack={onBack} backLabel="Perfil" />
      <div><h1 className="large-title">Planes</h1><p className="body" style={{ marginTop: 8 }}>El collar incluye el Plan Básico sin costo mensual.</p></div>
      <div className="plan">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="headline">{basic.name}</div>{!premium && <span className="chip chip-ok">Tu plan</span>}</div>
        <div className="price" style={{ marginTop: 6 }}>Gratis <small>con el collar</small></div>
        <ul>{basic.features.map((t) => <li key={t}><Icon name="check" size={18} stroke={2.6} />{t}</li>)}</ul>
      </div>
      <div className="plan featured">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="headline" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><span style={{ color: 'var(--green)' }}><Icon name="spark" size={20} /></span>{prem.name}</div>
          {premium ? <span className="chip chip-ok">Tu plan</span> : <span className="badge">3 meses sin cargo</span>}
        </div>
        <div className="price" style={{ marginTop: 6 }}>USD {prem.price_usd_month} <small>por mes</small></div>
        <ul>{prem.features.map((t) => <li key={t}><Icon name="check" size={18} stroke={2.6} />{t}</li>)}</ul>
        {!premium && <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onStart} disabled={busy}>{busy ? 'Activando…' : 'Probar 3 meses gratis'}</button>}
      </div>
      {premium && (!confirm
        ? <button className="link-danger" onClick={() => setConfirm(true)}>Dar de baja Premium</button>
        : <div className="card">
            <p className="callout">Vas a volver al Plan Básico. Mantenés el seguimiento, las alertas y los informes.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" style={{ minHeight: 48 }} onClick={() => setConfirm(false)}>Mantener</button>
              <button className="btn btn-danger" style={{ minHeight: 48 }} onClick={onCancel} disabled={busy}>Confirmar baja</button>
            </div>
          </div>)}
      <p className="caption">Sin permanencia. Podés darte de baja en cualquier momento desde esta pantalla.</p>
    </div></div></div>
  )
}
