interface LogoProps {
  className?: string
  /** Hide the wordmark (icon only) in tight spaces. */
  markOnly?: boolean
  tone?: 'dark' | 'light'
}

/**
 * SmartGeulis logo dynamically rendered from /Smart Geulis.png.
 */
export default function Logo({ className = 'h-8 w-auto' }: LogoProps) {
  const src = '/Smart Geulis.png'

  return (
    <img
      src={src}
      alt="SmartGeulis"
      className={`${className} object-contain shrink-0`}
    />
  )
}
