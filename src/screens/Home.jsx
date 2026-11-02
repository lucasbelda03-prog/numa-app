import { useState } from 'react'
import { Icon, Ring, TrendChart } from '../components.jsx'
import {
  METRICS, METRIC, BASELINE_DAYS, valueOn, pctVsBaseline, levelOf, LEVEL_TEXT, wellbeingScore,
  fmtNum, fmtPct, fmtLong, fmtDM, dayToDate, windowMean,
} from '../lib/metrics.js'
import { changeHeadline } from '../lib/api.js'

const LEARN_AT = { activity_minutes: 4, sleep_hours: 6, rest_quality_pct: 7, feeding_minutes: 9, drinking_events: 9, scratching_episodes: 11, resting_heart_rate: 12, resting_resp_rate: 14 }
const fem = (dog) => dog.sex !== 'male'
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const ageOf = (dog) => dog.birth_date ? Math.max(0, Math.round((Date.now() - new Date(dog.birth_date)) / 31557600000)) : null

function DogHeader({ dog, date, day, alertDot, onBell }) {
  const age = ageOf(dog)
  return (
    <>
      <div className="who">
        <div className="avatar" aria-hidden="true">{dog.name[0].toUpperCase()}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="name">{dog.name}</div>
          <div className="meta">{[dog.breed, age != null && `${age} años`, dog.weight_kg && `${fmtNum(dog.weight_kg, dog.weight_kg % 1 ? 1 : 0)} kg`].filter(Boolean).join(' · ')}</div>
        </div>
        <button className="icon-btn on-dark" onClick={onBell} aria-label={alertDot ? 'Ver alerta nueva' : 'Alertas'} style={{ position: 'relative' }}>
          <Icon name="bell" />
          {alertDot && <span style={{ position: 'absolute', top: 9, right: 10, width: 10, height: 10, borderRadius: '50%', background: 'var(--clay-400)', border: '2px solid var(--green-900)' }} />}
        </button>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 16, fontSize: 13.5 }} className="muted">
        <span>{cap(fmtLong(date))}</span><span>Día {day} con Nüma</span>
      </div>
    </>
  )
}

function Learning({ data, onAdvance }) {
  const { dog, day, series } = data
  const date = dayToDate(dog.monitoring_started_on, day)
  const left = BASELINE_DAYS - day
  return (
    <div className="scroll">
      <div className="hero">
        <DogHeader dog={dog} date={date} day={day} />
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 18 }}>
          <Ring value={(day / BASELINE_DAYS) * 100} size={188} stroke={14} color="var(--sand)" track="rgba(255,255,255,.12)" label={`Aprendizaje: día ${day} de ${BASELINE_DAYS}`}>
            <div className="score">{day}<span style={{ fontSize: 22, opacity: .55, letterSpacing: 0 }}>/{BASELINE_DAYS}</span></div>
            <div className="score-label">días de aprendizaje</div>
          </Ring>
        </div>
        <p style={{ textAlign: 'center', margin: '16px 8px 0', fontSize: 15, lineHeight: 1.45 }}>
          Estamos conociendo a {dog.name}. {left > 0 ? `En ${left} ${left === 1 ? 'día' : 'días'} vamos a tener su patrón habitual y empezamos a avisarte si algo cambia.` : ''}
        </p>
      </div>
      <div className="content" style={{ paddingTop: 20 }}>
        <div className="section-title"><h2>Hoy</h2><span>datos del collar</span></div>
        <div className="metric-grid">
          {['activity_minutes', 'sleep_hours', 'feeding_minutes', 'resting_heart_rate'].map((c) => {
            const m = METRIC[c]
            return (
              <div key={c} className="metric">
                <span className="label"><Icon name={m.icon} size={15} />{m.short}</span>
                <span className="value">{fmtNum(valueOn(series, c, day), m.decimals)}<small>{m.unitShort}</small></span>
              </div>
            )
          })}
        </div>
        <div className="section-title"><h2>Patrón de cada indicador</h2></div>
        <div className="card card-tight">
          {METRICS.map((m) => {
            const ok = day >= LEARN_AT[m.code]
            return (
              <div key={m.code} className="list-row">
                <div className="icon-chip"><Icon name={m.icon} size={18} /></div>
                <div className="grow title-sm">{m.short}</div>
                {ok ? <span className="pill pill-ok"><Icon name="check" size={13} stroke={3} />Listo</span> : <span className="caption">Aprendiendo…</span>}
              </div>
            )
          })}
        </div>
        <button className="btn btn-ghost" onClick={onAdvance}><Icon name="play" size={16} />Avanzar simulación al día 14</button>
      </div>
    </div>
  )
}

