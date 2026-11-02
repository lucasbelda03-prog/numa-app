// Capa de datos de Nüma.
// - Modo nube: Supabase (auth, base de datos, funciones e IA).
// - Modo demo: todo en memoria, para cuando no hay conexión configurada.
import { createClient } from '@supabase/supabase-js'
import {
  METRICS, METRIC, STORY, simulatedValue, computeBaselines, detectChanges,
  isoDate, addDays, dayToDate, dateToDay, fmtNum, fmtPct, pctVsBaseline,
} from './metrics.js'

const URL = import.meta.env.VITE_SUPABASE_URL
const KEY = import.meta.env.VITE_SUPABASE_KEY
export const supabase = URL && KEY ? createClient(URL, KEY) : null
export const MODE = supabase ? 'cloud' : 'demo'

const PLANS = [
  { code: 'basic', name: 'Básico', price_usd_month: 0, trial_days: 0, features: ['Seguimiento de los 8 indicadores', 'Índice de bienestar y tendencias', 'Alertas ante cambios sostenidos', 'Informe para el veterinario'] },
  { code: 'premium', name: 'Premium', price_usd_month: 7, trial_days: 90, features: ['Todo lo del Plan Básico', 'Análisis con IA de los datos de tu perro', 'Asistente para hacer preguntas', 'Ración orientativa y recomendaciones de cuidado'] },
]

