import React from 'react'
import { createRoot } from 'react-dom/client'

/**
 * Executes a completely isolated thermal print by rendering receipts and QR labels
 * into a dedicated off-screen hidden iframe.
 *
 * Why Hidden IFrame Isolation:
 * 1. Physical Isolation: The browser print dialog targets ONLY the iframe.
 *    The main application's #root, navigation, stat cards, stepper, and tables
 *    do not exist inside the iframe DOM, making UI leakage structurally impossible.
 * 2. Network Printer Stability: Eliminates timeout race conditions where slow network
 *    printers (e.g. Epson L3250 over WiFi) take >2s to render previews.
 * 3. Exact 80mm Roll Dimension: Locks page size to 80mm roll width.
 */
export function printThermal(content: React.ReactNode, onComplete?: () => void) {
  // 1. Remove any previous print iframe to prevent memory leaks
  const existingIframe = document.getElementById('thermal-print-iframe')
  if (existingIframe) {
    existingIframe.remove()
  }

  // 2. Create off-screen hidden iframe
  const iframe = document.createElement('iframe')
  iframe.id = 'thermal-print-iframe'
  iframe.style.position = 'fixed'
  iframe.style.top = '-9999px'
  iframe.style.left = '-9999px'
  iframe.style.width = '80mm'
  iframe.style.height = '100px'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'

  document.body.appendChild(iframe)

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document
  const iframeWin = iframe.contentWindow
  if (!iframeDoc || !iframeWin) {
    console.error('Thermal print: Failed to initialize iframe context')
    onComplete?.()
    return
  }

  // 3. Write clean document shell with thermal 80mm roll stylesheet
  iframeDoc.open()
  iframeDoc.write(`<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>SmartHub Thermal Print</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      margin: 0;
      padding: 0;
      width: 80mm;
      max-width: 80mm;
      background: #ffffff;
      color: #000000;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
    }
    .thermal-print-container {
      width: 80mm;
      max-width: 80mm;
      margin: 0 auto;
      padding: 2mm 3mm;
      background: #ffffff;
      color: #000000;
    }
    .printable-label {
      width: 100%;
      max-width: 80mm;
      box-sizing: border-box;
      background: #ffffff;
      color: #000000;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .print-page-break {
      page-break-after: always;
      break-after: page;
      margin-bottom: 5mm;
    }
    svg {
      max-width: 100%;
      height: auto;
      display: block;
      margin: 0 auto;
    }
  </style>
</head>
<body>
  <div id="thermal-mount"></div>
</body>
</html>`)
  iframeDoc.close()

  // 4. Clone all stylesheets and style elements from host document into iframe head (Tailwind v4, fonts, utilities)
  const styles = document.querySelectorAll('link[rel="stylesheet"], style')
  styles.forEach((styleNode) => {
    iframeDoc.head.appendChild(styleNode.cloneNode(true))
  })

  // 5. Render React thermal component inside iframe
  const mountPoint = iframeDoc.getElementById('thermal-mount')
  if (!mountPoint) {
    console.error('Thermal print: Mount point missing in iframe')
    onComplete?.()
    return
  }

  const root = createRoot(mountPoint)
  root.render(<div className="thermal-print-container">{content}</div>)

  // 6. Allow React, SVG barcodes, and QR codes to mount and paint, then invoke print
  window.setTimeout(() => {
    let cleanedUp = false

    const handleCleanup = () => {
      if (cleanedUp) return
      cleanedUp = true
      iframeWin.removeEventListener('afterprint', handleCleanup)
      window.removeEventListener('afterprint', handleCleanup)

      // Retain iframe for 1.5 seconds post-dialog to let print spooler complete cleanly
      window.setTimeout(() => {
        try {
          root.unmount()
          iframe.remove()
        } catch {
          // ignore cleanup race conditions
        }
        onComplete?.()
      }, 1500)
    }

    try {
      iframeWin.addEventListener('afterprint', handleCleanup)
      window.addEventListener('afterprint', handleCleanup)

      iframeWin.focus()
      iframeWin.print()
    } catch (err) {
      console.error('Thermal print execution error:', err)
      handleCleanup()
    }
  }, 250)
}
