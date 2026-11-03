import { useEffect, useRef, useState } from 'react'
import { METRIC, BASELINE_DAYS, fmtDM, dayToDate, fmtNum } from './lib/metrics.js'

// ---------- Íconos (trazo, 24×24) ----------
const P = {
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z',
  wind: 'M3 8h10a3 3 0 1 0-3-3 M3 12h15a3 3 0 1 1-3 3 M3 16h7',
  moon: 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
  bed: 'M3 19v-9 M3 15h18v4 M21 15v-2a3 3 0 0 0-3-3h-7v5',
  bolt: 'M13 3 5 14h6l-1 7 8-11h-6z',
  bowl: 'M3 11h18a9 9 0 0 1-18 0z M8 7c0-1 1-1 1-2 M12 7c0-1 1-1 1-2 M16 7c0-1 1-1 1-2',
  drop: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z',
  scratch: 'M5 19 15 9 M9 19l8-8 M13 19l6-6',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4z M10 21a2 2 0 0 0 4 0',
  check: 'm5 12 4 4 10-10',
  bluetooth: 'm7 7 10 10-5 4V3l5 4L7 17',
  share: 'M12 3v12 M7 8l5-5 5 5 M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6',
  file: 'M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z M14 3v5h5 M9 13h6 M9 17h6',
  back: 'm15 5-7 7 7 7',
  chevron: 'm9 5 7 7-7 7',
  spark: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z M19 3v4 M17 5h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M4 21a8 8 0 0 1 16 0',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z M12 11v6 M12 7.5v.5',
  eye: 'M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  battery: 'M2 7h17v10H2z M22 11v2',
  ruler: 'M3 17 17 3l4 4L7 21z M7 13l2 2 M10 10l2 2 M13 7l2 2',
  send: 'M4 12 20 4l-6 16-3-7z',
  download: 'M12 3v12 M7 10l5 5 5-5 M5 21h14',
  plus: 'M12 5v14 M5 12h14',
  minus: 'M5 12h14',
  play: 'M7 5v14l11-7z',
  reset: 'M4 4v6h6 M20 12a8 8 0 0 1-14.9 4 M4 10a8 8 0 0 1 14.9-4',
  logout: 'M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3 M10 17l-5-5 5-5 M5 12h11',
  star: 'm12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.8l6.1-.9z',
  collar: 'M5 15a8 8 0 1 1 14 0 M9 15h6v5H9z',
  mail: 'M3 5h18v14H3z M3 6l9 7 9-7',
  calendar: 'M4 6h16v14H4z M4 10h16 M8 3v4 M16 3v4',
  sliders: 'M4 6h10 M18 6h2 M4 12h4 M12 12h8 M4 18h12 M20 18h0 M14 4v4 M8 10v4 M16 16v4',
}
export function Icon({ name, size = 20, stroke = 2, className, label }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" className={className}
      aria-hidden={label ? undefined : true} role={label ? 'img' : undefined} aria-label={label}>
      {P[name].split(' M').map((d, i) => <path key={i} d={i ? 'M' + d : d} />)}
    </svg>
  )
}

export function Paw({ size = 20, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <ellipse cx="12" cy="16" rx="5" ry="4.2" /><ellipse cx="5.6" cy="10" rx="2" ry="2.6" />
      <ellipse cx="18.4" cy="10" rx="2" ry="2.6" /><ellipse cx="9.3" cy="5.6" rx="2" ry="2.6" /><ellipse cx="14.7" cy="5.6" rx="2" ry="2.6" />
    </svg>
  )
}

/** Logotipo: "nüma" con dos huellas como puntos de la ü. */
export function Logo({ size = 40, color = 'var(--green)', paws = 'var(--coral)' }) {
  return (
    <span role="img" aria-label="nüma" style={{ fontSize: size, color, fontWeight: 800, letterSpacing: '-0.045em', lineHeight: 1, display: 'inline-flex', alignItems: 'flex-end' }}>
      <span aria-hidden="true">n</span>
      <span aria-hidden="true" style={{ position: 'relative', display: 'inline-block' }}>
        u
        <span style={{ position: 'absolute', top: '-0.13em', left: '50%', transform: 'translateX(-50%) rotate(-8deg)', display: 'flex', gap: '0.06em' }}>
          <Paw size={size * 0.2} color={paws} /><Paw size={size * 0.2} color={paws} />
        </span>
      </span>
      <span aria-hidden="true">ma</span>
    </span>
  )
}

function useAnimated(value) {
  const [p, setP] = useState(0)
  useEffect(() => { const id = requestAnimationFrame(() => setP(Math.max(0, Math.min(100, value ?? 0)))); return () => cancelAnimationFrame(id) }, [value])
  return p
}

export function Ring({ value, size, stroke, color, track = '#ecece5', children, label }) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const p = useAnimated(value)
  return (
    <div className="ring" style={{ width: size, height: size }} role={label ? 'img' : undefined} aria-label={label}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - p / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.3,.8,.3,1)' }} />
      </svg>
      <div className="inner">{children}</div>
    </div>
  )
}

/** Anillos concéntricos (estilo Apple/Whoop). rings: [{ value 0–100, color, track }] de afuera hacia adentro. */
export function RingStack({ rings, size = 124, stroke = 13, gap = 3, label, children }) {
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={label}>
      {rings.map((rg, i) => {
        const s = size - i * 2 * (stroke + gap)
        return (
          <div key={i} style={{ position: 'absolute', inset: i * (stroke + gap) }}>
            <Ring value={rg.value} size={s} stroke={stroke} color={rg.color} track={rg.track} />
          </div>
        )
      })}
      <div className="inner">{children}</div>
    </div>
  )
}

