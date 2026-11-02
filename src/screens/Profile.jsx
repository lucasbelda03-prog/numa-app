import { useState } from 'react'
import { Icon } from '../components.jsx'
import { MODE } from '../lib/api.js'
import { STORY, BASELINE_DAYS, fmtNum, fmtDM, parseISO } from '../lib/metrics.js'

export function Profile({ data, user, busy, onSetDay, onReset, onPlans, onSignOut }) {
  const { dog, device, day, subscription, profile } = data
  const premium = subscription?.plan_code === 'premium'
  const [confirmReset, setConfirmReset] = useState(false)
  const presets = [
    [BASELINE_DAYS, 'Fin del aprendizaje', `Día ${BASELINE_DAYS}`],
    [STORY.normalDay, 'Un día normal', `Día ${STORY.normalDay}`],
    [STORY.alertDay, 'Cambio de comportamiento', `Día ${STORY.alertDay}`],
  ]
  return (
    <div className="scroll"><div className="content">
      <h1 className="title">Perfil</h1>

      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div className="avatar" style={{ background: 'var(--green)', color: '#fff' }}>{(profile?.full_name || user?.email || '?')[0].toUpperCase()}</div>
        <div style={{ minWidth: 0 }}><div className="headline" style={{ fontSize: 16 }}>{profile?.full_name || 'Tu cuenta'}</div>
          <div className="caption" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{user?.email}</div></div>
      </div>

      <div className="section-title"><h2>Tu plan</h2></div>
      <button className="card list-row" style={{ padding: 18, borderBottom: 0 }} onClick={onPlans}>
        <div className="icon-chip" style={premium ? { background: 'var(--green-900)', color: 'var(--sand)' } : undefined}><Icon name={premium ? 'spark' : 'star'} size={18} /></div>
        <div className="grow"><div className="title-sm">{premium ? 'Premium' : 'Básico'}</div>
          <div className="sub">{premium ? `Prueba sin cargo hasta el ${subscription.trial_ends_at ? fmtDM(new Date(subscription.trial_ends_at)) : '—'}` : 'Gratis, incluido con el collar'}</div></div>
        <span className="caption" style={{ fontWeight: 700, color: 'var(--green)' }}>{premium ? 'Gestionar' : 'Mejorar'}</span>
      </button>

      <div className="section-title"><h2>{dog.name}</h2></div>
      <div className="card card-tight">
        <div className="list-row"><div className="grow">Raza</div><div className="end">{dog.breed}</div></div>
        <div className="list-row"><div className="grow">Peso</div><div className="end">{fmtNum(dog.weight_kg, dog.weight_kg % 1 ? 1 : 0)} kg</div></div>
        <div className="list-row"><div className="grow">Monitoreo desde</div><div className="end">{dog.monitoring_started_on ? fmtDM(parseISO(dog.monitoring_started_on)) : '—'}</div></div>
      </div>

      <div className="section-title"><h2>Collar</h2></div>
      <div className="card card-tight">
        <div className="list-row"><div className="icon-chip"><Icon name="collar" size={18} /></div><div className="grow"><div className="title-sm">Collar Nüma</div><div className="sub">{device?.serial}</div></div>
          <span className="pill pill-ok">Conectado</span></div>
        <div className="list-row"><div className="grow">Batería</div><div className="end">{device?.battery_pct ?? 100}%</div></div>
        <div className="list-row"><div className="grow">Firmware</div><div className="end">{device?.firmware_version ?? '1.0.0'}</div></div>
      </div>

      <div className="section-title"><h2>Simulación</h2><span>para la demostración</span></div>
      <div className="card">
        <p className="callout">Como el collar todavía no existe, la app simula sus datos. Elegí en qué día de monitoreo querés ver a {dog.name}.</p>
        <div className="stepper" style={{ margin: '14px 0' }}>
          <button className="icon-btn" onClick={() => onSetDay(Math.max(1, day - 1))} disabled={busy || day <= 1} aria-label="Retroceder un día"><Icon name="minus" /></button>
          <div className="day" aria-live="polite">Día {day}</div>
          <button className="icon-btn" onClick={() => onSetDay(Math.min(90, day + 1))} disabled={busy || day >= 90} aria-label="Avanzar un día"><Icon name="plus" /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {presets.map(([d, t, s]) => (
            <button key={d} className="list-row" onClick={() => onSetDay(d)} disabled={busy} aria-pressed={day === d}>
              <div className="icon-chip" style={day === d ? { background: 'var(--green)', color: '#fff' } : undefined}><Icon name="play" size={15} /></div>
              <div className="grow"><div className="title-sm">{t}</div><div className="sub">{s}</div></div>
              {day === d && <Icon name="check" size={18} stroke={2.6} />}
            </button>
          ))}
        </div>
        {!confirmReset
          ? <button className="btn btn-ghost" onClick={() => setConfirmReset(true)} disabled={busy}><Icon name="reset" size={17} />Reiniciar simulación</button>
          : <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
              <button className="btn btn-secondary" style={{ minHeight: 46 }} onClick={() => setConfirmReset(false)}>Cancelar</button>
              <button className="btn btn-primary" style={{ minHeight: 46, background: 'var(--clay)' }} onClick={() => { setConfirmReset(false); onReset() }}>Borrar y reiniciar</button>
            </div>}
        {busy && <p className="caption" role="status" style={{ textAlign: 'center' }}>Sincronizando datos…</p>}
      </div>

      <button className="btn btn-secondary" onClick={onSignOut}><Icon name="logout" size={18} />Cerrar sesión</button>
      <p className="caption" style={{ textAlign: 'center' }}>Nüma · prototipo académico{MODE === 'demo' ? ' · modo sin conexión' : ''}</p>
    </div></div>
  )
}

