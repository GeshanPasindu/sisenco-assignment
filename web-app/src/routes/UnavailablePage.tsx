export function UnavailablePage({ title }: { title: string }) {
  return <section className="rounded-md border border-slate-200 bg-white p-6"><h2 className="text-2xl font-semibold text-slate-900">{title}</h2><p className="mt-2 text-sm text-slate-600">This feature is not part of the current frontend stage.</p></section>
}
