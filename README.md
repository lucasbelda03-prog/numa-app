# Nüma · App del collar inteligente para perros

Prototipo funcional de la app de **Nüma Smart Health Collar**, desarrollado para el Trabajo Final de Grado (Plan de Negocios) de la Universidad del Salvador.

Nüma es un collar que registra el comportamiento diario de un perro, aprende su **patrón habitual** durante 14 días y avisa al dueño cuando algo cambia de forma sostenida. **No diagnostica**: detecta cambios y ayuda a decidir cuándo consultar al veterinario.

> Como el collar todavía no existe, la app **simula** los datos del collar. Todo lo demás (cuentas, base de datos, alertas, informes, suscripciones y asistente de IA) funciona de verdad.

**App publicada:** https://numa-app-bice.vercel.app

---

## Recorrido de la app

| Etapa | Qué ve el usuario |
|---|---|
| Registro | Crea su cuenta (email y contraseña). |
| Onboarding | Carga el perfil del perro, vincula el collar y ve consejos de colocación. |
| Aprendizaje (días 1–14) | Progreso del patrón habitual y datos del día. Sin alertas todavía. |
| Inicio | Índice de bienestar (0–100), anillos de actividad, descanso y alimentación, y cada indicador contra su patrón. |
| Tendencias | Evolución diaria de cada indicador con su rango habitual. |
| Alerta | Qué cambió, desde cuándo, qué observar y cuándo consultar. |
| Informes | Informe para el veterinario (30/60/90 días), compartible y descargable en PDF. |
| Nüma IA (Premium) | Análisis de la semana y chat con un asistente que conoce los datos del perro. |
| Planes | Básico (gratis con el collar) y Premium (USD 7/mes, 3 meses sin cargo). Baja desde la app. |
| Perfil → Simulación | Controles para la demostración: elegir el día de monitoreo (14, 21, 26) o reiniciar. |

### Guion sugerido para la defensa
1. Crear una cuenta y cargar a **Lola** (golden retriever, 4 años, 29 kg).
2. Vincular el collar → **Empezar** → ver el período de aprendizaje → **Avanzar simulación al día 14**.
3. **Perfil → Simulación → Un día normal (día 21)** → mostrar Inicio y Tendencias.
4. **Perfil → Simulación → Cambio de comportamiento (día 26)** → aparece la notificación → abrir la alerta.
5. **Armar informe para el veterinario** → mostrar el informe y el botón de compartir.
6. **Nüma IA** → activar la prueba Premium → generar el análisis y hacer una pregunta.

---

## Arquitectura

```
Navegador (React + Vite, publicado en Vercel)
   │  supabase-js (sesión del usuario)
   ▼
Supabase
   ├─ Auth ............ cuentas de usuario
   ├─ Postgres ........ datos, reglas de negocio y Row Level Security
   └─ Edge Function ... numa-ai → Google Gemini (análisis y chat)
```

- **Frontend:** React 18 + Vite. Sin librerías de UI: sistema visual propio (`src/styles.css`) con la paleta de la marca y la tipografía Manrope.
- **Backend:** Supabase (Postgres 17, Auth, Edge Functions en Deno).
- **IA:** Gemini (modelos Flash, nivel gratuito) desde la función `numa-ai`. Si un modelo está saturado, prueba el siguiente. La clave nunca llega al navegador.
- **Hosting:** Vercel.

## Modelo de datos

```
auth.users ─1:1─ profiles ─1:N─ dogs ─1:1─ devices
                     │            ├─1:N─ daily_metrics ─N:1─ metric_types
                     │            ├─1:N─ baselines     ─N:1─ metric_types
                     │            ├─1:N─ alerts
                     │            ├─1:N─ reports
                     │            ├─1:N─ ai_insights / ai_messages
                     │            └─1:1─ demo_state   (solo simulación)
                     └─1:N─ subscriptions ─N:1─ plans
```

| Tabla | Para qué sirve |
|---|---|
| `metric_types` | Catálogo de los 8 indicadores (actividad, alimentación, descanso, sueño, FC y FR en reposo, hidratación, rascado). |
| `plans` | Planes Básico y Premium con precio, días de prueba y beneficios. |
| `profiles` | Datos del dueño (1:1 con la cuenta). Se crea automáticamente al registrarse. |
| `dogs` | Perfil del perro y fecha de inicio del monitoreo. |
| `devices` | Collar vinculado (número de serie, batería, firmware). |
| `daily_metrics` | Un valor por perro, indicador y día (formato largo). |
| `baselines` | Patrón habitual de cada indicador (promedio y rango). |
| `alerts` | Cambios sostenidos detectados, con su estado (`new`, `seen`, `watching`, `resolved`). |
| `reports` | Informes para el veterinario, con una copia fija de los datos (`snapshot`). |
| `subscriptions` | Historial de planes del usuario. Solo una suscripción abierta por usuario. |
| `ai_insights`, `ai_messages` | Análisis y conversación con Nüma IA. |
| `demo_state` | Día simulado de monitoreo (no existiría en producción). |

### Reglas de negocio (en la base de datos)
- **Patrón habitual:** promedio de los días 1 a 14 de monitoreo; rango habitual = promedio ± 10 %. Función `refresh_dog_analytics`.
- **Alerta:** un indicador queda a ± 15 % o más de su patrón durante **3 días consecutivos**, en la misma dirección. No se generan alertas duplicadas mientras haya una abierta.
- **Suscripciones:** `start_premium_trial()` y `cancel_premium()` cambian el plan de forma atómica.
- **Alta de usuario:** un trigger crea el perfil y le asigna el Plan Básico.

### Seguridad
- **Row Level Security** en todas las tablas: cada usuario solo ve y modifica sus datos y los de sus perros.
- Funciones `security definer` con `search_path` vacío y verificación de propiedad del perro.
- Ninguna función se puede ejecutar sin sesión.
- La clave de IA está guardada como secreto de la Edge Function.

Las migraciones están en `supabase/migrations/` en el orden en que se aplicaron.

---

## Correr la app en una computadora

```bash
npm install
cp .env.example .env.local   # completar con la URL y la clave publicable de Supabase
npm run dev
```

Sin `.env.local`, la app funciona en **modo demo** (todo en memoria, sin conexión). `npm run build:single` genera un único HTML en ese modo.

## Configuración en Supabase
1. **Authentication → Sign In / Providers → Email:** desactivar *Confirm email* para que el registro sea inmediato.
2. **Edge Functions → Secrets:** cargar `GEMINI_API_KEY` (y opcionalmente `GEMINI_MODEL`).

## Supuestos a validar (TFG)
- Duración del período de aprendizaje (14 días) y umbrales de alerta (± 15 %, 3 días): **hipótesis a validar** con el proveedor del hardware y veterinarios.
- Frecuencia cardíaca y respiratoria en reposo: dependen de la precisión real del sensor.
- El índice de bienestar es un indicador de comportamiento, no un diagnóstico clínico.
