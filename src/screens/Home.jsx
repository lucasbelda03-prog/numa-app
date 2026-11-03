import { useState } from 'react'
import { Icon, Paw, Ring, RingStack, TrendChart, NavBar } from '../components.jsx'
import {
  METRICS, METRIC, BASELINE_DAYS, valueOn, pctVsBaseline, wellbeingScore, windowMean,
  fmtNum, fmtPct, fmtLong, fmtDM, dayToDate,
} from '../lib/metrics.js'
import { CATEGORIES, CAT, categoryStatus, categoryLine, categorySentence, daySummary } from '../lib/categories.js'
import { changeHeadline } from '../lib/api.js'

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const COLOR = { coral: 'coral', blue: 'blue', amber: 'amber', rose: 'rose', leaf: 'leaf' }

function headTitle(data) {
  const { dog, day } = data
  if (day < BASELINE_DAYS) return `Conociendo a ${dog.name}`
  const levels = CATEGORIES.map((c) => categoryStatus(c, data).level)
  if (levels.includes('alert')) return `Algo cambió en ${dog.name}`
  if (levels.includes('warn')) return `${dog.name} está casi como siempre`
  return `${dog.name} está bien hoy`
}

export function Home({ data, onOpenCategory, onOpenAlert, onOpenAI, onOpenReports, onOpenProfile, onAdvance }) {
  const { dog, day, series, baselines, alerts, profile, subscription } = data
  const learning = day < BASELINE_DAYS
  const date = dayToDate(dog.monitoring_started_on, day)
  const firstName = (profile?.full_name || '').trim().split(' ')[0]
  const active = alerts.find((a) => a.status !== 'resolved')
  const premium = subscription?.plan_code === 'premium'
  const ofPattern = (code) => {
    const b = baselines[code]?.mean; const v = valueOn(series, code, day)
    return b && v != null ? Math.round((v / b) * 100) : null
  }
  const act = ofPattern('activity_minutes'), rest = ofPattern('rest_quality_pct'), food = ofPattern('feeding_minutes')
  const score = learning ? null : wellbeingScore(series, baselines, day)
  const tone = active ? 'alert' : score >= 80 ? 'ok' : 'warn'
  const toneLabel = { ok: 'Estable', warn: 'Un poco distinto', alert: 'Cambió' }[tone]
  const since = active?.day != null ? day - active.day + 3 : 3

  return (
    <div className="scroll"><div className="page">
      <div className="home-head">
        <div className="avatar" aria-hidden="true">{dog.name[0].toUpperCase()}<span className="paw"><Paw size={11} /></span></div>
        <div className="who"><div className="name">{dog.name}</div><div className="meta">{cap(fmtLong(date))} · día {day} con Nüma</div></div>
        <button className="icon-btn" onClick={onOpenProfile} aria-label="Perfil y ajustes"><Icon name="user" /></button>
      </div>

      <div style={{ marginTop: 6 }}>
        {firstName && <p className="callout" style={{ fontWeight: 650 }}>Hola, {firstName}</p>}
        <h1 className="large-title" style={{ marginTop: 2 }}>{headTitle(data)}</h1>
      </div>

      {active && (
        <button className="banner" onClick={() => onOpenAlert(active)}>
          <span className="ic"><Icon name="bell" size={22} /></span>
          <span style={{ flex: 1 }}><b>{changeHeadline(dog, active.changes)}</b><span>Desde hace {since} días · tocá para ver qué hacer</span></span>
          <Icon name="chevron" />
        </button>
      )}

      {learning ? (
        <div className="card">
          <div className="summary">
            <Ring value={(day / BASELINE_DAYS) * 100} size={112} stroke={12} color="var(--green)" label={`Aprendizaje: día ${day} de ${BASELINE_DAYS}`}>
              <div className="big" style={{ fontSize: 34 }}>{day}<small style={{ fontSize: 15 }}>/{BASELINE_DAYS}</small></div>
            </Ring>
            <div className="txt">
              <div className="headline">Estamos aprendiendo</div>
              <p className="callout" style={{ marginTop: 4 }}>Durante {BASELINE_DAYS} días Nüma registra cómo es {dog.name} normalmente. Después te avisa si algo cambia.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="summary">
            <RingStack size={124} stroke={13} gap={3} label={`Actividad ${act}%, descanso ${rest}% y alimentación ${food}% de su patrón habitual`}
              rings={[
                { value: act, color: 'var(--coral)', track: 'var(--coral-50)' },
                { value: rest, color: 'var(--blue)', track: 'var(--blue-50)' },
                { value: food, color: 'var(--amber)', track: 'var(--amber-50)' },
              ]} />
            <div className="txt">
              <div className="caption" style={{ fontWeight: 700 }}>Índice de bienestar</div>
              <div className="score-line" style={{ marginTop: 4 }}>
                <span className="score">{score}</span>
                <span className={`chip chip-${tone}`}>{toneLabel}</span>
              </div>
              <p className="callout" style={{ marginTop: 8 }}>{daySummary(data)}</p>
            </div>
          </div>
          <div className="legend">
            <span className="legend-title">Hoy, comparado con su día habitual</span>
            <span className="c-coral"><i />Actividad {act}%</span>
            <span className="c-blue"><i />Descanso {rest}%</span>
            <span className="c-amber"><i />Alimentación {food}%</span>
          </div>
        </div>
      )}

      <h2 className="section">Su día</h2>
      {CATEGORIES.map((cat) => {
        const st = categoryStatus(cat, data)
        return (
          <button key={cat.id} className={`cat c-${COLOR[cat.color]}`} onClick={() => onOpenCategory(cat.id)}>
            <span className="ic"><Icon name={cat.icon} size={24} /></span>
            <span className="grow">
              <span className="t" style={{ display: 'block' }}>{cat.title}</span>
              <span className="v" style={{ display: 'block' }}>{categoryLine(cat, data)}</span>
              <span style={{ display: 'block', marginTop: 8 }}><span className={`chip chip-${st.level}`}>{st.label}</span></span>
            </span>
            <span className="chev"><Icon name="chevron" /></span>
          </button>
        )
      })}

      <h2 className="section">Más</h2>
      <div className="tiles">
        <button className="tile feature" onClick={onOpenAI}>
          <Icon name="spark" size={26} />
          <span className="t">Nüma IA</span>
          <span className="s">{premium ? `Preguntá lo que quieras sobre ${dog.name}` : 'Probá Premium 3 meses sin cargo'}</span>
        </button>
        <button className="tile" onClick={onOpenReports}>
          <span className="bubble-ic tint-ic c-blue"><Icon name="file" size={22} /></span>
          <span className="t">Informe para el veterinario</span>
          <span className="s">Resumen listo para compartir</span>
        </button>
      </div>

      {learning && <button className="btn btn-tint" onClick={onAdvance}><Icon name="play" size={16} />Avanzar simulación al día {BASELINE_DAYS}</button>}
      <p className="caption" style={{ textAlign: 'center', marginTop: 4 }}>Nüma compara a {dog.name} con su propio patrón. No reemplaza al veterinario.</p>
    </div></div>
  )
}

