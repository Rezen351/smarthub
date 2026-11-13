import React from 'react'
import Icon from './Icon'
import OfflineQrCode from './OfflineQrCode'
import { encodeQr } from '../../lib/qrEncoder'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface IdCardData {
  id?: string
  name: string
  role: 'ADMIN' | 'OPERATOR' | 'FARMER' | string
  code: string
  domicile: string
  email?: string
  phone?: string
  issuedAt?: string
}

interface IdCardProps {
  data: IdCardData
  className?: string
}

// Minimalist, modern color palettes aligned directly with the Landing Page & official logos:
export const ROLE_THEMES: Record<
  string,
  {
    name: string
    roleBadge: string
    accentColor: string
    accentBg: string
    accentBorder: string
    accentText: string
    indicatorColor: string
    headerBg: string
    headerText: string
    headerSub: string
    borderLine: string
  }
> = {
  FARMER: {
    name: 'Registered Farmer',
    roleBadge: 'FARMER',
    accentColor: '#16a34a',
    accentBg: '#f0fdf4',
    accentBorder: '#86efac',
    accentText: '#14532d',
    indicatorColor: '#22c55e',
    headerBg: '#15803d', // Hijau (Green - Agriculture & Eptilu)
    headerText: '#ffffff',
    headerSub: '#86efac', // Crisp Light Mint Green for ultra-clear readability
    borderLine: '#16a34a',
  },
  OPERATOR: {
    name: 'Plant Operator',
    roleBadge: 'OPERATOR',
    accentColor: '#2563eb',
    accentBg: '#eff6ff',
    accentBorder: '#bfdbfe',
    accentText: '#1e40af',
    indicatorColor: '#38bdf8',
    headerBg: '#1e40af', // Biru (Blue - Plant Operations)
    headerText: '#ffffff',
    headerSub: '#bfdbfe', // Soft Ice/Sky Blue for ultra-clear readability
    borderLine: '#2563eb',
  },
  ADMIN: {
    name: 'System Administrator',
    roleBadge: 'ADMINISTRATOR',
    accentColor: '#18181b',
    accentBg: '#f4f4f5',
    accentBorder: '#e4e4e7',
    accentText: '#18181b',
    indicatorColor: '#22c55e',
    headerBg: '#0a0a0a', // Hitam (Black - Executive System Administrator)
    headerText: '#ffffff',
    headerSub: '#e4e4e7', // Crisp Silver White for ultra-clear readability
    borderLine: '#18181b',
  },
}

export function formatUserCode(data: IdCardData): string {
  if (data.code && data.code.trim()) return data.code.trim()
  if (data.role === 'FARMER') return 'FMR-001'
  if (data.role === 'OPERATOR') return 'OPR-001'
  if (data.role === 'ADMIN') return 'ADM-001'
  return data.id ? data.id.substring(0, 8).toUpperCase() : 'USER-01'
}

export function formatUserName(rawName?: string): string {
  if (!rawName || !rawName.trim()) return 'User Name'
  return rawName.replace(/\s*\([^)]*\)/g, '').trim() || rawName.trim()
}

/**
 * Modern Minimalist & Elegant 8.0 cm x 5.5 cm ID Card Component
 * Designed with the exact aesthetic of the SmartGeulis landing page:
 * - Crisp architectural lines
 * - Technical corner brackets & tracked monospace metadata
 * - High-contrast typography & minimalist white surface
 */
