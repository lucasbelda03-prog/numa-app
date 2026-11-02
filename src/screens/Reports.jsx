import { useState } from 'react'
import { Icon, Logo, TrendChart } from '../components.jsx'
import { api, changeHeadline } from '../lib/api.js'
import {
  METRICS, METRIC, BASELINE_DAYS, windowMean, pctVsBaseline, levelOf, fmtNum, fmtPct, fmtDM,
  dayToDate, isoDate, parseISO, dateToDay,
} from '../lib/metrics.js'

const ageOf = (iso) => (iso ? Math.max(0, Math.round((Date.now() - parseISO(iso)) / 31557600000)) : null)

function buildSnapshot(data, periodDays, notes) {
  const { dog, profile, day, series, baselines, alerts } = data
  const start = dog.monitoring_started_on
  const fromDay = Math.max(1, day - periodDays + 1)
  const slice = (c) => series[c].filter((p) => p.day >= fromDay && p.day <= day)
  return {
    dog: { name: dog.name, breed: dog.breed, sex: dog.sex, neutered: dog.neutered, age: ageOf(dog.birth_date), weight_kg: dog.weight_kg },
    owner: profile?.full_name || '',
    start, fromDay, toDay: day,
    metrics: METRICS.map((m) => ({
      code: m.code, baseline: baselines[m.code]?.mean ?? null,
      last7: windowMean(series, m.code, day, 7), last3: windowMean(series, m.code, day, 3),
      pct: pctVsBaseline(series, baselines, m.code, day, 3),
    })),
    baselines: { activity_minutes: baselines.activity_minutes, feeding_minutes: baselines.feeding_minutes },
    charts: { activity_minutes: slice('activity_minutes'), feeding_minutes: slice('feeding_minutes') },
    alerts: alerts.filter((a) => a.day >= fromDay && a.day <= day).map((a) => ({ day: a.day, headline: changeHeadline(dog, a.changes), codes: a.changes.map((c) => c.metric_code) })),
    notes,
  }
}

