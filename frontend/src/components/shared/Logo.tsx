interface LogoProps {
  className?: string
  /** Hide the wordmark (icon only) in tight spaces. */
  markOnly?: boolean
  tone?: 'dark' | 'light'
}

/**
 * ENYX-Smart Hub mark: monochrome leaf node with an accent signal dot,
 * matching the minimalist palette of laporan.pdf §9.2.
 */
export default function Logo({ className = 'h-8 w-auto', markOnly = false, tone = 'dark' }: LogoProps) {
  const wordColor = tone === 'light' ? '#ffffff' : '#171717'
  const subColor = tone === 'light' ? 'rgba(255,255,255,0.65)' : '#666666'

  return (
    <svg
      className={className}
      viewBox={markOnly ? '0 0 36 36' : '0 0 168 36'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="ENYX-Smart Hub"
    >
      <circle cx="18" cy="18" r="16.5" stroke={wordColor} strokeWidth="2" />
      <path
        d="M18 8.5C18 8.5 25.5 12.5 25.5 18.8C25.5 24 21.8 27.5 18 27.5C14.2 27.5 10.5 24 10.5 18.8C10.5 12.5 18 8.5 18 8.5Z"
        fill="currentColor"
        opacity="0.08"
      />
      <path
        d="M18 8.5C18 8.5 25.5 12.5 25.5 18.8C25.5 24 21.8 27.5 18 27.5"
        stroke={wordColor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M18 8.5C18 8.5 10.5 12.5 10.5 18.8C10.5 24 14.2 27.5 18 27.5"
        stroke={wordColor}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <line x1="18" y1="27.5" x2="18" y2="12" stroke={wordColor} strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="24.5" cy="12.5" r="1.8" fill="#0070f3" />
      <circle cx="27" cy="8.5" r="1.1" fill="#0070f3" opacity="0.6" />
      {!markOnly && (
        <>
          <text
            x="40"
            y="23"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
            fontWeight="700"
            fontSize="16"
            fill={wordColor}
            letterSpacing="-0.5"
          >
            ENYX
          </text>
          <text
            x="85"
            y="23"
            fontFamily="Inter, -apple-system, BlinkMacSystemFont, sans-serif"
            fontWeight="400"
            fontSize="16"
            fill={subColor}
            letterSpacing="-0.3"
          >
            Smart Hub
          </text>
        </>
      )}
    </svg>
  )
}