export function Plans({ data, onBack, onStart, onCancel, busy }) {
  const premium = data.subscription?.plan_code === 'premium'
  const [basic, prem] = data.plans
  const [confirm, setConfirm] = useState(false)
  return (
    <div className="screen"><div className="scroll"><div className="content">
      <div className="topbar"><button className="icon-btn" onClick={onBack} aria-label="Volver"><Icon name="back" /></button></div>
      <div><h1 className="title">Planes</h1><p className="body" style={{ marginTop: 6 }}>El collar incluye el Plan Básico sin costo mensual.</p></div>
      <div className="plan">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div className="headline">{basic.name}</div>{!premium && <span className="pill pill-ok">Tu plan</span>}</div>
        <div className="price" style={{ marginTop: 6 }}>Gratis <small>con el collar</small></div>
        <ul>{basic.features.map((t) => <li key={t}><Icon name="check" size={17} stroke={2.6} />{t}</li>)}</ul>
      </div>
      <div className="plan featured">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="headline" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="spark" size={18} />{prem.name}</div>
          {premium ? <span className="badge-sand">Tu plan</span> : <span className="badge-sand">3 meses sin cargo</span>}
        </div>
        <div className="price" style={{ marginTop: 6 }}>USD {prem.price_usd_month} <small>por mes</small></div>
        <ul>{prem.features.map((t) => <li key={t}><Icon name="check" size={17} stroke={2.6} />{t}</li>)}</ul>
        {!premium && <button className="btn btn-sand" style={{ marginTop: 18 }} onClick={onStart} disabled={busy}>{busy ? 'Activando…' : 'Probar 3 meses gratis'}</button>}
      </div>
      {premium && (!confirm
        ? <button className="btn-danger-link" onClick={() => setConfirm(true)}>Dar de baja Premium</button>
        : <div className="card">
            <p className="callout">Vas a volver al Plan Básico. Mantenés el seguimiento, las alertas y los informes.</p>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button className="btn btn-secondary" style={{ minHeight: 46 }} onClick={() => setConfirm(false)}>Mantener</button>
              <button className="btn btn-primary" style={{ minHeight: 46, background: 'var(--clay)' }} onClick={onCancel} disabled={busy}>Confirmar baja</button>
            </div>
          </div>)}
      <p className="caption">Sin permanencia. Podés darte de baja en cualquier momento desde esta pantalla.</p>
    </div></div></div>
  )
}