const friendlyError = (e) => {
  const m = (e?.message || String(e)).toLowerCase()
  if (m.includes('invalid login')) return 'El email o la contraseña no coinciden.'
  if (m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con ese email. Probá iniciar sesión.'
  if (m.includes('password should be') || m.includes('weak')) return 'La contraseña tiene que tener al menos 6 caracteres.'
  if (m.includes('email not confirmed')) return 'Falta confirmar tu email. Revisá tu bandeja de entrada.'
  if (m.includes('rate limit')) return 'Hubo demasiados intentos seguidos. Esperá un momento y probá de nuevo.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'No hay conexión. Revisá tu internet y probá de nuevo.'
  return 'Algo salió mal. Probá de nuevo en unos segundos.'
}
export { friendlyError }

const rowsToSeries = (rows, start) => {
  const s = Object.fromEntries(METRICS.map((m) => [m.code, []]))
  for (const r of rows) s[r.metric_code]?.push({ day: dateToDay(start, r.day), value: Number(r.value) })
  for (const k in s) s[k].sort((a, b) => a.day - b.day)
  return s
}

// =====================================================================
// MODO NUBE (Supabase)
// =====================================================================
const cloud = {
  async getUser() {
    const { data } = await supabase.auth.getSession()
    return data.session?.user ?? null
  },
  onAuthChange(cb) {
    const { data } = supabase.auth.onAuthStateChange((_e, session) => cb(session?.user ?? null))
    return () => data.subscription.unsubscribe()
  },
  async signUp({ name, email, password }) {
    const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
    if (error) throw new Error(friendlyError(error))
    if (!data.session) {
      // Si el proyecto pide confirmar el email, intentamos entrar igual.
      const r = await supabase.auth.signInWithPassword({ email, password })
      if (r.error) return { user: null, needsConfirm: true }
      return { user: r.data.user }
    }
    return { user: data.user }
  },
  async signIn({ email, password }) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw new Error(friendlyError(error))
    return { user: data.user }
  },
  async signOut() { await supabase.auth.signOut() },

  async loadAll(user) {
    const [{ data: profile }, { data: dogs }, { data: sub }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
      supabase.from('dogs').select('*').order('created_at').limit(1),
      supabase.from('subscriptions').select('*').in('status', ['trialing', 'active']).maybeSingle(),
    ])
    const dog = dogs?.[0] ?? null
    const base = { profile, dog, subscription: sub, plans: PLANS, device: null, day: 0, series: {}, baselines: {}, alerts: [], reports: [] }
    if (!dog) return base
    const [{ data: device }, { data: demo }, { data: rows }, { data: bl }, { data: alerts }, { data: reports }] = await Promise.all([
      supabase.from('devices').select('*').eq('dog_id', dog.id).maybeSingle(),
      supabase.from('demo_state').select('*').eq('dog_id', dog.id).maybeSingle(),
      supabase.from('daily_metrics').select('metric_code,day,value').eq('dog_id', dog.id).order('day'),
      supabase.from('baselines').select('*').eq('dog_id', dog.id),
      supabase.from('alerts').select('*').eq('dog_id', dog.id).order('created_at', { ascending: false }),
      supabase.from('reports').select('*').eq('dog_id', dog.id).order('created_at', { ascending: false }),
    ])
    const start = dog.monitoring_started_on
    return {
      ...base,
      device,
      day: demo?.current_day ?? 0,
      series: start ? rowsToSeries(rows || [], start) : {},
      baselines: Object.fromEntries((bl || []).map((b) => [b.metric_code, { mean: Number(b.mean_value), low: Number(b.lower_bound), high: Number(b.upper_bound) }])),
      alerts: (alerts || []).map((a) => ({ ...a, day: start ? dateToDay(start, a.window_end) : null })),
      reports: reports || [],
    }
  },

  async createDog(d) {
    const user = await this.getUser()
    const { data, error } = await supabase.from('dogs').insert({ ...d, owner_id: user.id }).select().single()
    if (error) throw new Error(friendlyError(error))
    return data
  },

  async pairCollar(dog) {
    const user = await this.getUser()
    // El collar empieza a medir "hoy": ubicamos el día 1 de forma que el día 26 de la demo sea la fecha actual.
    const start = isoDate(addDays(new Date(), -(STORY.alertDay - 1)))
    const { error: e1 } = await supabase.from('dogs').update({ monitoring_started_on: start }).eq('id', dog.id)
    if (e1) throw new Error(friendlyError(e1))
    const { data, error } = await supabase.from('devices')
      .insert({ owner_id: user.id, dog_id: dog.id, paired_at: new Date().toISOString(), last_sync_at: new Date().toISOString() })
      .select().single()
    if (error) throw new Error(friendlyError(error))
    await this.setDay({ ...dog, monitoring_started_on: start }, 1)
    return data
  },

  async setDay(dog, day) {
    const start = dog.monitoring_started_on
    const asOf = isoDate(dayToDate(start, day))
    // Lo posterior al día elegido se descarta (permite volver atrás en la demo).
    await Promise.all([
      supabase.from('daily_metrics').delete().eq('dog_id', dog.id).gt('day', asOf),
      supabase.from('alerts').delete().eq('dog_id', dog.id).gt('window_end', asOf),
      supabase.from('ai_insights').delete().eq('dog_id', dog.id).gt('as_of', asOf),
    ])
    if (day < 14) await supabase.from('baselines').delete().eq('dog_id', dog.id)
    // Sincronización del collar: un valor por indicador y día.
    const rows = []
    for (let d = 1; d <= day; d++) {
      const date = isoDate(dayToDate(start, d))
      for (const m of METRICS) rows.push({ dog_id: dog.id, metric_code: m.code, day: date, value: simulatedValue(m.code, d), source: 'simulation' })
    }
    const { error } = await supabase.from('daily_metrics').upsert(rows, { onConflict: 'dog_id,metric_code,day' })
    if (error) throw new Error(friendlyError(error))
    await supabase.from('demo_state').upsert({ dog_id: dog.id, current_day: day, updated_at: new Date().toISOString() })
    await supabase.from('devices').update({ last_sync_at: new Date().toISOString() }).eq('dog_id', dog.id)
    const { data, error: e2 } = await supabase.rpc('refresh_dog_analytics', { p_dog: dog.id, p_as_of: asOf })
    if (e2) throw new Error(friendlyError(e2))
    return { newAlertId: data?.new_alert_id ?? null }
  },

  async resetDemo(dog) {
    await Promise.all([
      supabase.from('ai_messages').delete().eq('dog_id', dog.id),
      supabase.from('reports').delete().eq('dog_id', dog.id),
      supabase.from('alerts').delete().eq('dog_id', dog.id),
      supabase.from('baselines').delete().eq('dog_id', dog.id),
      supabase.from('ai_insights').delete().eq('dog_id', dog.id),
    ])
    await supabase.from('daily_metrics').delete().eq('dog_id', dog.id)
    return this.setDay(dog, 1)
  },

  async updateAlert(id, status) {
    const patch = { status }
    if (status === 'seen' || status === 'watching') patch.seen_at = new Date().toISOString()
    if (status === 'resolved') patch.resolved_at = new Date().toISOString()
    await supabase.from('alerts').update(patch).eq('id', id)
  },

  async createReport(dog, r) {
    const { data, error } = await supabase.from('reports').insert({ dog_id: dog.id, ...r }).select().single()
    if (error) throw new Error(friendlyError(error))
    return data
  },

  async startPremium() {
    const { data, error } = await supabase.rpc('start_premium_trial')
    if (error) throw new Error(friendlyError(error))
    return data
  },
  async cancelPremium() {
    const { data, error } = await supabase.rpc('cancel_premium')
    if (error) throw new Error(friendlyError(error))
    return data
  },

  async getMessages(dog) {
    const { data } = await supabase.from('ai_messages').select('role,content,created_at').eq('dog_id', dog.id).order('created_at')
    return data || []
  },
  async getInsight(dog, asOf) {
    const { data } = await supabase.from('ai_insights').select('content,as_of').eq('dog_id', dog.id).eq('as_of', asOf)
      .order('created_at', { ascending: false }).limit(1)
    return data?.[0]?.content ?? null
  },
  async ai(action, dog, asOf, message) {
    const { data, error } = await supabase.functions.invoke('numa-ai', { body: { action, dogId: dog.id, asOf, message } })
    if (error) {
      let detail = ''
      try { detail = (await error.context.json()).error } catch { /* sin detalle */ }
      throw new Error(detail || 'El asistente no está disponible en este momento. Probá de nuevo en unos minutos.')
    }
    return data.content
  },
}

