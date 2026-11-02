import { useCallback, useEffect, useState } from 'react'
import { api, changeHeadline } from './lib/api.js'
import { Icon, Logo, Snackbar, Spinner } from './components.jsx'
import { Welcome, Auth, DogSetup, Pair, Fit } from './screens/Onboarding.jsx'
import { Home, Trends, AlertView } from './screens/Home.jsx'
import { Assistant, Paywall } from './screens/Assistant.jsx'
import { ReportsList, NewReport, ReportView } from './screens/Reports.jsx'
import { Profile, Plans } from './screens/Profile.jsx'
import { BASELINE_DAYS } from './lib/metrics.js'

const TABS = [
  ['home', 'Hoy', 'home'],
  ['trends', 'Tendencias', 'chart'],
  ['ai', 'Nüma IA', 'spark'],
  ['reports', 'Informes', 'file'],
  ['profile', 'Perfil', 'user'],
]

export default function App() {
  const [user, setUser] = useState(undefined)
  const [entry, setEntry] = useState('welcome')
  const [data, setData] = useState(null)
  const [fit, setFit] = useState(false)
  const [tab, setTab] = useState('home')
  const [overlay, setOverlay] = useState(null) // {type, ...}
  const [metric, setMetric] = useState('activity_minutes')
  const [busy, setBusy] = useState(false)
  const [snack, setSnack] = useState('')
  const [push, setPush] = useState(null)
  const [loadErr, setLoadErr] = useState('')

  const reload = useCallback(async (u = user) => {
    if (!u) return
    try { setLoadErr(''); setData(await api.loadAll(u)) } catch { setLoadErr('No pudimos cargar tus datos. Revisá tu conexión.') }
  }, [user])

  useEffect(() => {
    api.getUser().then((u) => { setUser(u); if (u) reload(u) })
    return api.onAuthChange((u) => { setUser(u); if (!u) { setData(null); setTab('home'); setOverlay(null) } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { if (!push) return; const t = setTimeout(() => setPush(null), 9000); return () => clearTimeout(t) }, [push])

  async function setDay(day) {
    if (!data?.dog) return
    setBusy(true)
    try {
      const { newAlertId } = await api.setDay(data.dog, day)
      const fresh = await api.loadAll(user)
      setData(fresh)
      if (newAlertId) {
        const a = fresh.alerts.find((x) => x.id === newAlertId)
        if (a) setTimeout(() => setPush(a), 500)
      }
      return fresh
    } catch (e) { setSnack(e.message) } finally { setBusy(false) }
  }

  async function openAlert(a) {
    setPush(null)
    setOverlay({ type: 'alert', alert: a })
    if (a.status === 'new') { await api.updateAlert(a.id, 'seen'); reload() }
  }

  async function startPremium() {
    setBusy(true)
    try { await api.startPremium(); await reload(); setSnack('Premium activado: 3 meses sin cargo') } catch (e) { setSnack(e.message) } finally { setBusy(false) }
  }
  async function cancelPremium() {
    setBusy(true)
    try { await api.cancelPremium(); await reload(); setOverlay(null); setSnack('Listo. Seguís con el Plan Básico') } catch (e) { setSnack(e.message) } finally { setBusy(false) }
  }

  // ---------- Sin sesión ----------
  let body
  if (user === undefined) {
    body = <div className="screen"><div className="center-state"><Logo size={48} /></div></div>
  } else if (!user) {
    body = entry === 'welcome'
      ? <Welcome onStart={() => setEntry('signup')} onLogin={() => setEntry('login')} />
      : <Auth key={entry} initialMode={entry} onBack={() => setEntry('welcome')} onDone={(u) => { setUser(u); reload(u) }} />
  } else if (!data) {
    body = loadErr
      ? <div className="screen"><div className="center-state"><p className="body">{loadErr}</p><button className="btn btn-primary" onClick={() => reload()}>Reintentar</button></div></div>
      : <div className="screen"><Spinner label="Cargando…" /></div>
  } else if (!data.dog) {
    body = <DogSetup onDone={() => reload()} />
  } else if (!data.device) {
    body = <Pair dog={data.dog} onDone={async () => { setFit(true); await reload() }} />
  } else if (fit) {
    body = <Fit dog={data.dog} onDone={() => { setFit(false); setTab('home') }} />
  } else if (overlay?.type === 'alert') {
    const a = data.alerts.find((x) => x.id === overlay.alert.id) || overlay.alert
    body = <AlertView data={data} alert={a} onBack={() => setOverlay(null)}
      onReport={() => setOverlay({ type: 'newReport', from: 'alert', alert: a })}
      onWatch={async () => { await api.updateAlert(a.id, 'watching'); await reload(); setOverlay(null); setSnack('Te volvemos a avisar si el cambio continúa') }} />
  } else if (overlay?.type === 'newReport') {
    body = <NewReport data={data} onBack={() => setOverlay(overlay.from === 'alert' ? { type: 'alert', alert: overlay.alert } : null)}
      onCreated={async (r) => { await reload(); setOverlay({ type: 'report', report: r }) }} />
  } else if (overlay?.type === 'report') {
    body = <ReportView report={overlay.report} onBack={() => { setOverlay(null); setTab('reports') }} onSnack={setSnack} />
  } else if (overlay?.type === 'plans') {
    body = <Plans data={data} busy={busy} onBack={() => setOverlay(null)} onStart={startPremium} onCancel={cancelPremium} />
  } else {
    const premium = data.subscription?.plan_code === 'premium'
    const hasNew = data.alerts.some((a) => a.status === 'new')
    body = (
      <div className="screen" key={tab}>
        {tab === 'home' && <Home data={data} onOpenAlert={openAlert} onOpenMetric={(c) => { setMetric(c); setTab('trends') }}
          onGoPremium={() => setTab('ai')} onGoAssistant={() => setTab('ai')} onAdvance={() => setDay(BASELINE_DAYS)} />}
        {tab === 'trends' && <Trends data={data} metric={metric} onMetric={setMetric} />}
        {tab === 'ai' && (premium ? <Assistant data={data} /> : <Paywall data={data} onStart={startPremium} busy={busy} />)}
        {tab === 'reports' && <ReportsList data={data} onNew={() => setOverlay({ type: 'newReport' })} onOpen={(r) => setOverlay({ type: 'report', report: r })} />}
        {tab === 'profile' && <Profile data={data} user={user} busy={busy} onSetDay={setDay} onReset={async () => { setBusy(true); try { await api.resetDemo(data.dog); await reload() } finally { setBusy(false) } }}
          onPlans={() => setOverlay({ type: 'plans' })} onSignOut={() => api.signOut()} />}
        <nav className="tabbar" aria-label="Secciones">
          {TABS.map(([id, label, icon]) => (
            <button key={id} onClick={() => setTab(id)} aria-current={tab === id ? 'page' : undefined}>
              <Icon name={icon} size={23} />{label}
              {id === 'home' && hasNew && tab !== 'home' && <span className="dot" aria-label="Alerta nueva" />}
            </button>
          ))}
        </nav>
      </div>
    )
  }

  return (
    <div className="shell">
      <main className="app">
        {body}
        {push && data?.dog && (
          <button className="toast-push" onClick={() => openAlert(push)} aria-label="Abrir alerta de Nüma">
            <span className="app-ico"><Logo size={13} color="var(--cream)" paws="var(--sand)" /></span>
            <span style={{ flex: 1 }}>
              <span className="t">Nüma <span>ahora</span></span>
              <p><b>{changeHeadline(data.dog, push.changes)}</b> desde hace 3 días. Tocá para ver qué hacer.</p>
            </span>
          </button>
        )}
        {snack && <Snackbar text={snack} onDone={() => setSnack('')} />}
      </main>
    </div>
  )
}
