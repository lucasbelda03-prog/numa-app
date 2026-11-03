import { useCallback, useEffect, useState } from 'react'
import { api, changeHeadline } from './lib/api.js'
import { Logo, Snackbar, Spinner } from './components.jsx'
import { Welcome, Auth, DogSetup, Pair, Fit } from './screens/Onboarding.jsx'
import { Home, CategoryDetail, AlertView } from './screens/Home.jsx'
import { Assistant, Paywall } from './screens/Assistant.jsx'
import { ReportsList, NewReport, ReportView } from './screens/Reports.jsx'
import { Profile, Plans } from './screens/Profile.jsx'
import { BASELINE_DAYS } from './lib/metrics.js'

// Navegación: el inicio es la base y cada tarjeta abre una pantalla encima (pila).
export default function App() {
  const [user, setUser] = useState(undefined)
  const [entry, setEntry] = useState('welcome')
  const [data, setData] = useState(null)
  const [fit, setFit] = useState(false)
  const [stack, setStack] = useState([])
  const [busy, setBusy] = useState(false)
  const [snack, setSnack] = useState('')
  const [push, setPush] = useState(null)
  const [loadErr, setLoadErr] = useState('')

  const open = (screen) => setStack((s) => [...s, screen])
  const back = () => setStack((s) => s.slice(0, -1))
  const replaceTop = (screen) => setStack((s) => [...s.slice(0, -1), screen])

  const reload = useCallback(async (u = user) => {
    if (!u) return
    try { setLoadErr(''); setData(await api.loadAll(u)) } catch { setLoadErr('No pudimos cargar tus datos. Revisá tu conexión.') }
  }, [user])

  useEffect(() => {
    api.getUser().then((u) => { setUser(u); if (u) reload(u) })
    return api.onAuthChange((u) => { setUser(u); if (!u) { setData(null); setStack([]) } })
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
    } catch (e) { setSnack(e.message) } finally { setBusy(false) }
  }

  async function openAlert(a) {
    setPush(null)
    setStack([{ type: 'alert', id: a.id }])
    if (a.status === 'new') { await api.updateAlert(a.id, 'seen'); reload() }
  }

  async function startPremium() {
    setBusy(true)
    try { await api.startPremium(); await reload(); setSnack('Premium activado: 3 meses sin cargo') } catch (e) { setSnack(e.message) } finally { setBusy(false) }
  }
  async function cancelPremium() {
    setBusy(true)
    try { await api.cancelPremium(); await reload(); back(); setSnack('Listo. Seguís con el Plan Básico') } catch (e) { setSnack(e.message) } finally { setBusy(false) }
  }

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
    body = <Fit dog={data.dog} onDone={() => { setFit(false); setStack([]) }} />
  } else {
    const top = stack[stack.length - 1]
    const premium = data.subscription?.plan_code === 'premium'
    if (!top) {
      body = (
        <div className="screen fade">
          <Home data={data}
            onOpenCategory={(id) => open({ type: 'category', id })}
            onOpenAlert={openAlert}
            onOpenAI={() => open({ type: 'ai' })}
            onOpenReports={() => open({ type: 'reports' })}
            onOpenProfile={() => open({ type: 'profile' })}
            onAdvance={() => setDay(BASELINE_DAYS)} />
        </div>
      )
    } else if (top.type === 'category') {
      body = <CategoryDetail key={top.id} data={data} catId={top.id} onBack={back} />
    } else if (top.type === 'alert') {
      const a = data.alerts.find((x) => x.id === top.id)
      body = a
        ? <AlertView data={data} alert={a} onBack={back}
            onReport={() => open({ type: 'newReport', fromAlert: true })}
            onWatch={async () => { await api.updateAlert(a.id, 'watching'); await reload(); back(); setSnack('Te volvemos a avisar si el cambio continúa') }} />
        : <div className="screen"><div className="center-state"><p className="body">Esta alerta ya no está disponible.</p><button className="btn btn-primary" onClick={back}>Volver</button></div></div>
    } else if (top.type === 'ai') {
      body = premium ? <Assistant data={data} onBack={back} /> : <Paywall data={data} onBack={back} onStart={startPremium} busy={busy} />
    } else if (top.type === 'reports') {
      body = <ReportsList data={data} onBack={back} onNew={() => open({ type: 'newReport' })} onOpen={(r) => open({ type: 'report', report: r })} />
    } else if (top.type === 'newReport') {
      body = <NewReport data={data} onBack={back} onCreated={async (r) => { await reload(); replaceTop({ type: 'report', report: r }) }} />
    } else if (top.type === 'report') {
      body = <ReportView report={top.report} onBack={back} onSnack={setSnack} />
    } else if (top.type === 'profile') {
      body = <Profile data={data} user={user} busy={busy} onBack={back} onSetDay={setDay}
        onReset={async () => { setBusy(true); try { await api.resetDemo(data.dog); await reload() } finally { setBusy(false) } }}
        onPlans={() => open({ type: 'plans' })} onSignOut={() => api.signOut()} />
    } else if (top.type === 'plans') {
      body = <Plans data={data} busy={busy} onBack={back} onStart={startPremium} onCancel={cancelPremium} />
    }
  }

  return (
    <div className="shell">
      <main className="app">
        {body}
        {push && data?.dog && (
          <button className="toast-push" onClick={() => openAlert(push)} aria-label="Abrir alerta de Nüma">
            <span className="app-ico"><Logo size={13} color="#fff" paws="var(--amber)" /></span>
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
