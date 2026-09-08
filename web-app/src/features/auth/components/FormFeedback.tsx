import type { ReactNode } from 'react'

export function FormFeedback({ children, tone = 'error' }: { children: ReactNode; tone?: 'error' | 'success' }) {
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`p-3 text-sm leading-5 ${tone === 'error' ? 'form-feedback-error' : 'form-feedback-success'}`}
    >
      {children}
    </div>
  )
}