export function NewReport({ data, onBack, onCreated, initialNotes = '' }) {
  const { dog, day } = data
  const [period, setPeriod] = useState(30)
  const [notes, setNotes] = useState(initialNotes)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const ready = day >= BASELINE_DAYS

  async function create() {
    setBusy(true); setErr('')
    try {
      const snap = buildSnapshot(data, period, notes.trim())
      const rep = await api.createReport(dog, {
        period_days: period, owner_notes: notes.trim() || null, snapshot: snap,
        date_from: isoDate(dayToDate(dog.monitoring_started_on, snap.fromDay)), date_to: isoDate(dayToDate(dog.monitoring_started_on, day)),
      })
      onCreated(rep)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="screen"><div className="scroll"><div className="content">
      <div className="topbar"><button className="icon-btn" onClick={onBack} aria-label="Volver"><Icon name="back" /></button></div>
      <div><h1 className="title">Informe para el veterinario</h1>
        <p className="body" style={{ marginTop: 6 }}>Un resumen del día a día de {dog.name} para llevar a la consulta.</p></div>
      {!ready ? <p className="callout">Vas a poder armar el informe cuando termine el período de aprendizaje.</p> : <>
        <div className="field"><span>Período</span>
          <div className="segmented" role="group" aria-label="Período">
            {[30, 60, 90].map((p) => <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{p} días</button>)}
          </div></div>
        {day < period && <p className="caption">{dog.name} usa Nüma hace {day} días: el informe incluye todo el historial disponible.</p>}
        <div className="card card-tight">
          {['Patrón habitual y últimos 7 días de cada indicador', 'Gráficos de actividad y alimentación', 'Alertas del período', 'Tus observaciones'].map((t) => (
            <div key={t} className="list-row"><div className="icon-chip"><Icon name="check" size={16} stroke={2.6} /></div><div className="grow" style={{ fontSize: 15 }}>{t}</div></div>
          ))}
        </div>
        <label className="field"><span>Tus observaciones (opcional)</span>
          <textarea className="input" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Ej.: desde el jueves la noto más quieta y dejó la mitad de la comida." /></label>
        {err && <div className="error" role="alert"><Icon name="info" size={18} />{err}</div>}
        <button className="btn btn-primary" onClick={create} disabled={busy}>{busy ? 'Armando el informe…' : 'Generar informe'}</button>
        <p className="caption" style={{ textAlign: 'center' }}>Incluido en el Plan Básico.</p>
      </>}
    </div></div></div>
  )
}

export function ReportView({ report, onBack, onSnack }) {
  const s = report.snapshot
  const d = (day) => fmtDM(dayToDate(s.start, day))
  const sexTxt = s.dog.sex === 'male' ? `Macho${s.dog.neutered ? ' castrado' : ''}` : `Hembra${s.dog.neutered ? ' castrada' : ''}`
  const latest = s.alerts.find((a) => a.day >= s.toDay - 2)
  const sustained = new Set(latest?.codes ?? [])
  const list = (arr) => arr.map((m) => `${METRIC[m.code].lower} (${fmtPct(m.pct)})`).join(', ').replace(/, ([^,]*)$/, ' y $1')
  const changed = s.metrics.filter((m) => sustained.has(m.code))
  const minor = s.metrics.filter((m) => !sustained.has(m.code) && Math.abs(m.pct ?? 0) >= 8)
  const summary = (changed.length
    ? `Se registra un cambio sostenido (3 días seguidos) respecto del patrón habitual en ${list(changed)}.`
    : 'En los últimos días no se registran cambios sostenidos respecto del patrón habitual.')
    + (minor.length ? ` También hay variaciones menores en ${list(minor)}.` : ' El resto de los indicadores se mantiene cerca de su rango.')
  const shareText = `Informe Nüma de ${s.dog.name} (${d(s.fromDay)} al ${d(s.toDay)}). ${summary}${s.notes ? ` Observaciones: ${s.notes}` : ''}`

  async function share() {
    try {
      if (navigator.share) await navigator.share({ title: `Informe de ${s.dog.name}`, text: shareText })
      else { await navigator.clipboard.writeText(shareText); onSnack('Resumen copiado. Pegalo en WhatsApp o en un mail.') }
    } catch { /* el usuario canceló */ }
  }

  return (
    <div className="screen"><div className="scroll"><div className="content" style={{ paddingLeft: 14, paddingRight: 14 }}>
      <div className="topbar no-print"><button className="icon-btn" onClick={onBack} aria-label="Volver"><Icon name="back" /></button><div className="headline">Informe</div></div>
      <article className="paper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Logo size={26} />
          <span className="caption" style={{ textAlign: 'right' }}>Generado el {fmtDM(new Date(report.created_at))}/{new Date(report.created_at).getFullYear()}</span>
        </div>
        <h3>Informe de comportamiento y bienestar</h3>
        <dl className="meta">
          <dt>Perro</dt><dd><b>{s.dog.name}</b> · {[s.dog.breed, sexTxt, s.dog.age != null && `${s.dog.age} años`, s.dog.weight_kg && `${fmtNum(s.dog.weight_kg, s.dog.weight_kg % 1 ? 1 : 0)} kg`].filter(Boolean).join(' · ')}</dd>
          {s.owner && <><dt>Tutor</dt><dd>{s.owner}</dd></>}
          <dt>Período</dt><dd>{d(s.fromDay)} al {d(s.toDay)} · patrón habitual: días 1 a {BASELINE_DAYS} de monitoreo</dd>
        </dl>
        <h4>Resumen</h4><p style={{ margin: 0 }}>{summary}</p>
        <h4>Indicadores</h4>
        <table>
          <thead><tr><th>Indicador</th><th className="num">Habitual</th><th className="num">7 días</th><th className="num">3 días</th><th className="num">Var.*</th></tr></thead>
          <tbody>{s.metrics.map((r) => { const m = METRIC[r.code]; return (
            <tr key={r.code}><td>{m.short}</td>
              <td className="num">{fmtNum(r.baseline, m.decimals)}</td><td className="num">{fmtNum(r.last7, m.decimals)}</td><td className="num">{fmtNum(r.last3 ?? r.last7, m.decimals)}</td>
              <td className="num" style={{ fontWeight: 700, color: sustained.has(r.code) ? 'var(--clay)' : undefined }}>{fmtPct(r.pct)}</td></tr>) })}</tbody>
        </table>
        <p className="caption" style={{ marginTop: 6 }}>* Variación del promedio de los últimos 3 días respecto del patrón habitual.</p>
        {['activity_minutes', 'feeding_minutes'].map((c) => (
          <div key={c}><h4>{METRIC[c].name} ({METRIC[c].unit} por día)</h4>
            <TrendChart code={c} points={s.charts[c]} baseline={s.baselines[c]} from={s.fromDay} to={s.toDay} start={s.start} height={120} /></div>
        ))}
        <h4>Alertas del período</h4>
        {s.alerts.length ? s.alerts.map((a) => <p key={a.day} style={{ margin: '0 0 4px' }}>{d(a.day)} · {a.headline} (3 días seguidos).</p>) : <p style={{ margin: 0 }}>Sin alertas.</p>}
        {s.notes && <><h4>Observaciones del tutor</h4><p style={{ margin: 0 }}>“{s.notes}”</p></>}
        <p className="caption" style={{ marginTop: 18, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
          Datos de comportamiento registrados por el collar Nüma y comparados con el patrón individual del perro. No constituyen un diagnóstico clínico.
        </p>
      </article>
      <div className="row-2 no-print">
        <button className="btn btn-primary" onClick={share}><Icon name="share" size={18} />Compartir</button>
        <button className="btn btn-secondary" onClick={() => window.print()}><Icon name="download" size={18} />PDF</button>
      </div>
    </div></div></div>
  )
}

export function ReportsList({ data, onNew, onOpen }) {
  const { dog, reports } = data
  return (
    <div className="scroll"><div className="content">
      <div><h1 className="title">Informes</h1><p className="body" style={{ marginTop: 4 }}>Para compartir con el veterinario de {dog.name}.</p></div>
      <button className="btn btn-primary" onClick={onNew}><Icon name="plus" />Nuevo informe</button>
      {reports.length ? (
        <div className="card card-tight">
          {reports.map((r) => (
            <button key={r.id} className="list-row" onClick={() => onOpen(r)}>
              <div className="icon-chip"><Icon name="file" size={18} /></div>
              <div className="grow"><div className="title-sm">Informe de {r.period_days} días</div>
                <div className="sub">{fmtDM(parseISO(r.date_from))} al {fmtDM(parseISO(r.date_to))}</div></div>
              <Icon name="chevron" size={18} />
            </button>
          ))}
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: 28 }}>
          <div className="icon-chip" style={{ margin: '0 auto 12px', width: 52, height: 52, borderRadius: 16 }}><Icon name="file" size={24} /></div>
          <div className="headline" style={{ fontSize: 16 }}>Todavía no armaste informes</div>
          <p className="callout" style={{ marginTop: 6 }}>El informe resume el patrón de {dog.name}, los cambios recientes y tus observaciones.</p>
        </div>
      )}
    </div></div>
  )
}
export { dateToDay }