// =====================================================================
// MODO DEMO (en memoria)
// =====================================================================
const mem = { user: null, profile: null, dog: null, device: null, day: 0, alerts: [], reports: [], sub: null, messages: [], listeners: new Set() }
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36)
const memSeries = () => {
  const s = Object.fromEntries(METRICS.map((m) => [m.code, []]))
  for (let d = 1; d <= mem.day; d++) for (const m of METRICS) s[m.code].push({ day: d, value: simulatedValue(m.code, d) })
  return s
}
const demo = {
  async getUser() { return mem.user },
  onAuthChange(cb) { mem.listeners.add(cb); return () => mem.listeners.delete(cb) },
  async signUp({ name, email }) {
    mem.user = { id: uid(), email }
    mem.profile = { id: mem.user.id, full_name: name }
    mem.sub = { plan_code: 'basic', status: 'active' }
    return { user: mem.user }
  },
  async signIn({ email }) {
    if (!mem.user) { mem.user = { id: uid(), email }; mem.profile = { id: mem.user.id, full_name: '' }; mem.sub = { plan_code: 'basic', status: 'active' } }
    return { user: mem.user }
  },
  async signOut() { Object.assign(mem, { user: null, profile: null, dog: null, device: null, day: 0, alerts: [], reports: [], messages: [] }); mem.listeners.forEach((l) => l(null)) },
  async loadAll() {
    const series = memSeries()
    const baselines = mem.day >= 14 ? computeBaselines(series) : {}
    const start = mem.dog?.monitoring_started_on
    return {
      profile: mem.profile, dog: mem.dog, device: mem.device, subscription: mem.sub, plans: PLANS,
      day: mem.day, series, baselines, alerts: mem.alerts.map((a) => ({ ...a, day: start ? dateToDay(start, a.window_end) : null })), reports: mem.reports,
    }
  },
  async createDog(d) { mem.dog = { id: uid(), ...d }; return mem.dog },
  async pairCollar(dog) {
    mem.dog = { ...dog, monitoring_started_on: isoDate(addDays(new Date(), -(STORY.alertDay - 1))) }
    mem.device = { id: uid(), serial: 'NM-' + Math.random().toString(16).slice(2, 8).toUpperCase(), battery_pct: 100, firmware_version: '1.0.0', paired_at: new Date().toISOString(), last_sync_at: new Date().toISOString() }
    await this.setDay(mem.dog, 1)
    return mem.device
  },
  async setDay(dog, day) {
    mem.day = day
    const start = mem.dog.monitoring_started_on
    mem.alerts = mem.alerts.filter((a) => dateToDay(start, a.window_end) <= day)
    if (day < 14) return { newAlertId: null }
    const series = memSeries()
    const bl = computeBaselines(series)
    const changes = detectChanges(series, bl, day)
    const open = mem.alerts.some((a) => a.status !== 'resolved' && dateToDay(start, a.window_end) >= day - 2)
    if (changes.length && !open) {
      const a = {
        id: uid(), status: 'new', severity: 'change', changes,
        window_start: isoDate(dayToDate(start, day - 2)), window_end: isoDate(dayToDate(start, day)),
        title: 'Cambio sostenido en ' + changes.map((c) => METRIC[c.metric_code].lower).join(' y '),
        created_at: new Date().toISOString(),
      }
      mem.alerts.unshift(a)
      return { newAlertId: a.id }
    }
    return { newAlertId: null }
  },
  async resetDemo(dog) { mem.alerts = []; mem.reports = []; mem.messages = []; return this.setDay(dog, 1) },
  async updateAlert(id, status) { const a = mem.alerts.find((x) => x.id === id); if (a) a.status = status },
  async createReport(_dog, r) { const rep = { id: uid(), created_at: new Date().toISOString(), ...r }; mem.reports.unshift(rep); return rep },
  async startPremium() { mem.sub = { plan_code: 'premium', status: 'trialing', trial_ends_at: addDays(new Date(), 90).toISOString() }; return mem.sub },
  async cancelPremium() { mem.sub = { plan_code: 'basic', status: 'active' }; return mem.sub },
  async getMessages() { return mem.messages },
  async getInsight() { return null },
  async ai(action, dog, asOf, message) {
    await new Promise((r) => setTimeout(r, 900))
    const series = memSeries(); const bl = computeBaselines(series); const day = mem.day
    const p = (c) => fmtPct(pctVsBaseline(series, bl, c, day))
    const n = dog.name
    if (action === 'insight') {
      return `**Resumen**\n${n} mantuvo un patrón estable durante las primeras semanas. En los últimos 3 días bajaron su actividad (${p('activity_minutes')}) y el tiempo que pasa comiendo (${p('feeding_minutes')}). El rascado y la hidratación siguen dentro de su rango habitual.\n\n**Qué te sugerimos**\n- Observá si aparece otro signo, como vómitos, diarrea o desgano marcado.\n- Ofrecé agua fresca y paseos cortos.\n- Si el cambio sigue 24 a 48 horas más, consultá a tu veterinario y llevá el informe.\n\n_Esto es orientativo y no reemplaza la consulta veterinaria._`
    }
    mem.messages.push({ role: 'user', content: message })
    const q = message.toLowerCase()
    let reply
    if (q.includes('com')) reply = `En los últimos días ${n} pasa menos tiempo comiendo (${p('feeding_minutes')} respecto de su patrón). Puede deberse a muchas cosas, desde calor o cambios de rutina hasta algo que requiera atención. Ofrecele su comida habitual en horarios fijos y anotá cuánto deja. Si sigue igual 24 a 48 horas más, consultá a tu veterinario.`
    else if (q.includes('veterin')) reply = `Te recomendaría consultar si el cambio sigue 24 a 48 horas más, o antes si aparece otro síntoma como vómitos, diarrea, tos o dolor al moverse. Podés generar el informe desde la pestaña Informes para llevarlo a la consulta.`
    else reply = `Con los datos de ${n}, lo más relevante hoy es la baja de actividad (${p('activity_minutes')}) y de alimentación (${p('feeding_minutes')}). ¿Querés que te sugiera qué observar en casa?`
    mem.messages.push({ role: 'assistant', content: reply })
    return reply
  },
}

