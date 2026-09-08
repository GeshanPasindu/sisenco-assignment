import { Link } from 'react-router-dom'

export function ForbiddenPage() {
  return (
    <section className="mx-auto max-w-lg rounded-md border border-slate-200 bg-white p-8 text-center shadow-sm">
      <p className="text-sm font-semibold text-blue-700">
        Access restricted
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-slate-950">
        You don’t have access to this page
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        Contact your manager if you need permission to continue.
      </p>
      <Link
        to="/"
        className="button-primary mt-6 inline-flex px-5"
      >
        Return home
      </Link>
    </section>
  )
}
