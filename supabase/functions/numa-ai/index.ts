// Nüma IA · Edge Function
// Acciones:
//   - insight: análisis de los datos recientes del perro (se guarda en ai_insights)
//   - chat:    respuesta a una pregunta del dueño (se guarda en ai_messages)
// Requiere sesión (JWT) y plan Premium. Todas las lecturas y escrituras usan
// la sesión del usuario, por lo que Row Level Security sigue aplicando.
// Secretos: GEMINI_API_KEY (obligatorio), GEMINI_MODEL (opcional).
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const MAX_MESSAGE = 500
const MAX_MESSAGES_PER_HOUR = 40

const SYSTEM = `Sos Nüma IA, el asistente de la app Nüma, un collar inteligente que registra el comportamiento de perros y lo compara con su propio patrón habitual.

Reglas:
- Hablás en español rioplatense, con voseo, en tono cálido y claro. Nada de tecnicismos innecesarios.
- No diagnosticás enfermedades ni indicás medicamentos o dosis. Describís cambios de comportamiento y sugerís qué observar.
- Si aparecen señales de alarma (no come ni toma agua por más de 24 horas, vómitos o diarrea repetidos, dificultad para respirar, decaimiento marcado, dolor, convulsiones o sangrado), recomendás consultar al veterinario cuanto antes.
- Ante un cambio sostenido sin otros síntomas, sugerís observar y consultar si sigue 24 a 48 horas más.
- Usás solo los datos que te pasan. No inventás valores. Si algo no se puede saber con esos datos, lo decís.
- Para raciones usás la estimación RER = 70 × peso^0,75, multiplicada por 1,6 en adultos castrados o 1,8 en adultos enteros, y aclarás que es orientativa y que la confirme el veterinario.
- Formato: texto breve. Podés usar **negrita** y listas con "- ". No uses títulos con #.`

type Metric = { code: string; short_name: string; unit: string; decimals: number }

