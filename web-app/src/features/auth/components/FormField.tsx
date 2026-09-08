import { useId, useState, type ComponentProps } from 'react'

interface FormFieldProps extends ComponentProps<'input'> {
  label: string
  error?: string
  hint?: string
}

export function FormField({ label, error, hint, type = 'text', id, ...inputProps }: FormFieldProps) {
  const generatedId = useId()
  const inputId = id ?? generatedId
  const [passwordVisible, setPasswordVisible] = useState(false)
  const passwordField = type === 'password'
  const description = [hint ? `${inputId}-hint` : '', error ? `${inputId}-error` : ''].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label className="form-label block" htmlFor={inputId}>{label}</label>
      <div className="relative">
        <input
          {...inputProps}
          id={inputId}
          type={passwordField && passwordVisible ? 'text' : type}
          aria-invalid={Boolean(error)}
          aria-describedby={description}
          className={`form-input px-3 disabled:cursor-not-allowed disabled:opacity-60 ${passwordField ? 'pr-20' : ''}`}
        />
        {passwordField && (
          <button
            type="button"
            aria-label={`${passwordVisible ? 'Hide' : 'Show'} ${label.toLowerCase()}`}
            aria-pressed={passwordVisible}
            onClick={() => setPasswordVisible((visible) => !visible)}
            className="absolute inset-y-1 right-1 rounded px-3 text-sm font-medium text-blue-700 hover:bg-blue-50"
          >
            {passwordVisible ? 'Hide' : 'Show'}
          </button>
        )}
      </div>
      {hint && <p id={`${inputId}-hint`} className="text-xs leading-5 text-slate-500">{hint}</p>}
      {error && <p id={`${inputId}-error`} className="text-xs leading-5 text-red-700">{error}</p>}
    </div>
  )
}
