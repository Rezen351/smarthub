interface LogoProps {
  className?: string
  /** Hide the wordmark (icon only) in tight spaces. */
  markOnly?: boolean
  tone?: 'dark' | 'light'
}

/**
 * ENYX-Smart Hub logo dynamically rendered from /logo.svg (or /favicon.svg for markOnly).
 * Directly reflects any file updates in the public/ folder in dev mode without rebuilding.
 */
export default function Logo({ className = 'h-8 w-auto', markOnly = false }: LogoProps) {
  const src = markOnly ? '/favicon.svg' : '/logo.svg'

  return (
    <img
      src={src}
      alt="ENYX-ENTERPRISE"
      className={`${className} object-contain shrink-0`}
    />
  )
}