function MetricBlock({ code, data, cat, range }) {
  const { dog, day, series, baselines } = data
  const m = METRIC[code]
  const b = day >= BASELINE_DAYS ? baselines[code] : undefined
  const p = pctVsBaseline(series, baselines, code, day)
  const from = range === 'all' ? 1 : Math.max(1, day - 13)
  return (
    <div className="card" style={{ padding: '18px 14px 14px' }}>
      <div style={{ padding: '0 4px' }}>
        <div className="caption" style={{ fontWeight: 750 }}>{m.name}</div>
        <div className="big" style={{ marginTop: 6 }}>{fmtNum(valueOn(series, code, day), m.decimals)}<small>{m.unitShort} hoy</small></div>
      </div>
      <div style={{ marginTop: 10 }}>
        <TrendChart code={code} points={series[code]} baseline={b} from={from} to={day} start={dog.monitoring_started_on} height={170}
          color={`var(--${cat.color})`} band={`var(--${cat.color}-50)`} />
      </div>
      {b ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10, padding: '0 4px' }}>
          <div><div className="caption">Habitual</div><div style={{ fontWeight: 800, marginTop: 2 }}>{fmtNum(b.mean, m.decimals)}</div></div>
          <div><div className="caption">Rango</div><div style={{ fontWeight: 800, marginTop: 2 }}>{fmtNum(b.low, m.decimals)}–{fmtNum(b.high, m.decimals)}</div></div>
          <div><div className="caption">Últimos 3 días</div><div style={{ fontWeight: 800, marginTop: 2 }}>{fmtPct(p)}</div></div>
        </div>
      ) : <p className="caption" style={{ padding: '6px 4px 0' }}>El rango habitual aparece al terminar el aprendizaje.</p>}
    </div>
  )
}