async function callGemini(apiKey: string, model: string, contents: unknown[], maxTokens: number) {
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents,
    generationConfig: { temperature: 0.5, maxOutputTokens: maxTokens },
  })
  const models = [model, 'gemini-flash-latest', 'gemini-2.5-flash'].filter((m, i, a) => m && a.indexOf(m) === i)
  let lastErr = ''
  for (const m of models) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey }, body,
    })
    if (r.ok) {
      const data = await r.json()
      const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('').trim()
      if (text) return { text, model: m }
      lastErr = 'empty'
      continue
    }
    lastErr = `${r.status}`
    if (r.status !== 404) break
  }
  throw new Error(`gemini:${lastErr}`)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido.' }, 405)

  try {
    const auth = req.headers.get('Authorization') ?? ''
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    })
    const { data: { user } } = await db.auth.getUser()
    if (!user) return json({ error: 'Tu sesión venció. Volvé a iniciar sesión.' }, 401)

    const { action, dogId, asOf, message } = await req.json().catch(() => ({}))
    if (!['insight', 'chat'].includes(action) || typeof dogId !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(asOf ?? '')) {
      return json({ error: 'Pedido inválido.' }, 400)
    }
    const question = typeof message === 'string' ? message.trim() : ''
    if (action === 'chat' && (!question || question.length > MAX_MESSAGE)) {
      return json({ error: `La pregunta tiene que tener entre 1 y ${MAX_MESSAGE} caracteres.` }, 400)
    }

    const { data: sub } = await db.from('subscriptions').select('plan_code').in('status', ['trialing', 'active']).maybeSingle()
    if (sub?.plan_code !== 'premium') return json({ error: 'Nüma IA está disponible en el Plan Premium.' }, 402)

    const apiKey = Deno.env.get('GEMINI_API_KEY')
    if (!apiKey) return json({ error: 'Falta configurar la clave de IA del proyecto.' }, 503)

    if (action === 'chat') {
      const since = new Date(Date.now() - 3600_000).toISOString()
      const { count } = await db.from('ai_messages').select('id', { count: 'exact', head: true })
        .eq('role', 'user').gte('created_at', since)
      if ((count ?? 0) >= MAX_MESSAGES_PER_HOUR) return json({ error: 'Llegaste al límite de preguntas por hora. Probá más tarde.' }, 429)
    }

    // ---------- Contexto del perro ----------
    const { data: dog } = await db.from('dogs').select('*').eq('id', dogId).maybeSingle()
    if (!dog) return json({ error: 'No encontramos ese perro.' }, 404)
    const from = new Date(asOf); from.setDate(from.getDate() - 13)
    const fromISO = from.toISOString().slice(0, 10)
    const [{ data: types }, { data: baselines }, { data: rows }, { data: alerts }] = await Promise.all([
      db.from('metric_types').select('code,short_name,unit,decimals').order('sort_order'),
      db.from('baselines').select('metric_code,mean_value,lower_bound,upper_bound').eq('dog_id', dogId),
      db.from('daily_metrics').select('metric_code,day,value').eq('dog_id', dogId).gte('day', fromISO).lte('day', asOf).order('day'),
      db.from('alerts').select('title,window_start,window_end,status,changes').eq('dog_id', dogId).lte('window_end', asOf)
        .order('created_at', { ascending: false }).limit(3),
    ])
    const age = dog.birth_date ? Math.floor((Date.parse(asOf) - Date.parse(dog.birth_date)) / 31557600000) : null
    const start = dog.monitoring_started_on
    const dayN = start ? Math.round((Date.parse(asOf) - Date.parse(start)) / 86400000) + 1 : null
    const lines = (types as Metric[] ?? []).map((t) => {
      const b = baselines?.find((x) => x.metric_code === t.code)
      const vals = (rows ?? []).filter((r) => r.metric_code === t.code).map((r) => Number(r.value))
      const last3 = vals.slice(-3)
      const avg3 = last3.length ? last3.reduce((s, v) => s + v, 0) / last3.length : null
      const pct = b && avg3 != null ? Math.round(((avg3 - Number(b.mean_value)) / Number(b.mean_value)) * 100) : null
      return `- ${t.short_name} (${t.unit}): patrón ${b ? Number(b.mean_value) : 'aún sin patrón'}; últimos 14 días [${vals.join(', ')}]; variación últimos 3 días ${pct == null ? 's/d' : `${pct > 0 ? '+' : ''}${pct}%`}`
    }).join('\n')
    const alertTxt = (alerts ?? []).length
      ? (alerts ?? []).map((a) => `- ${a.title} (${a.window_start} a ${a.window_end}, estado ${a.status})`).join('\n')
      : '- Sin alertas.'
    const context = `Perro: ${dog.name}, ${dog.breed ?? 'raza sin dato'}, ${dog.sex === 'male' ? 'macho' : 'hembra'}${dog.neutered ? (dog.sex === 'male' ? ' castrado' : ' castrada') : ''}, ${age ?? '?'} años, ${dog.weight_kg ?? '?'} kg.
Condiciones informadas por el dueño: ${dog.known_conditions || 'ninguna'}.
Fecha de hoy: ${asOf}. Día ${dayN ?? '?'} de monitoreo (el patrón habitual son los días 1 a 14).
Indicadores:
${lines}
Alertas recientes:
${alertTxt}`

    const apiModel = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest'

    if (action === 'insight') {
      const prompt = `${context}

Escribí el análisis de la semana para el dueño en hasta 170 palabras con esta estructura:
**Resumen** (2 o 3 oraciones sobre cómo estuvo y qué cambió)
**Qué te sugerimos** (3 viñetas concretas)
Cerrá con una línea en itálica, entre guiones bajos, aclarando que es orientativo y no reemplaza al veterinario.`
      const { text, model } = await callGemini(apiKey, apiModel, [{ role: 'user', parts: [{ text: prompt }] }], 1200)
      await db.from('ai_insights').insert({ dog_id: dogId, as_of: asOf, content: text, model })
      return json({ content: text })
    }

    // chat
    const { data: history } = await db.from('ai_messages').select('role,content').eq('dog_id', dogId)
      .order('created_at', { ascending: false }).limit(12)
    const past = (history ?? []).reverse().map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
    const contents = [
      { role: 'user', parts: [{ text: `Datos actuales para responder:\n${context}` }] },
      { role: 'model', parts: [{ text: `Entendido. Tengo los datos de ${dog.name}.` }] },
      ...past,
      { role: 'user', parts: [{ text: `${question}\n\n(Respondé en hasta 120 palabras.)` }] },
    ]
    const { text } = await callGemini(apiKey, apiModel, contents, 900)
    const { error: insErr } = await db.from('ai_messages').insert([
      { dog_id: dogId, user_id: user.id, role: 'user', content: question },
      { dog_id: dogId, user_id: user.id, role: 'assistant', content: text.slice(0, 6000) },
    ])
    if (insErr) console.error('ai_messages insert', insErr.message)
    return json({ content: text })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('numa-ai', msg)
    if (msg.startsWith('gemini:429')) return json({ error: 'El asistente está con mucha demanda. Probá de nuevo en un minuto.' }, 429)
    if (msg.startsWith('gemini:400') || msg.startsWith('gemini:403')) return json({ error: 'La clave de IA no es válida o no tiene acceso. Revisala en la configuración.' }, 503)
    return json({ error: 'El asistente no está disponible en este momento. Probá de nuevo en unos minutos.' }, 500)
  }
})
