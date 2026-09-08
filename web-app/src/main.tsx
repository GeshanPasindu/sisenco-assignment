import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'

function takeInvitationToken(): string | null {
  const hash = window.location.hash
  if (!hash) return null

  const token = new URLSearchParams(hash.slice(1)).get('token')
  if (token !== null) {
    window.history.replaceState(
      window.history.state,
      '',
      `${window.location.pathname}${window.location.search}`,
    )
  }
  return token
}

function renderStartupError(error: unknown) {
  const message = error instanceof Error ? error.message : 'The application could not start.'
  createRoot(document.getElementById('root')!).render(
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6">
      <section className="w-full max-w-lg rounded-md border border-red-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold text-red-700">Configuration required</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-950">Sisenco could not start</h1>
        <p className="mt-3 text-sm leading-6 text-slate-700">{message}</p>
      </section>
    </main>,
  )
}

async function bootstrap() {
  try {
    const [{ AppProviders }, { createAppRouter }] = await Promise.all([
      import('./app/AppProviders'),
      import('./routes/router'),
    ])
    const router = createAppRouter({ invitationToken: takeInvitationToken() })
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <AppProviders router={router} />
      </StrictMode>,
    )
  } catch (error) {
    renderStartupError(error)
  }
}

void bootstrap()