export function CategoryDetail({ data, catId, onBack }) {
  const cat = CAT[catId]
  const st = categoryStatus(cat, data)
  const [range, setRange] = useState('14')
  return (
    <div className="screen push"><div className="scroll"><div className={`page c-${cat.color}`}>
      <NavBar onBack={onBack} />
      <div className="hero-tint">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="ic"><Icon name={cat.icon} size={26} /></span>
          <span className={`chip chip-${st.level}`}>{st.label}</span>
        </div>
        <h1 className="title" style={{ marginTop: 14 }}>{cat.title}</h1>
        <p className="body" style={{ marginTop: 6, color: 'var(--ink)' }}>{categorySentence(cat, data)}</p>
      </div>
      <div className="segmented" role="group" aria-label="Período del gráfico">
        <button aria-pressed={range === '14'} onClick={() => setRange('14')}>Últimos 14 días</button>
        <button aria-pressed={range === 'all'} onClick={() => setRange('all')}>Todo</button>
      </div>
      {cat.metrics.map((code) => <MetricBlock key={code} code={code} data={data} cat={cat} range={range} />)}
      <div className="card">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}><span className="bubble-ic tint-ic"><Icon name="info" size={20} /></span><div className="headline">Sobre este dato</div></div>
        <p className="callout" style={{ marginTop: 10 }}>{cat.about}</p>
        <p className="callout" style={{ marginTop: 8 }}>La franja de color es lo normal para {data.dog.name}: su promedio de los primeros {BASELINE_DAYS} días, ±10%.</p>
      </div>
    </div></div></div>
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
  const join = (arr) => arr.join(', ').replace(/, ([^,]*)$/, ' y $1')
  const main = changed[0]
  const mainCat = CATEGORIES.find((c) => c.metrics.includes(main))
  const todo = [
    ['obs', 'Observá si aparece otro signo: vómitos, diarrea, tos, dolor al moverse o desgano marcado.'],
    ['agua', 'Controlá que tome agua con normalidad.'],
    ['nota', 'Anotá lo que veas: lo podés sumar al informe para el veterinario.'],
  ]
  return (
    <div className="screen push"><div className="scroll"><div className="page">
      <NavBar onBack={onBack} />
      <div className="hero-tint c-coral">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span className="ic"><Icon name="bell" size={26} /></span>
          <span className="chip chip-alert">Alerta · {fmtDM(dayToDate(start, alert.day))}</span>
        </div>
        <h1 className="title" style={{ marginTop: 14 }}>{changeHeadline(dog, alert.changes)}</h1>
        <p className="body" style={{ marginTop: 6, color: 'var(--ink)' }}>
          Es un cambio sostenido durante 3 días ({fmtDM(dayToDate(start, alert.day - 2))} al {fmtDM(dayToDate(start, alert.day))}), comparado con su propio patrón.
        </p>
      </div>

      <div className="group">
        {alert.changes.map((c) => {
          const m = METRIC[c.metric_code]
          const cc = CATEGORIES.find((x) => x.metrics.includes(c.metric_code))
          return (
            <div key={c.metric_code} className="row">
              <span className={`bubble-ic tint-ic c-${cc.color}`}><Icon name={m.icon} size={20} /></span>
              <span className="grow"><span className="t" style={{ display: 'block' }}>{m.short}</span>
                <span className="s" style={{ display: 'block' }}>{fmtNum(c.recent, m.decimals)} vs. {fmtNum(c.baseline, m.decimals)} {m.unitShort} habitual</span></span>
              <span style={{ fontSize: 20, fontWeight: 800, color: 'var(--alert-ink)' }}>{fmtPct(c.pct)}</span>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding: '16px 12px 10px' }}>
        <div className="caption" style={{ padding: '0 6px 6px', fontWeight: 750 }}>{METRIC[main].short} · últimos 14 días</div>
        <TrendChart code={main} points={series[main]} baseline={baselines[main]} from={Math.max(1, day - 13)} to={day} start={start} height={150}
          color={`var(--${mainCat.color})`} band={`var(--${mainCat.color}-50)`} />
      </div>

      <p className="callout">
        {minor.length > 0 && <>También hubo variaciones menores en {join(minor.map((x) => `${x.m.lower} (${fmtPct(x.p)})`))}. </>}
        {stable.length > 0 && <>Sin cambios en {join(stable.map((x) => x.m.lower))}.</>}
      </p>

      <div className="card" style={{ background: 'var(--amber-50)', boxShadow: 'none', display: 'flex', gap: 10 }}>
        <span style={{ color: 'var(--amber-ink)', flex: 'none' }}><Icon name="info" size={20} /></span>
        <p className="callout" style={{ color: 'var(--amber-ink)' }}><b>Esto no es un diagnóstico.</b> Nüma detecta cambios de comportamiento; solo un veterinario puede evaluar a qué se deben.</p>
      </div>

      <h2 className="section">Qué podés hacer ahora</h2>
      <div className="group">
        {todo.map(([k, t]) => (
          <label key={k} className="check"><input type="checkbox" checked={!!checks[k]} onChange={(e) => setChecks({ ...checks, [k]: e.target.checked })} /><span>{t}</span></label>
        ))}
      </div>
      <p className="body" style={{ color: 'var(--ink)', fontWeight: 700 }}>Si el cambio sigue 24 a 48 horas más, o aparece otro síntoma, consultá a tu veterinario.</p>
      <button className="btn btn-primary" onClick={onReport}><Icon name="file" />Armar informe para el veterinario</button>
      <button className="btn btn-secondary" onClick={onWatch}><Icon name="eye" />Lo estoy observando</button>
    </div></div></div>
  )
}

export { windowMean }