export function Home({ data, onOpenAlert, onOpenMetric, onGoPremium, onGoAssistant, onAdvance }) {
  const { dog, day, series, baselines, alerts, subscription } = data
  if (day < BASELINE_DAYS) return <Learning data={data} onAdvance={onAdvance} />
  const date = dayToDate(dog.monitoring_started_on, day)
  const score = wellbeingScore(series, baselines, day)
  const active = alerts.find((a) => a.status !== 'resolved')
  const stable = score >= 80
  const scoreColor = stable ? 'var(--sand)' : 'var(--clay-400)'
  const pctOfPattern = (c) => { const b = baselines[c]?.mean; const v = valueOn(series, c, day); return b && v != null ? Math.round((v / b) * 100) : null }
  const act = pctOfPattern('activity_minutes'), food = pctOfPattern('feeding_minutes'), rest = valueOn(series, 'rest_quality_pct', day)
  const premium = subscription?.plan_code === 'premium'
  const justReady = day === BASELINE_DAYS

  return (
    <div className="scroll">
      <div className="hero">
        <DogHeader dog={dog} date={date} day={day} alertDot={active?.status === 'new'} onBell={() => active && onOpenAlert(active)} />
        <div style={{ display: 'grid', placeItems: 'center', marginTop: 14 }}>
          <Ring value={score} size={200} stroke={15} color={scoreColor} track="rgba(255,255,255,.12)" label={`Índice de bienestar ${score} de 100`}>
            <div className="score">{score}</div>
            <div className="score-label">Índice de bienestar</div>
            <div style={{ marginTop: 8 }}><span className="pill pill-dark" style={{ color: scoreColor }}>{stable ? 'Estable' : 'Cambio detectado'}</span></div>
          </Ring>
        </div>
        <div className="minis">
          {[['Actividad', 'bolt', act, '%'], ['Descanso', 'bed', rest, '%'], ['Alimentación', 'bowl', food, '%']].map(([l, i, v]) => (
            <div key={l} className="mini">
              <Ring value={v} size={64} stroke={7} color={v != null && v < 85 ? 'var(--clay-400)' : 'var(--sage)'} track="rgba(255,255,255,.12)"><Icon name={i} size={18} /></Ring>
              <span className="v">{v ?? '—'}%</span><span className="l">{l}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="content" style={{ paddingTop: 18 }}>
        {active && (
          <button className="banner" onClick={() => onOpenAlert(active)}>
            <Icon name="bell" size={24} />
            <div style={{ flex: 1 }}><b>{changeHeadline(dog, active.changes)}</b><span>Desde hace 3 días · tocá para ver qué hacer</span></div>
            <Icon name="chevron" />
          </button>
        )}
        {justReady && (
          <div className="card" style={{ background: 'var(--sage-50)', boxShadow: 'none', display: 'flex', gap: 14 }}>
            <div className="icon-chip" style={{ background: 'var(--green)', color: '#fff' }}><Icon name="check" stroke={2.6} /></div>
            <div><div className="headline" style={{ fontSize: 16 }}>El patrón habitual de {dog.name} está listo</div>
              <p className="callout" style={{ marginTop: 4 }}>Desde hoy comparamos cada día con su propio historial y te avisamos si algo cambia.</p></div>
          </div>
        )}

        <div className="section-title"><h2>Hoy vs. su patrón</h2><span>últimos 3 días</span></div>
        <div className="metric-grid">
          {METRICS.map((m, idx) => {
            const v = valueOn(series, m.code, day)
            const p = pctVsBaseline(series, baselines, m.code, day)
            const lv = levelOf(p)
            const wide = idx === 0
            return (
              <button key={m.code} className={`metric${wide ? ' wide' : ''}`} onClick={() => onOpenMetric(m.code)}
                aria-label={`${m.name}: ${fmtNum(v, m.decimals)} ${m.unit}, ${LEVEL_TEXT[lv]}, ${fmtPct(p)} respecto de su patrón`}>
                <span className="label"><Icon name={m.icon} size={15} />{m.short}</span>
                <span style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 }}>
                  <span className="value">{fmtNum(v, m.decimals)}<small>{m.unitShort}</small></span>
                  {wide && <span className={`pill pill-${lv}`}>{LEVEL_TEXT[lv]} · {fmtPct(p)}</span>}
                </span>
                <TrendChart code={m.code} points={series[m.code]} baseline={baselines[m.code]} from={Math.max(1, day - (wide ? 13 : 9))} to={day} axis={false} width={wide ? 320 : 140} height={wide ? 56 : 34} highlightFrom />
                {!wide && <span><span className={`pill pill-${lv}`}>{LEVEL_TEXT[lv]} · {fmtPct(p)}</span></span>}
              </button>
            )
          })}
        </div>

        {premium ? (
          <button className="promo" onClick={onGoAssistant}><Icon name="spark" size={26} />
            <div style={{ flex: 1 }}><b>Preguntale a Nüma IA</b><span>Análisis de la semana y respuestas sobre {dog.name}</span></div><Icon name="chevron" /></button>
        ) : (
          <button className="promo" onClick={onGoPremium}><Icon name="spark" size={26} />
            <div style={{ flex: 1 }}><b>Análisis con IA y dieta orientativa</b><span>Probá Premium 3 meses sin cargo</span></div><Icon name="chevron" /></button>
        )}
        <p className="caption" style={{ textAlign: 'center' }}>El índice de bienestar compara el comportamiento con su patrón habitual. No es un diagnóstico.</p>
      </div>
    </div>
  )
}

export function Trends({ data, metric, onMetric }) {
  const { dog, day, series, baselines } = data
  const m = METRIC[metric]
  const b = baselines[metric]
  const last7 = windowMean(series, metric, day, 7)
  const p7 = pctVsBaseline(series, baselines, metric, day, 7)
  return (
    <div className="scroll"><div className="content">
      <div><h1 className="title">Tendencias</h1><p className="body" style={{ marginTop: 4 }}>Los últimos {day} días de {dog.name}.</p></div>
      <div className="chips" role="group" aria-label="Indicador">
        {METRICS.map((x) => <button key={x.code} className="chip" aria-pressed={x.code === metric} onClick={() => onMetric(x.code)}><Icon name={x.icon} size={15} />{x.short}</button>)}
      </div>
      <div className="card" style={{ padding: '18px 12px 12px' }}>
        <div style={{ padding: '0 6px 10px' }}><div className="headline">{m.name}</div><div className="caption">{m.unit} · un valor por día</div></div>
        <TrendChart code={metric} points={series[metric]} baseline={day >= BASELINE_DAYS ? b : undefined} from={1} to={day} start={dog.monitoring_started_on} />
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', padding: '10px 6px 0' }} className="caption">
          <span><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'var(--sage)', verticalAlign: -2, marginRight: 6 }} />Rango habitual (±10%)</span>
          <span><i style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: 'var(--clay)', verticalAlign: -1, marginRight: 6 }} />Fuera de rango</span>
        </div>
      </div>
      {day >= BASELINE_DAYS ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          {[['Patrón habitual', fmtNum(b?.mean, m.decimals)], ['Prom. 7 días', fmtNum(last7, m.decimals)], ['Variación', fmtPct(p7)]].map(([k, v], i) => (
            <div key={k} className="card" style={{ padding: 14 }}>
              <div className="caption" style={{ fontWeight: 650 }}>{k}</div>
              <div style={{ fontSize: 20, fontWeight: 750, marginTop: 4, color: i === 2 && levelOf(p7) === 'alert' ? 'var(--clay)' : undefined }}>{v}</div>
            </div>
          ))}
        </div>
      ) : <p className="callout">El rango habitual aparece cuando termina el período de aprendizaje.</p>}
      <p className="caption">Nüma mira tendencias sostenidas, no valores aislados de un día.</p>
    </div></div>
  )
}

