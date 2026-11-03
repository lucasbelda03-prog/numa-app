// Áreas del bienestar: agrupan los 8 indicadores del collar en 5 tarjetas
// fáciles de leer, con un color y una explicación en lenguaje simple.
import { METRIC, BASELINE_DAYS, valueOn, pctVsBaseline, levelOf, fmtNum, fmtPct } from './metrics.js'

export const CATEGORIES = [
  {
    id: 'activity', title: 'Actividad', icon: 'bolt', color: 'coral', metrics: ['activity_minutes'],
    about: 'Minutos en movimiento: paseos, juego y actividad en casa. Una baja sostenida puede indicar cansancio, dolor o desgano.',
  },
  {
    id: 'rest', title: 'Descanso y sueño', icon: 'moon', color: 'blue', metrics: ['sleep_hours', 'rest_quality_pct'],
    about: 'Horas de sueño y qué tan seguido se interrumpe el descanso. Dormir mucho más o descansar peor suele ser una de las primeras señales de que algo cambió.',
  },
  {
    id: 'food', title: 'Alimentación e hidratación', icon: 'bowl', color: 'amber', metrics: ['feeding_minutes', 'drinking_events'],
    about: 'Tiempo que pasa comiendo y cuántas veces toma agua. Los cambios de apetito muchas veces anticipan que algo no anda bien.',
  },
  {
    id: 'vitals', title: 'Corazón y respiración', icon: 'heart', color: 'rose', metrics: ['resting_heart_rate', 'resting_resp_rate'],
    about: 'Latidos y respiraciones por minuto mientras descansa. Se comparan con su propio promedio, no con un valor estándar para todos los perros.',
  },
  {
    id: 'skin', title: 'Piel y comodidad', icon: 'scratch', color: 'leaf', metrics: ['scratching_episodes'],
    about: 'Episodios de rascado que detecta el movimiento del collar. Un aumento sostenido puede relacionarse con picazón o irritación.',
  },
]
export const CAT = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]))

const RANK = { learning: 0, ok: 1, warn: 2, alert: 3 }

// Cómo nombrar cada indicador dentro de una frase: [texto, es plural]
const PHRASE = {
  activity_minutes: ['su actividad', false],
  feeding_minutes: ['el tiempo que pasa comiendo', false],
  rest_quality_pct: ['la calidad de su descanso', false],
  sleep_hours: ['sus horas de sueño', true],
  resting_heart_rate: ['su frecuencia cardíaca en reposo', false],
  resting_resp_rate: ['su respiración en reposo', false],
  drinking_events: ['las veces que toma agua', true],
  scratching_episodes: ['el rascado', false],
}
const SHORT = { activity: 'su actividad', rest: 'su descanso', food: 'su alimentación', vitals: 'su corazón y respiración', skin: 'su piel' }
const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1)
const joinY = (arr) => arr.join(', ').replace(/, ([^,]*)$/, ' y $1')

/** Indicadores con un cambio sostenido (los de la alerta abierta). */
export function sustainedCodes(data) {
  const open = (data.alerts || []).find((a) => a.status !== 'resolved' && (a.day == null || a.day <= data.day))
  return new Set(open ? open.changes.map((c) => c.metric_code) : [])
}

/**
 * Estado de un área, con el mismo criterio que la alerta:
 * "cambio" solo si el indicador se sostuvo 3 días fuera de su rango;
 * "un poco distinto" si el promedio de 3 días se apartó 8 % o más.
 */
export function categoryStatus(cat, data) {
  const { series, baselines, day } = data
  if (day < BASELINE_DAYS) return { level: 'learning', label: 'Aprendiendo' }
  const sustained = sustainedCodes(data)
  let worst = { level: 'ok', pct: 0, code: cat.metrics[0] }
  for (const code of cat.metrics) {
    const pct = pctVsBaseline(series, baselines, code, day)
    const level = sustained.has(code) ? 'alert' : levelOf(pct) === 'ok' ? 'ok' : 'warn'
    if (RANK[level] > RANK[worst.level] || (level === worst.level && Math.abs(pct ?? 0) > Math.abs(worst.pct ?? 0))) worst = { level, pct, code }
  }
  const label = worst.level === 'ok' ? 'Como siempre'
    : worst.level === 'warn' ? 'Un poco distinto'
      : worst.pct < 0 ? 'Más bajo de lo habitual' : 'Más alto de lo habitual'
  return { ...worst, label }
}

/** Una línea con los valores de hoy, en palabras. */
export function categoryLine(cat, data) {
  const v = (code) => fmtNum(valueOn(data.series, code, data.day), METRIC[code].decimals)
  switch (cat.id) {
    case 'activity': return `${v('activity_minutes')} min de actividad hoy`
    case 'rest': return `${v('sleep_hours')} h de sueño · ${v('rest_quality_pct')}% sin interrupciones`
    case 'food': return `${v('feeding_minutes')} min comiendo · tomó agua ${v('drinking_events')} veces`
    case 'vitals': return `${v('resting_heart_rate')} latidos · ${v('resting_resp_rate')} respiraciones por min`
    case 'skin': return `${v('scratching_episodes')} episodios de rascado hoy`
    default: return ''
  }
}

/** Frase para el encabezado del detalle de un área. */
export function categorySentence(cat, data) {
  const st = categoryStatus(cat, data)
  const name = data.dog.name
  if (st.level === 'learning') {
    const left = BASELINE_DAYS - data.day
    return `Estamos aprendiendo cómo es ${name} en esto. Faltan ${left} ${left === 1 ? 'día' : 'días'} para tener su patrón.`
  }
  if (st.level === 'ok') return `En los últimos 3 días, todo estuvo dentro de lo habitual para ${name}.`
  const [what, plural] = PHRASE[st.code]
  const verb = plural ? 'estuvieron' : 'estuvo'
  const dir = st.pct < 0 ? 'por debajo' : 'por encima'
  if (st.level === 'warn') return `En los últimos 3 días, ${what} ${verb} un poco ${dir} de lo habitual (${fmtPct(st.pct)}), sin llegar a ser un cambio sostenido.`
  return `En los últimos 3 días, ${what} ${verb} ${Math.abs(st.pct)}% ${dir} de lo habitual para ${name}.`
}

/** Frase corta para el resumen del inicio. */
export function daySummary(data) {
  const { dog, day } = data
  if (day < BASELINE_DAYS) return `Estamos conociendo a ${dog.name}.`
  const states = CATEGORIES.map((c) => ({ c, s: categoryStatus(c, data) }))
  const changed = states.filter((x) => x.s.level === 'alert')
  const minor = states.filter((x) => x.s.level === 'warn')
  const list = (arr) => joinY(arr.map((x) => SHORT[x.c.id]))
  const also = minor.length ? ` ${cap(list(minor))} también ${minor.length > 1 ? 'están un poco distintos' : 'está un poco distinto'}.` : ''
  if (changed.length) return `Notamos un cambio en ${list(changed)}.${also}`
  if (minor.length) return `Casi todo como siempre. Prestá atención a ${list(minor)}.`
  return `${dog.name} se movió, descansó y comió como siempre.`
}
