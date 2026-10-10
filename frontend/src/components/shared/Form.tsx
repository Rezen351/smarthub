import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

/* ── Field wrapper: label + control + hint/error ── */

interface FieldProps {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  htmlFor?: string
  children: ReactNode
  className?: string
}

export function Field({ label, hint, error, required, htmlFor, children, className = '' }: FieldProps) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label className="field-label" htmlFor={htmlFor}>
          {label}
          {required && (
            <span className="req" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  )
}

/* ── Input ──
   font-size stays at 16px (see .input) to avoid iOS auto-zoom (§9.5). */

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean
  mono?: boolean
}

export function Input({ invalid, mono, className = '', ...rest }: InputProps) {
  return (
    <input
      className={`input ${mono ? 'input-mono' : ''} ${className}`}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  )
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean
  mono?: boolean
}

export function Select({ invalid, mono, className = '', children, ...rest }: SelectProps) {
  return (
    <select className={`select ${mono ? 'input-mono' : ''} ${className}`} aria-invalid={invalid || undefined} {...rest}>
      {children}
    </select>
  )
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean
}

export function Textarea({ invalid, className = '', ...rest }: TextareaProps) {
  return <textarea className={`textarea ${className}`} aria-invalid={invalid || undefined} {...rest} />
}
