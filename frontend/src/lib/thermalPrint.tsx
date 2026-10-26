import React from 'react'
import { createRoot, Root } from 'react-dom/client'

let portalRoot: Root | null = null

/**
 * Executes a clean thermal print by isolating printable labels into a dedicated
 * thermal print portal outside the main application DOM tree.
 * Prevents any surrounding page UI, headers, cards, or alert banners from leaking into the print.
 */
export function printThermal(content: React.ReactNode, onComplete?: () => void) {
  let portalEl = document.getElementById('thermal-print-portal')
  if (!portalEl) {
    portalEl = document.createElement('div')
    portalEl.id = 'thermal-print-portal'
    document.body.appendChild(portalEl)
  }

  if (!portalRoot) {
    portalRoot = createRoot(portalEl)
  }

  document.body.classList.add('thermal-printing')
  portalRoot.render(<div className="thermal-print-container">{content}</div>)

  // Give React, SVG barcodes, and QR codes sufficient time to commit to the DOM
  window.setTimeout(() => {
    let cleanedUp = false

    const handleCleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      window.removeEventListener('afterprint', handleCleanup)
      document.body.classList.remove('thermal-printing')
      if (portalRoot) {
        portalRoot.render(null)
      }
      onComplete?.()
    }

    window.addEventListener('afterprint', handleCleanup)

    try {
      window.print()
    } catch (e) {
      console.error('Print dialog failed:', e)
      handleCleanup()
    }

    // Safety fallback timer for environments where 'afterprint' event does not fire immediately
    window.setTimeout(() => {
      if (document.body.classList.contains('thermal-printing')) {
        handleCleanup()
      }
    }, 2000)
  }, 150)
}