export function IdCard({ data, className = '' }: IdCardProps) {
  const role = (data.role || 'OPERATOR').toUpperCase()
  const theme = ROLE_THEMES[role] || ROLE_THEMES.OPERATOR
  const code = formatUserCode(data)
  const domicile = data.domicile?.trim() || 'Garut, Jawa Barat'

  return (
    <div
      className={`relative select-none bg-white text-[#171717] overflow-hidden ${className}`}
      style={{
        width: '320px',
        height: '220px',
        maxWidth: '100%',
        aspectRatio: '80 / 55',
        border: '1px solid #eaeaea',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 4px 20px -2px rgba(0, 0, 0, 0.05), 0 2px 6px -1px rgba(0, 0, 0, 0.02)',
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ── Signature Landing Page Corner Brackets ── */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '10px',
          height: '10px',
          borderTop: `2px solid ${theme.borderLine}`,
          borderLeft: `2px solid ${theme.borderLine}`,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: 0,
          right: 0,
          width: '10px',
          height: '10px',
          borderBottom: `2px solid ${theme.borderLine}`,
          borderRight: `2px solid ${theme.borderLine}`,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      />

      {/* ── Minimalist Header ── */}
      <div
        style={{
          backgroundColor: theme.headerBg,
          color: theme.headerText,
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <img
            src="/Smart%20Geulis.png"
            alt="Logo"
            style={{ height: '20px', width: 'auto', objectFit: 'contain' }}
            onError={(e) => {
              ;(e.target as HTMLElement).style.display = 'none'
            }}
          />
          <div>
            <div style={{ fontSize: '11.5px', fontWeight: 900, letterSpacing: '0.08em', lineHeight: 1 }}>
              SmartGeulis
            </div>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontSize: '8px',
                fontWeight: 800,
                color: theme.headerSub,
                letterSpacing: '0.2em',
                textTransform: 'uppercase',
                marginTop: '2.5px',
              }}
            >
              TRACEABILITY SYSTEM
            </div>
          </div>
        </div>

        {/* Technical Status Pill */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: theme.accentBg,
            border: `1px solid ${theme.accentBorder}`,
            color: theme.accentText,
            padding: '2.5px 7px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
            fontSize: '8px',
            fontWeight: 800,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
          }}
        >
          <span
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              backgroundColor: theme.indicatorColor,
              display: 'inline-block',
            }}
          />
          <span>{theme.roleBadge}</span>
        </div>
      </div>

      {/* ── Minimalist Card Body ── */}
      <div
        style={{
          flex: 1,
          padding: '10px 14px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          backgroundColor: '#ffffff',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle Watermark Logo Background */}
        <img
          src="/Smart%20Geulis.png"
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '150px',
            height: '150px',
            objectFit: 'contain',
            opacity: 0.09,
            pointerEvents: 'none',
            zIndex: 0,
            userSelect: 'none',
          }}
        />

        {/* Left Column: Typography & Metadata */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '5px', position: 'relative', zIndex: 1 }}>
          <div>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontSize: '7.5px',
                textTransform: 'uppercase',
                color: '#555555',
                letterSpacing: '0.16em',
                fontWeight: 700,
              }}
            >
              Full Name
            </div>
            <div
              style={{
                fontSize: '13.5px',
                fontWeight: 800,
                color: '#171717',
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                marginTop: '1px',
              }}
              title={formatUserName(data.name)}
            >
              {formatUserName(data.name)}
            </div>
          </div>

          <div>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontSize: '7.5px',
                textTransform: 'uppercase',
                color: '#555555',
                letterSpacing: '0.16em',
                fontWeight: 700,
              }}
            >
              Identification Code
            </div>
            <div
              style={{
                display: 'inline-block',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontSize: '11px',
                fontWeight: 800,
                color: theme.accentText,
                backgroundColor: theme.accentBg,
                border: `1px solid ${theme.accentBorder}`,
                padding: '1.5px 7px',
                letterSpacing: '0.12em',
                marginTop: '1px',
              }}
            >
              {code}
            </div>
          </div>

          <div>
            <div
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
                fontSize: '7.5px',
                textTransform: 'uppercase',
                color: '#555555',
                letterSpacing: '0.16em',
                fontWeight: 700,
              }}
            >
              Domicile / Facility
            </div>
            <div
              style={{
                fontSize: '9.5px',
                fontWeight: 600,
                color: '#222222',
                lineHeight: 1.25,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                marginTop: '1px',
              }}
              title={domicile}
            >
              {domicile}
            </div>
          </div>
        </div>

        {/* Right Column: Architectural QR Frame */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '3px',
            backgroundColor: '#ffffff',
            padding: '5px',
            border: '1px solid #eaeaea',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          <OfflineQrCode value={code} size={82} />
          <span
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
              fontSize: '7px',
              fontWeight: 800,
              color: '#333333',
              letterSpacing: '0.15em',
              textTransform: 'uppercase',
            }}
          >
            SCAN · VERIFY
          </span>
        </div>
      </div>

      {/* ── Minimalist Status Footer ── */}
      <div
        style={{
          borderTop: '1px solid #eaeaea',
          backgroundColor: '#fafafa',
          padding: '5px 12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, monospace',
          fontSize: '8px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span
            style={{
              width: '5px',
              height: '5px',
              backgroundColor: theme.borderLine,
              display: 'inline-block',
            }}
          />
          <span style={{ fontWeight: 800, color: '#171717', letterSpacing: '0.12em' }}>
            AUTHENTICATED PASS
          </span>
        </span>
        <span style={{ color: '#171717', fontWeight: 800, letterSpacing: '0.12em' }}>
          SMARTGEULIS
        </span>
      </div>
    </div>
  )
}