/**
 * Gráfico de línea con rango habitual.
 * points: Array<{day, value}>; baseline: {mean, low, high} | undefined
 */
export function TrendChart({ code, points, baseline, from, to, width = 340, height = 200, axis = true, start, color = 'var(--green)', band = 'var(--green-50)', alertColor = 'var(--coral-ink)' }) {
  const m = METRIC[code]
  const pts = points.filter((p) => p.day >= from && p.day <= to)
  if (!pts.length) return <div className="skeleton" style={{ height }} />
  const vals = pts.map((p) => p.value)
  let lo = Math.min(...vals), hi = Math.max(...vals)
  if (baseline) { lo = Math.min(lo, baseline.low); hi = Math.max(hi, baseline.high) }
  const pad = (hi - lo || 1) * 0.18; lo -= pad; hi += pad
  const L = axis ? 34 : 2, R = axis ? 10 : 2, T = axis ? 10 : 3, B = axis ? 24 : 3
  const span = Math.max(1, to - from)
  const X = (d) => L + ((d - from) * (width - L - R)) / span
  const Y = (v) => T + ((hi - v) * (height - T - B)) / (hi - lo)
  const learnEnd = Math.min(BASELINE_DAYS, to)
  const showLearn = axis && from <= BASELINE_DAYS
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.day).toFixed(1)} ${Y(p.value).toFixed(1)}`).join(' ')
  const isOut = (v) => baseline && Math.abs((v - baseline.mean) / baseline.mean) >= 0.15
  const last = pts.at(-1)
  const ticks = axis ? [lo + pad, (lo + hi) / 2, hi - pad] : []
  const xt = axis && start ? [from, Math.round((from + to) / 2), to] : []
  const bandX = showLearn ? X(learnEnd) : L
  return (
    <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img"
      aria-label={`${m.name}: ${pts.length} días. Último valor ${fmtNum(last.value, m.decimals)} ${m.unit}${baseline ? `, patrón habitual ${fmtNum(baseline.mean, m.decimals)}` : ''}.`}>
      {showLearn && (
        <>
          <rect x={L} y={T} width={Math.max(0, X(learnEnd) - L)} height={height - T - B} fill="#f1f1ec" rx="6" />
          <text x={L + 8} y={T + 15} fontSize="10.5" fontWeight="700" fill="var(--ink-3)">Aprendizaje</text>
        </>
      )}
      {baseline && <rect x={bandX} y={Y(baseline.high)} width={width - R - bandX} height={Y(baseline.low) - Y(baseline.high)} fill={band} rx="6" />}
      {ticks.map((v, i) => <text key={i} x={L - 7} y={Y(v) + 3.5} fontSize="10.5" fill="var(--ink-3)" textAnchor="end">{fmtNum(v, v < 20 && m.decimals ? 1 : 0)}</text>)}
      {xt.map((d, i) => <text key={i} x={X(d)} y={height - 6} fontSize="10.5" fill="var(--ink-3)" textAnchor={i === 0 ? 'start' : i === 2 ? 'end' : 'middle'}>{fmtDM(dayToDate(start, d))}</text>)}
      <path d={path} fill="none" stroke={color} strokeWidth={axis ? 2.6 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
      {pts.filter((p) => p.day > BASELINE_DAYS && isOut(p.value)).map((p) => <circle key={p.day} cx={X(p.day)} cy={Y(p.value)} r={axis ? 4 : 3} fill={alertColor} />)}
      <circle cx={X(last.day)} cy={Y(last.value)} r={axis ? 5.5 : 3.5} fill={color} stroke="#fff" strokeWidth="2" />
    </svg>
  )
}

export function Spinner({ label }) {
  return <div className="center-state" role="status"><div className="spinner" aria-hidden="true" /><p className="callout">{label}</p></div>
}

export function Snackbar({ text, onDone }) {
  const t = useRef()
  useEffect(() => { clearTimeout(t.current); t.current = setTimeout(onDone, 2800); return () => clearTimeout(t.current) }, [text, onDone])
  return <div className="snackbar" role="status">{text}</div>
}

/** Barra superior con botón volver. */
export function NavBar({ title, onBack, backLabel = 'Inicio', right }) {
  return (
    <div className="nav">
      {onBack ? <button className="back" onClick={onBack} aria-label={`Volver a ${backLabel}`}><Icon name="back" size={22} stroke={2.4} />{backLabel}</button> : <span style={{ width: 44 }} />}
      <div className="grow">{title}</div>
      {right ?? <span style={{ width: 64 }} />}
    </div>
  )
}

/** Markdown mínimo: **negrita**, _itálica_, listas con "- ". */
export function Markdown({ text }) {
  const blocks = text.trim().split(/\n{2,}/)
  const inline = (s) => s.split(/(\*\*[^*]+\*\*|_[^_]+_)/g).map((part, i) =>
    part.startsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part.startsWith('_') && part.endsWith('_') && part.length > 2 ? <em key={i}>{part.slice(1, -1)}</em>
        : part)
  return (
    <div className="md">
      {blocks.map((b, i) => {
        const lines = b.split('\n')
        const items = lines.filter((l) => /^\s*[-*•]\s+/.test(l))
        if (items.length && items.length === lines.length) return <ul key={i}>{items.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>)}</ul>
        if (items.length) {
          const head = lines.filter((l) => !/^\s*[-*•]\s+/.test(l))
          return <div key={i}><p>{inline(head.join(' '))}</p><ul>{items.map((l, j) => <li key={j}>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>)}</ul></div>
        }
        return <p key={i}>{inline(lines.join(' '))}</p>
      })}
    </div>
  )
}