export const api = MODE === 'cloud' ? cloud : demo

// ---------- Helpers de presentación compartidos ----------
export function changeHeadline(dog, changes) {
  const fem = dog?.sex !== 'male'
  const order = (c) => METRICS.findIndex((m) => m.code === c.metric_code)
  const parts = [...changes].sort((a, b) => order(a) - order(b)).map((c) => {
    const down = c.pct < 0
    switch (c.metric_code) {
      case 'activity_minutes': return down ? `menos ${fem ? 'activa' : 'activo'}` : `más ${fem ? 'activa' : 'activo'}`
      case 'feeding_minutes': return down ? 'comiendo menos' : 'comiendo más'
      case 'rest_quality_pct': return down ? 'descansando peor' : 'descansando mejor'
      case 'sleep_hours': return down ? 'durmiendo menos' : 'durmiendo más'
      case 'drinking_events': return down ? 'tomando menos agua' : 'tomando más agua'
      case 'scratching_episodes': return down ? 'rascándose menos' : 'rascándose más'
      case 'resting_heart_rate': return down ? 'con el pulso en reposo más bajo' : 'con el pulso en reposo más alto'
      case 'resting_resp_rate': return down ? 'respirando más lento en reposo' : 'respirando más rápido en reposo'
      default: return METRIC[c.metric_code]?.lower
    }
  })
  const list = parts.length > 1 ? parts.slice(0, -1).join(', ') + ' y ' + parts.at(-1) : parts[0]
  return `${dog?.name ?? 'Tu perro'} está ${list} que lo habitual`
}
export { fmtNum }
