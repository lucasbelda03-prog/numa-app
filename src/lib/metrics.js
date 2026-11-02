// Indicadores del collar, simulador de datos y reglas de análisis.
// Las reglas replican las de la base de datos (refresh_dog_analytics):
//  * Patrón habitual = promedio de los días 1–14; rango habitual = ±10 %.
//  * Alerta = 3 días seguidos a ±15 % o más del patrón, misma dirección.

export const BASELINE_DAYS = 14
export const ALERT_THRESHOLD = 0.15
export const BAND = 0.10
export const STORY = { changeStartsDay: 24, normalDay: 21, alertDay: 26 }

export const METRICS = [
  { code: 'activity_minutes', lower: 'actividad', name: 'Actividad', short: 'Actividad', unit: 'min activos', unitShort: 'min', decimals: 0, icon: 'bolt', base: 95, change: -0.36, noise: 0.05 },
  { code: 'feeding_minutes', lower: 'alimentación', name: 'Alimentación', short: 'Alimentación', unit: 'min comiendo', unitShort: 'min', decimals: 1, icon: 'bowl', base: 11, change: -0.40, noise: 0.05 },
  { code: 'rest_quality_pct', lower: 'descanso', name: 'Calidad del descanso', short: 'Descanso', unit: '% sin interrupciones', unitShort: '%', decimals: 0, icon: 'bed', base: 82, change: -0.17, noise: 0.03 },
  { code: 'sleep_hours', lower: 'sueño', name: 'Sueño', short: 'Sueño', unit: 'h por día', unitShort: 'h', decimals: 1, icon: 'moon', base: 13.2, change: 0.13, noise: 0.03 },
  { code: 'resting_heart_rate', lower: 'frecuencia cardíaca en reposo', name: 'Frecuencia cardíaca en reposo', short: 'FC en reposo', unit: 'latidos por minuto', unitShort: 'lpm', decimals: 0, icon: 'heart', base: 76, change: 0.11, noise: 0.025 },
  { code: 'resting_resp_rate', lower: 'respiración en reposo', name: 'Frecuencia respiratoria en reposo', short: 'Respiración', unit: 'respiraciones por min', unitShort: 'rpm', decimals: 0, icon: 'wind', base: 18, change: 0.12, noise: 0.035 },
  { code: 'drinking_events', lower: 'hidratación', name: 'Hidratación', short: 'Hidratación', unit: 'veces que tomó agua', unitShort: 'veces', decimals: 0, icon: 'drop', base: 9, change: -0.06, noise: 0.06 },
  { code: 'scratching_episodes', lower: 'rascado', name: 'Rascado', short: 'Rascado', unit: 'episodios por día', unitShort: 'episod.', decimals: 0, icon: 'scratch', base: 6, change: 0.04, noise: 0.08 },
]
export const METRIC = Object.fromEntries(METRICS.map((m) => [m.code, m]))

// ---------- Simulador del collar (determinista) ----------
function rng(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const SIM = {}
METRICS.forEach((m, k) => {
  const r = rng(1000 + k * 77)
  const out = [null]
  for (let d = 1; d <= 90; d++) {
    const ramp = d < STORY.changeStartsDay ? 0 : d === STORY.changeStartsDay ? 0.6 : d === STORY.changeStartsDay + 1 ? 0.85 : 1
    const v = m.base * (1 + (r() * 2 - 1) * m.noise) * (1 + m.change * ramp)
    const f = 10 ** m.decimals
    out.push(Math.round(v * f) / f)
  }
  SIM[m.code] = out
})
/** Valor simulado del collar para un indicador y un día de monitoreo (1..90). */
export const simulatedValue = (code, day) => SIM[code][day]

// ---------- Estadística ----------
export const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : NaN)

/** series: { [code]: Array<{day, value}> } ordenado por día. */
export function valueOn(series, code, day) {
  const p = (series[code] || []).find((x) => x.day === day)
  return p ? p.value : null
}
export function windowMean(series, code, endDay, n = 3) {
  const vals = (series[code] || []).filter((x) => x.day > endDay - n && x.day <= endDay).map((x) => x.value)
  return vals.length ? mean(vals) : null
}
export function pctVsBaseline(series, baselines, code, endDay, n = 3) {
  const b = baselines[code]?.mean
  const w = windowMean(series, code, endDay, n)
  if (b == null || w == null) return null
  return Math.round(((w - b) / b) * 100)
}
export const levelOf = (p) => (p == null ? 'ok' : Math.abs(p) >= 15 ? 'alert' : Math.abs(p) >= 8 ? 'warn' : 'ok')
export const LEVEL_TEXT = { ok: 'Normal', warn: 'Atento', alert: 'Cambio' }

/** Índice de bienestar 0–100: cuánto se parece el comportamiento reciente a su patrón. */
export function wellbeingScore(series, baselines, day) {
  if (!Object.keys(baselines).length) return null
  const devs = METRICS.map((m) => Math.abs(pctVsBaseline(series, baselines, m.code, day) ?? 0))
  return Math.max(0, Math.min(100, Math.round(96 - mean(devs) * 1.75)))
}

// ---------- Reglas (versión local, igual a la de la base) ----------
export function computeBaselines(series) {
  const out = {}
  for (const m of METRICS) {
    const vals = (series[m.code] || []).filter((x) => x.day <= BASELINE_DAYS).map((x) => x.value)
    if (vals.length >= 10) {
      const mu = Math.round(mean(vals) * 100) / 100
      out[m.code] = { mean: mu, low: Math.round(mu * (1 - BAND) * 100) / 100, high: Math.round(mu * (1 + BAND) * 100) / 100 }
    }
  }
  return out
}
export function detectChanges(series, baselines, day) {
  const changes = []
  for (const m of METRICS) {
    const b = baselines[m.code]?.mean
    if (b == null) continue
    const last = (series[m.code] || []).filter((x) => x.day > day - 3 && x.day <= day).map((x) => x.value)
    if (last.length < 3) continue
    const down = last.every((v) => v <= b * (1 - ALERT_THRESHOLD))
    const up = last.every((v) => v >= b * (1 + ALERT_THRESHOLD))
    if (down || up) {
      const recent = Math.round(mean(last) * 100) / 100
      changes.push({ metric_code: m.code, baseline: b, recent, pct: Math.round(((recent - b) / b) * 100) })
    }
  }
  return changes.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))
}

// ---------- Fechas ----------
export const isoDate = (d) => {
  const x = new Date(d)
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}
export const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
export const dayToDate = (startISO, day) => addDays(parseISO(startISO), day - 1)
export const dateToDay = (startISO, iso) => Math.round((parseISO(iso) - parseISO(startISO)) / 86400000) + 1
const DOW = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MON = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
export const fmtShort = (d) => `${d.getDate()} ${MON[d.getMonth()]}`
export const fmtLong = (d) => `${DOW[d.getDay()]} ${d.getDate()} de ${MON[d.getMonth()]}`
export const fmtDM = (d) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`

export const fmtNum = (v, dec = 0) =>
  v == null || Number.isNaN(v) ? '—' : Number(v).toLocaleString('es-AR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
export const fmtPct = (p) => (p == null ? '—' : `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`)
