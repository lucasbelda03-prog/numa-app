import { useEffect, useRef, useState } from 'react'
import { Icon, Markdown, NavBar } from '../components.jsx'
import { api } from '../lib/api.js'
import { isoDate, dayToDate, BASELINE_DAYS } from '../lib/metrics.js'

export function Paywall({ data, onStart, onBack, busy }) {
  const premium = data.plans.find((p) => p.code === 'premium')
  return (
    <div className="screen push"><div className="scroll"><div className="page">
      <NavBar onBack={onBack} />
      <div style={{ display: 'grid', placeItems: 'center', marginTop: 4 }}>
        <span className="bubble-ic" style={{ width: 76, height: 76, borderRadius: 24, background: 'var(--green)', color: '#fff' }}><Icon name="spark" size={36} /></span>
      </div>
      <h1 className="large-title" style={{ textAlign: 'center' }}>Nüma IA</h1>
      <p className="body" style={{ textAlign: 'center' }}>Un asistente que entiende los datos de {data.dog.name} y te responde en lenguaje simple.</p>
      <div className="plan featured">
        <span className="badge">3 meses sin cargo</span>
        <div className="price" style={{ marginTop: 12 }}>USD {premium.price_usd_month} <small>por mes después</small></div>
        <ul>{premium.features.map((t) => <li key={t}><Icon name="check" size={18} stroke={2.6} />{t}</li>)}</ul>
        <button className="btn btn-primary" style={{ marginTop: 18 }} onClick={onStart} disabled={busy}>{busy ? 'Activando…' : 'Probar 3 meses gratis'}</button>
      </div>
      <p className="caption" style={{ textAlign: 'center' }}>Sin permanencia: te das de baja cuando quieras desde tu perfil.</p>
    </div></div></div>
  )
}

const SUGGESTIONS = (dog) => [`¿Por qué ${dog.name} está comiendo menos?`, `¿Cuándo debería ${dog.sex === 'male' ? 'llevarlo' : 'llevarla'} al veterinario?`, '¿Cuánto debería comer por día?']

export function Assistant({ data, onBack }) {
  const { dog, day } = data
  const asOf = isoDate(dayToDate(dog.monitoring_started_on, day))
  const [insight, setInsight] = useState(null)
  const [loadingInsight, setLoadingInsight] = useState(false)
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const end = useRef()

  useEffect(() => {
    let live = true
    api.getMessages(dog).then((m) => live && setMsgs(m))
    api.getInsight(dog, asOf).then((c) => live && c && setInsight(c))
    return () => { live = false }
  }, [dog.id, asOf])
  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [msgs.length, sending])

  async function analyze() {
    setLoadingInsight(true); setErr('')
    try { setInsight(await api.ai('insight', dog, asOf)) } catch (e) { setErr(e.message) } finally { setLoadingInsight(false) }
  }
  async function send(q) {
    const message = (q ?? text).trim()
    if (!message || sending) return
    setText(''); setErr('')
    setMsgs((m) => [...m, { role: 'user', content: message }])
    setSending(true)
    try {
      const reply = await api.ai('chat', dog, asOf, message)
      setMsgs((m) => [...m, { role: 'assistant', content: reply }])
    } catch (e) { setErr(e.message) } finally { setSending(false) }
  }

  const tooEarly = day < BASELINE_DAYS
  return (
    <div className="screen push">
      <div className="scroll"><div className="page">
        <NavBar onBack={onBack} />
        <div><h1 className="large-title">Nüma IA</h1><p className="body" style={{ marginTop: 6 }}>Análisis y respuestas sobre {dog.name}.</p></div>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <span className="bubble-ic" style={{ background: 'var(--green)', color: '#fff' }}><Icon name="spark" size={20} /></span>
            <div className="headline" style={{ flex: 1 }}>Análisis de la semana</div>
          </div>
          {tooEarly ? <p className="callout">El análisis está disponible cuando termina el período de aprendizaje (día {BASELINE_DAYS}).</p>
            : loadingInsight ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }} role="status" aria-label="Generando análisis"><div className="skeleton" style={{ height: 14 }} /><div className="skeleton" style={{ height: 14, width: '85%' }} /><div className="skeleton" style={{ height: 14, width: '70%' }} /></div>
              : insight ? <div className="callout" style={{ color: 'var(--ink)' }}><Markdown text={insight} /></div>
                : <p className="callout">Generá un resumen de cómo estuvo {dog.name} y qué te conviene observar.</p>}
          {!tooEarly && !loadingInsight && (
            <button className="btn btn-tint" style={{ marginTop: 14, minHeight: 48 }} onClick={analyze}>{insight ? 'Actualizar análisis' : 'Generar análisis'}</button>
          )}
        </div>

        <h2 className="section">Preguntale a Nüma</h2>
        <div className="chat" aria-live="polite">
          {msgs.length === 0 && SUGGESTIONS(dog).map((s) => (
            <button key={s} className="suggest" onClick={() => send(s)}><span style={{ color: 'var(--green)' }}><Icon name="spark" size={18} /></span>{s}</button>
          ))}
          {msgs.map((m, i) => (
            <div key={i} className={`bubble ${m.role}`}>{m.role === 'assistant' ? <Markdown text={m.content} /> : m.content}</div>
          ))}
          {sending && <div className="bubble assistant" aria-label="Nüma está escribiendo"><span className="typing"><i /><i /><i /></span></div>}
          {err && <div className="error" role="alert"><Icon name="info" size={18} />{err}</div>}
          <div ref={end} />
        </div>
        <p className="caption">Las respuestas son orientativas y no reemplazan la consulta veterinaria.</p>
      </div></div>
      <form className="composer" onSubmit={(e) => { e.preventDefault(); send() }}>
        <label className="sr-only" htmlFor="ask">Escribí tu pregunta</label>
        <input id="ask" className="input" placeholder={`Preguntá sobre ${dog.name}…`} value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoComplete="off" />
        <button className="send" type="submit" disabled={!text.trim() || sending} aria-label="Enviar"><Icon name="send" size={20} /></button>
      </form>
    </div>
  )
}