export function AlertView({ data, alert, onBack, onReport, onWatch }) {
  const { dog, day, series, baselines } = data
  const start = dog.monitoring_started_on
  const [checks, setChecks] = useState({})
  const changed = alert.changes.map((c) => c.metric_code)
  const others = METRICS.filter((m) => !changed.includes(m.code)).map((m) => ({ m, p: pctVsBaseline(series, baselines, m.code, alert.day) }))
  const minor = others.filter((x) => Math.abs(x.p ?? 0) >= 8)
  const stable = others.filter((x) => Math.abs(x.p ?? 0) < 8)
  const names = (arr) => arr.map((x) => x.m.lower).join(', ').replace(/, ([^,]*)$/, ' y $1')
  const todo = [
    ['obs', 'Observá si aparece otro signo: vómitos, diarrea, tos, dolor al moverse o desgano marcado.'],
    ['agua', 'Controlá que tome agua con normalidad.'],
    ['nota', 'Anotá lo que veas: lo podés sumar al informe para el veterinario.'],
  ]
  return (
    <div className="screen"><div className="scroll">
      <div className="hero hero-clay">
        <div className="topbar"><button className="icon-btn on-dark" onClick={onBack} aria-label="Volver"><Icon name="back" /></button>
          <span style={{ fontSize: 13.5, fontWeight: 650, opacity: .85 }}>Alerta · {fmtDM(dayToDate(start, alert.day))}</span></div>
        <h1 className="title" style={{ marginTop: 14 }}>{changeHeadline(dog, alert.changes)}</h1>
        <p style={{ margin: '8px 0 0', fontSize: 15, lineHeight: 1.45, opacity: .9 }}>
          Cambio sostenido durante 3 días ({fmtDM(dayToDate(start, alert.day - 2))} al {fmtDM(dayToDate(start, alert.day))}), comparado con su propio patrón.
        </p>
      </div>
      <div className="content" style={{ paddingTop: 18 }}>
        <div className="card card-tight">
          {alert.changes.map((c) => {
            const m = METRIC[c.metric_code]
            return (
              <div key={c.metric_code} className="list-row">
                <div className="icon-chip" style={{ background: 'var(--clay-50)', color: 'var(--clay)' }}><Icon name={m.icon} size={18} /></div>
                <div className="grow"><div className="title-sm">{m.short}</div>
                  <div className="sub">{fmtNum(c.recent, m.decimals)} vs. {fmtNum(c.baseline, m.decimals)} {m.unit} habitual</div></div>
                <div style={{ fontSize: 19, fontWeight: 800, color: 'var(--clay)' }}>{fmtPct(c.pct)}</div>
              </div>
            )
          })}
        </div>
        <div className="card" style={{ padding: '16px 12px 10px' }}>
          <div className="caption" style={{ padding: '0 6px 6px', fontWeight: 650 }}>{METRIC[changed[0]].short} · últimos 14 días</div>
          <TrendChart code={changed[0]} points={series[changed[0]]} baseline={baselines[changed[0]]} from={Math.max(1, day - 13)} to={day} start={start} height={140} highlightFrom />
        </div>
        <p className="callout">
          {minor.length > 0 && <>Variaciones menores, sin llegar a ser sostenidas: {minor.map((x) => `${x.m.lower} (${fmtPct(x.p)})`).join(', ').replace(/, ([^,]*)$/, ' y $1')}. </>}
          {stable.length > 0 && <>Sin cambios en {names(stable)}.</>}
        </p>
        <div className="card" style={{ background: 'var(--sand-50)', boxShadow: 'none', display: 'flex', gap: 10 }}>
          <Icon name="info" size={20} />
          <p className="callout" style={{ color: '#5a4610' }}><b>Esto no es un diagnóstico.</b> Nüma detecta cambios de comportamiento; solo un veterinario puede evaluar a qué se deben.</p>
        </div>
        <div className="section-title"><h2>Qué podés hacer ahora</h2></div>
        <div className="card card-tight">
          {todo.map(([k, t]) => (
            <label key={k} className="check"><input type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} /><span>{t}</span></label>
          ))}
        </div>
        <p className="body" style={{ color: 'var(--ink)', fontWeight: 650 }}>Si el cambio sigue 24 a 48 horas más, o aparece otro síntoma, consultá a tu veterinario.</p>
        <button className="btn btn-primary" onClick={onReport}><Icon name="file" />Armar informe para el veterinario</button>
        <button className="btn btn-secondary" onClick={onWatch}><Icon name="eye" />Lo estoy observando</button>
      </div>
    </div></div>
  )
}

export { fem }