/**
 * Modern High-Definition PNG Canvas Generator (~300 DPI: 945 x 650 px)
 * Follows the landing page minimalism: clean white card, crisp black header, fine hairline borders, and sharp corner notches.
 */
export async function exportIdCardToPng(data: IdCardData): Promise<void> {
  const role = (data.role || 'OPERATOR').toUpperCase()
  const theme = ROLE_THEMES[role] || ROLE_THEMES.OPERATOR
  const code = formatUserCode(data)
  const domicile = data.domicile?.trim() || 'Garut, Jawa Barat'

  const canvas = document.createElement('canvas')
  canvas.width = 945
  canvas.height = 650
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  // Load logo for header & watermark background
  const logoImg = new Image()
  logoImg.src = '/Smart%20Geulis.png'
  await new Promise((resolve) => {
    logoImg.onload = resolve
    logoImg.onerror = resolve
  })

  // 1. Pure White Surface Background
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 1b. Subtle Transparent Logo Watermark Background (Centered in Card Body)
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.save()
    ctx.globalAlpha = 0.08
    const logoSize = 360
    const logoX = (canvas.width - logoSize) / 2
    const logoY = 130 + (450 - logoSize) / 2
    ctx.drawImage(logoImg, logoX, logoY, logoSize, logoSize)
    ctx.restore()
  }

  // 2. Role-Themed Header Band
  ctx.fillStyle = theme.headerBg
  ctx.fillRect(0, 0, canvas.width, 130)

  // Header Logo & Typography
  let textStartX = 45
  if (logoImg.complete && logoImg.naturalWidth > 0) {
    ctx.drawImage(logoImg, 45, 34, 62, 62)
    textStartX = 120
  }

  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 36px Inter, sans-serif'
  ctx.fillText('SmartGeulis', textStartX, 58)

  ctx.fillStyle = theme.headerSub
  ctx.font = 'bold 20px monospace'
  ctx.fillText('TRACEABILITY SYSTEM', textStartX, 96)

  // Role Pill Badge (Top Right)
  const roleText = theme.roleBadge
  ctx.font = 'bold 18px monospace'
  const textWidth = ctx.measureText(roleText).width
  const pillW = textWidth + 40
  const pillH = 44
  const pillX = canvas.width - pillW - 45
  const pillY = 42

  ctx.fillStyle = theme.accentBg
  ctx.fillRect(pillX, pillY, pillW, pillH)
  ctx.strokeStyle = theme.accentBorder
  ctx.lineWidth = 2
  ctx.strokeRect(pillX, pillY, pillW, pillH)

  // Status Indicator Dot
  ctx.fillStyle = theme.indicatorColor
  ctx.beginPath()
  ctx.arc(pillX + 16, pillY + pillH / 2, 5, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = theme.accentText
  ctx.fillText(roleText, pillX + 28, pillY + 28)

  // 3. User Details Left Column
  // FULL NAME
  ctx.fillStyle = '#555555'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('FULL NAME', 45, 185)

  ctx.fillStyle = '#171717'
  ctx.font = 'bold 36px Inter, sans-serif'
  const maxNameWidth = 490
  let displayName = formatUserName(data.name)
  if (ctx.measureText(displayName).width > maxNameWidth) {
    while (ctx.measureText(displayName + '...').width > maxNameWidth && displayName.length > 0) {
      displayName = displayName.slice(0, -1)
    }
    displayName += '...'
  }
  ctx.fillText(displayName, 45, 230)

  // IDENTIFICATION CODE
  ctx.fillStyle = '#555555'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('IDENTIFICATION CODE', 45, 290)

  // Code Chip
  ctx.font = 'bold 30px monospace'
  const codeW = ctx.measureText(code).width + 30
  ctx.fillStyle = theme.accentBg
  ctx.fillRect(45, 305, codeW, 46)
  ctx.strokeStyle = theme.accentBorder
  ctx.lineWidth = 2
  ctx.strokeRect(45, 305, codeW, 46)

  ctx.fillStyle = theme.accentText
  ctx.fillText(code, 60, 340)

  // DOMICILE / FACILITY
  ctx.fillStyle = '#555555'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('DOMICILE / FACILITY', 45, 400)

  ctx.fillStyle = '#222222'
  ctx.font = '600 24px Inter, sans-serif'
  ctx.fillText(domicile, 45, 440)

  // ROLE / POSITION
  ctx.fillStyle = '#555555'
  ctx.font = 'bold 18px monospace'
  ctx.fillText('ROLE / POSITION', 45, 495)

  ctx.fillStyle = '#171717'
  ctx.font = '600 22px Inter, sans-serif'
  ctx.fillText(theme.name, 45, 530)

  // 4. Architectural QR Frame (Right Column)
  const qrBoxX = 585
  const qrBoxY = 160
  const qrBoxSize = 310

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize)
  ctx.strokeStyle = '#eaeaea'
  ctx.lineWidth = 3
  ctx.strokeRect(qrBoxX, qrBoxY, qrBoxSize, qrBoxSize)

  // Vector QR matrix
  const qrMatrix = encodeQr(code)
  const quietZone = 2
  const totalDim = qrMatrix.length + quietZone * 2
  const moduleSize = (qrBoxSize - 40) / totalDim
  const qrStartX = qrBoxX + 20 + quietZone * moduleSize
  const qrStartY = qrBoxY + 20 + quietZone * moduleSize

  ctx.fillStyle = '#000000'
  for (let r = 0; r < qrMatrix.length; r++) {
    for (let c = 0; c < qrMatrix[r].length; c++) {
      if (qrMatrix[r][c]) {
        ctx.fillRect(
          Math.round(qrStartX + c * moduleSize),
          Math.round(qrStartY + r * moduleSize),
          Math.ceil(moduleSize),
          Math.ceil(moduleSize)
        )
      }
    }
  }

  // QR bottom technical caption
  ctx.fillStyle = '#333333'
  ctx.font = 'bold 16px monospace'
  ctx.textAlign = 'center'
  ctx.fillText('SCAN · VERIFY ACCESS', qrBoxX + qrBoxSize / 2, qrBoxY + qrBoxSize - 12)
  ctx.textAlign = 'left'

  // 5. Minimalist Footer
  ctx.fillStyle = '#fafafa'
  ctx.fillRect(0, 575, canvas.width, 75)
  ctx.strokeStyle = '#eaeaea'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(0, 575)
  ctx.lineTo(canvas.width, 575)
  ctx.stroke()

  ctx.fillStyle = theme.borderLine
  ctx.fillRect(45, 608, 9, 9)

  ctx.fillStyle = '#171717'
  ctx.font = 'bold 20px monospace'
  ctx.fillText('AUTHENTICATED PASS', 64, 618)

  ctx.fillStyle = '#171717'
  ctx.font = 'bold 20px monospace'
  ctx.fillText('SMARTGEULIS', canvas.width - 200, 618)

  // 6. Signature Notch Corner Brackets (Landing Page Motif)
  const bracketSize = 28
  const bracketThick = 4
  ctx.strokeStyle = theme.borderLine
  ctx.lineWidth = bracketThick

  // Top-left bracket
  ctx.beginPath()
  ctx.moveTo(0, bracketSize)
  ctx.lineTo(0, 0)
  ctx.lineTo(bracketSize, 0)
  ctx.stroke()

  // Bottom-right bracket
  ctx.beginPath()
  ctx.moveTo(canvas.width, canvas.height - bracketSize)
  ctx.lineTo(canvas.width, canvas.height)
  ctx.lineTo(canvas.width - bracketSize, canvas.height)
  ctx.stroke()

  // 7. Outer Hairline Border
  ctx.strokeStyle = '#eaeaea'
  ctx.lineWidth = 2
  ctx.strokeRect(0, 0, canvas.width, canvas.height)

  // 8. Trigger Download
  const link = document.createElement('a')
  link.download = `smartgeulis-id-${role.toLowerCase()}-${code.toLowerCase()}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

/**
 * Modern Minimalist Print Trigger (80mm x 55mm landscape)
 */
export function printIdCard(data: IdCardData): void {
  const role = (data.role || 'OPERATOR').toUpperCase()
  const theme = ROLE_THEMES[role] || ROLE_THEMES.OPERATOR
  const code = formatUserCode(data)
  const domicile = data.domicile?.trim() || 'Garut, Jawa Barat'

  // Generate QR SVG
  const qrMatrix = encodeQr(code)
  const quietZone = 2
  const dim = qrMatrix.length + quietZone * 2
  let qrSvgPath = ''
  qrMatrix.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) qrSvgPath += `M${x + quietZone} ${y + quietZone}h1v1h-1z`
    })
  )

  const printWindow = window.open('', '_blank', 'width=800,height=600')
  if (!printWindow) return
  const logoUrl = `${window.location.origin}/Smart%20Geulis.png`

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>SmartGeulis ID Card - ${formatUserName(data.name)}</title>
  <style>
    @page {
      size: 80mm 55mm landscape;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      margin: 0;
      padding: 0;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 80mm;
      height: 55mm;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
    }
    .card {
      width: 80mm;
      height: 55mm;
      overflow: hidden;
      border: 1px solid #eaeaea;
      background: #ffffff;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .corner-tl {
      position: absolute;
      top: 0;
      left: 0;
      width: 3mm;
      height: 3mm;
      border-top: 1.5px solid ${theme.borderLine};
      border-left: 1.5px solid ${theme.borderLine};
      z-index: 10;
    }
    .corner-br {
      position: absolute;
      bottom: 0;
      right: 0;
      width: 3mm;
      height: 3mm;
      border-bottom: 1.5px solid ${theme.borderLine};
      border-right: 1.5px solid ${theme.borderLine};
      z-index: 10;
    }
    .header {
      background: ${theme.headerBg};
      color: #ffffff;
      padding: 2.5mm 3.8mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-bottom: 1px solid rgba(255,255,255,0.15);
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .header-title {
      font-size: 9.5pt;
      font-weight: 900;
      letter-spacing: 0.05em;
      line-height: 1;
    }
    .header-sub {
      font-family: monospace;
      font-size: 5.5pt;
      font-weight: 800;
      color: ${theme.headerSub};
      text-transform: uppercase;
      letter-spacing: 0.18em;
      margin-top: 0.6mm;
    }
    .badge {
      background: ${theme.accentBg};
      border: 1px solid ${theme.accentBorder};
      color: ${theme.accentText};
      font-family: monospace;
      font-size: 5.5pt;
      font-weight: 800;
      padding: 0.8mm 2.2mm;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      display: flex;
      align-items: center;
      gap: 1mm;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .dot {
      width: 1.2mm;
      height: 1.2mm;
      border-radius: 50%;
      background: ${theme.indicatorColor};
      display: inline-block;
    }
    .body {
      flex: 1;
      padding: 2.5mm 3.8mm;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 3mm;
      background: #ffffff;
      position: relative;
      overflow: hidden;
    }
    .watermark {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 36mm;
      height: 36mm;
      object-fit: contain;
      opacity: 0.08;
      pointer-events: none;
      z-index: 0;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .content-left {
      position: relative;
      z-index: 1;
    }
    .field-label {
      font-family: monospace;
      font-size: 5pt;
      font-weight: 700;
      text-transform: uppercase;
      color: #555555;
      letter-spacing: 0.16em;
      line-height: 1;
      margin-bottom: 0.5mm;
    }
    .field-name {
      font-size: 10pt;
      font-weight: 900;
      color: #171717;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin-bottom: 1.5mm;
    }
    .code-chip {
      display: inline-block;
      font-family: monospace;
      font-size: 8pt;
      font-weight: 800;
      color: ${theme.accentText};
      background: ${theme.accentBg};
      border: 1px solid ${theme.accentBorder};
      padding: 0.5mm 1.8mm;
      letter-spacing: 0.1em;
      margin-bottom: 1.5mm;
    }
    .field-domicile {
      font-size: 6.8pt;
      font-weight: 600;
      color: #222222;
      line-height: 1.2;
    }
    .qr-frame {
      border: 1px solid #eaeaea;
      padding: 1.5mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.8mm;
      background: #ffffff;
    }
    .qr-caption {
      font-family: monospace;
      font-size: 4.8pt;
      font-weight: 800;
      color: #333333;
      letter-spacing: 0.15em;
      text-transform: uppercase;
    }
    .footer {
      border-top: 1px solid #eaeaea;
      padding: 1.2mm 3.8mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: monospace;
      font-size: 5.5pt;
      font-weight: 800;
      color: #171717;
      background: #fafafa;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="corner-tl"></div>
    <div class="corner-br"></div>
    <div class="header">
      <div style="display:flex;align-items:center;gap:2mm;">
        <img src="${logoUrl}" style="height:5.5mm;width:auto;" alt="" />
        <div>
          <div class="header-title">SmartGeulis</div>
          <div class="header-sub">TRACEABILITY SYSTEM</div>
        </div>
      </div>
      <div class="badge">
        <span class="dot"></span>
        <span>${theme.roleBadge}</span>
      </div>
    </div>
    <div class="body">
      <img class="watermark" src="${logoUrl}" alt="" />
      <div class="content-left">
        <div class="field-label">Full Name</div>
        <div class="field-name">${formatUserName(data.name)}</div>
        <div class="field-label">Identification Code</div>
        <div class="code-chip">${code}</div>
        <div class="field-label">Domicile / Facility</div>
        <div class="field-domicile">${domicile}</div>
      </div>
      <div class="qr-frame" style="position:relative;z-index:1;">
        <svg width="60" height="60" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges">
          <rect width="${dim}" height="${dim}" fill="#ffffff" />
          <path d="${qrSvgPath}" fill="#000000" />
        </svg>
        <span class="qr-caption">SCAN · VERIFY</span>
      </div>
    </div>
    <div class="footer">
      <span style="font-weight:900;color:#171717;">AUTHENTICATED PASS</span>
      <span style="color:#171717;font-weight:900">SMARTGEULIS</span>
    </div>
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
}

/**
 * Modern Minimalist Modal for ID Card Preview, Print, and Export
 * Styled to match the landing page theme: clean white surfaces, hairline borders, and black primary action buttons.
 */
export function IdCardModal({
  data,
  open,
  onClose,
}: {
  data: IdCardData | null
  open: boolean
  onClose: () => void
}) {
  const [exporting, setExporting] = React.useState(false)

  if (!data) return null

  const role = (data.role || 'OPERATOR').toUpperCase()
  const theme = ROLE_THEMES[role] || ROLE_THEMES.OPERATOR

  const handleExport = async () => {
    try {
      setExporting(true)
      await exportIdCardToPng(data)
    } finally {
      setExporting(false)
    }
  }

  const handlePrint = () => {
    printIdCard(data)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md p-6 bg-white dark:bg-zinc-900 border border-[#eaeaea] dark:border-zinc-800 shadow-2xl rounded-none">
        {/* Header */}
        <DialogHeader className="border-b border-[#eaeaea] dark:border-zinc-800 pb-3 text-left">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-mono-custom text-[9px] text-[#ea580c] tracking-[0.25em] uppercase font-semibold">
                Card Preview
              </div>
              <DialogTitle className="font-display text-xl font-bold text-[#171717] dark:text-zinc-100 tracking-tight">
                {formatUserName(data.name)}
              </DialogTitle>
            </div>
            <button
              type="button"
              className="p-1.5 text-[#888888] hover:text-[#171717] dark:hover:text-zinc-200 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        </DialogHeader>

        {/* Card Live Preview Container */}
        <div className="flex justify-center p-4 bg-[#fafafa] dark:bg-zinc-950/50 border border-[#eaeaea] dark:border-zinc-800">
          <IdCard data={data} />
        </div>

        {/* Direct Details Table */}
        <div className="bg-[#fcfcfc] dark:bg-zinc-900/80 border border-[#eaeaea] dark:border-zinc-800 p-3 text-xs text-[#666666] dark:text-zinc-300 space-y-1.5 font-body">
          <div className="flex justify-between items-center">
            <span className="font-mono-custom text-[10px] text-[#888888] tracking-wider uppercase">Role:</span>
            <span className="font-mono-custom text-[11px] font-bold text-[#171717] dark:text-zinc-100 capitalize">{data.role?.toLowerCase() || 'operator'}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono-custom text-[10px] text-[#888888] tracking-wider uppercase">User ID:</span>
            <span
              className="font-mono text-xs font-bold px-2 py-0.5 border"
              style={{
                color: theme.accentText,
                backgroundColor: theme.accentBg,
                borderColor: theme.accentBorder,
              }}
            >
              {formatUserCode(data)}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span className="font-mono-custom text-[10px] text-[#888888] tracking-wider uppercase">Domicile:</span>
            <span className="font-medium text-[#171717] dark:text-zinc-100">{data.domicile || 'Garut, Jawa Barat'}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            className="w-full font-heading text-xs tracking-[0.16em] uppercase text-white bg-[#000000] py-3 hover:bg-[#333333] transition-colors flex items-center justify-center gap-2 font-semibold cursor-pointer"
            onClick={handlePrint}
          >
            <Icon name="print" size={16} />
            <span>Print Card</span>
          </button>
          <button
            type="button"
            className="w-full font-heading text-xs tracking-[0.16em] uppercase text-[#171717] dark:text-zinc-200 bg-white dark:bg-zinc-800 border border-[#eaeaea] dark:border-zinc-700 py-3 hover:bg-[#f5f5f5] dark:hover:bg-zinc-700 transition-colors flex items-center justify-center gap-2 font-semibold cursor-pointer"
            disabled={exporting}
            onClick={handleExport}
          >
            <Icon name="download" size={16} />
            <span>{exporting ? 'Exporting...' : 'Export PNG'}</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
