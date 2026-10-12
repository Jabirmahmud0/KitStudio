import { layoutPlayerName } from './printLayout'
/**
 * KitStudio — Canvas 2D → texture pipeline (PRD §7.1).
 * Patterns, zone colors, trim and the back print are painted into a
 * canvas in texture space; the same drawing powers the 3D texture,
 * the 2D fallback renders, gallery thumbnails and summary previews,
 * so every surface shows the identical design.
 */
import type { KitDesign, KitPrint } from './types'

export const PANEL_W = 1024
export const PANEL_H = 1160

/** Torso bounds in world units — shared with the 3D geometry. */
export const TORSO = { w: 1.5, h: 1.7, x0: -0.75, y1: 0.85 }

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp((n >> 16) + amt)
  const g = clamp(((n >> 8) & 0xff) + amt)
  const b = clamp((n & 0xff) + amt)
  return `rgb(${r},${g},${b})`
}

function weave(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  fabric: KitDesign['fabric'] = 'smooth',
) {
  // Fabric character — realism from texture, not geometry (PRD M6).
  ctx.save()
  if (fabric === 'mesh') {
    ctx.fillStyle = '#000000'
    ctx.globalAlpha = 0.10
    for (let y = 3; y < h; y += 7)
      for (let x = 3; x < w; x += 7) {
        ctx.beginPath()
        ctx.arc(x, y, 1.3, 0, Math.PI * 2)
        ctx.fill()
      }
  } else if (fabric === 'pique') {
    ctx.fillStyle = '#000000'
    ctx.globalAlpha = 0.07
    for (let y = 0, row = 0; y < h; y += 9, row++)
      for (let x = row % 2 ? 4 : 0; x < w; x += 9) {
        ctx.beginPath()
        ctx.arc(x, y, 1.6, 0, Math.PI * 2)
        ctx.fill()
      }
  } else if (fabric === 'ribbed') {
    ctx.fillStyle = '#000000'
    ctx.globalAlpha = 0.06
    for (let x = 0; x < w; x += 5) ctx.fillRect(x, 0, 1.4, h)
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = 0.04
    for (let x = 2; x < w; x += 5) ctx.fillRect(x, 0, 1.2, h)
  } else {
    ctx.globalAlpha = 0.05
    ctx.fillStyle = '#000000'
    for (let y = 0; y < h; y += 4) ctx.fillRect(0, y, w, 1)
    ctx.globalAlpha = 0.04
    ctx.fillStyle = '#ffffff'
    for (let y = 2; y < h; y += 4) ctx.fillRect(0, y, w, 1)
  }
  ctx.restore()
}

function drawPattern(
  ctx: CanvasRenderingContext2D,
  design: KitDesign,
  w: number,
  h: number,
) {
  const { pattern, colors } = design
  ctx.fillStyle = colors.primary
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = colors.secondary
  switch (pattern) {
    case 'solid':
      break
    case 'stripes': {
      const band = w / 9
      for (let x = band * 0.5; x < w; x += band * 2) {
        ctx.fillRect(x, 0, band, h)
      }
      break
    }
    case 'hoops': {
      const band = h / 11
      for (let y = band * 0.6; y < h; y += band * 2) {
        ctx.fillRect(0, y, w, band)
      }
      break
    }
    case 'sash': {
      ctx.save()
      ctx.translate(w / 2, h / 2)
      ctx.rotate((-32 * Math.PI) / 180)
      ctx.fillRect(-w, -h * 0.11, w * 2, h * 0.22)
      ctx.restore()
      break
    }
    case 'gradient': {
      const g = ctx.createLinearGradient(0, h * 0.25, 0, h)
      g.addColorStop(0, colors.primary)
      g.addColorStop(1, colors.secondary)
      ctx.fillStyle = g
      ctx.fillRect(0, 0, w, h)
      break
    }
    case 'halves': {
      ctx.fillRect(w / 2, 0, w / 2, h)
      break
    }
    case 'quarters': {
      ctx.fillRect(w / 2, 0, w / 2, h / 2)
      ctx.fillRect(0, h / 2, w / 2, h / 2)
      break
    }
    case 'chevron': {
      ctx.save()
      ctx.strokeStyle = colors.secondary
      ctx.lineWidth = h * 0.052
      ctx.lineJoin = 'miter'
      for (let row = 0; row < 3; row++) {
        const baseY = h * (0.24 + row * 0.26)
        ctx.beginPath()
        ctx.moveTo(-10, baseY - h * 0.07)
        ctx.lineTo(w / 2, baseY + h * 0.07)
        ctx.lineTo(w + 10, baseY - h * 0.07)
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'pinstripes': {
      const step = w / 16
      for (let x = step * 0.5; x < w; x += step) {
        ctx.fillRect(x, 0, Math.max(3, w / 72), h)
      }
      break
    }
    case 'yoke': {
      ctx.fillRect(0, 0, w, h * 0.3)
      ctx.fillRect(0, h * 0.36, w, h * 0.035)
      break
    }
    case 'bias': {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.clip()
      ctx.translate(w / 2, h / 2)
      ctx.rotate((-38 * Math.PI) / 180)
      const band = w / 8
      for (let x = -w; x < w; x += band * 2) {
        ctx.fillRect(x, -h, band, h * 2)
      }
      ctx.restore()
      break
    }
    case 'wave': {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.clip()
      const amp = h * 0.018
      const bandH = h / 11
      for (let row = 0; row < 6; row++) {
        const yBase = bandH * 0.6 + row * bandH * 2
        ctx.beginPath()
        ctx.moveTo(0, yBase)
        for (let x = 0; x <= w; x += w / 24) {
          ctx.lineTo(x, yBase + Math.sin((x / w) * Math.PI * 4) * amp)
        }
        for (let x = w; x >= 0; x -= w / 24) {
          ctx.lineTo(x, yBase + bandH + Math.sin((x / w) * Math.PI * 4) * amp)
        }
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      break
    }
    case 'burst': {
      ctx.save()
      ctx.beginPath()
      ctx.rect(0, 0, w, h)
      ctx.clip()
      const cx = w / 2
      const cy = h * 0.16
      const R = Math.hypot(w, h)
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * Math.PI * 2
        const a1 = a0 + Math.PI / 24
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.arc(cx, cy, R, a0, a1)
        ctx.closePath()
        ctx.fill()
      }
      ctx.restore()
      break
    }
    case 'grid': {
      const stepX = w / 6
      const stepY = h / 7
      for (let x = stepX; x < w; x += stepX) ctx.fillRect(x - 2, 0, 4, h)
      for (let y = stepY; y < h; y += stepY) ctx.fillRect(0, y - 2, w, 4)
      break
    }
  }
}

function drawTrimAndDetails(
  ctx: CanvasRenderingContext2D,
  design: KitDesign,
  w: number,
  h: number,
) {
  const { colors } = design
  // Side panels — texture-space masks sharing the Trim zone (PRD §5.5).
  ctx.save()
  ctx.fillStyle = colors.trim
  ctx.globalAlpha = 0.92
  ctx.beginPath()
  ctx.moveTo(0, h * 0.28)
  ctx.quadraticCurveTo(w * 0.045, h * 0.6, 0, h)
  ctx.lineTo(w * 0.035, h)
  ctx.quadraticCurveTo(w * 0.075, h * 0.6, w * 0.055, h * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(w, h * 0.28)
  ctx.quadraticCurveTo(w * 0.955, h * 0.6, w, h)
  ctx.lineTo(w * 0.965, h)
  ctx.quadraticCurveTo(w * 0.925, h * 0.6, w * 0.945, h * 0.3)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // Hem band in trim.
  ctx.fillStyle = colors.trim
  ctx.globalAlpha = 0.95
  ctx.fillRect(0, h - 20, w, 20)
  ctx.globalAlpha = 1

  // Collar following the neck scoop, per collar style (trim zone).
  const u = (x: number) => ((x - TORSO.x0) / TORSO.w) * w
  const v = (y: number) => ((TORSO.y1 - y) / TORSO.h) * h
  ctx.strokeStyle = colors.trim
  ctx.lineCap = 'round'
  if (design.collar === 'vneck') {
    ctx.lineWidth = 24
    ctx.beginPath()
    ctx.moveTo(u(-0.185), v(0.78))
    ctx.lineTo(u(0), v(0.44))
    ctx.lineTo(u(0.185), v(0.78))
    ctx.stroke()
  } else if (design.collar === 'polo') {
    ctx.lineWidth = 34
    ctx.beginPath()
    ctx.moveTo(u(-0.185), v(0.775))
    ctx.quadraticCurveTo(u(0), v(0.665), u(0.185), v(0.775))
    ctx.stroke()
    // Placket + buttons.
    ctx.fillStyle = shade(colors.trim, -14)
    const pw = w * 0.035
    ctx.fillRect(u(0) - pw / 2, v(0.72), pw, v(0.44) - v(0.72))
    ctx.fillStyle = colors.primary
    for (const by of [0.63, 0.53]) {
      ctx.beginPath()
      ctx.arc(u(0), v(by), 5, 0, Math.PI * 2)
      ctx.fill()
    }
  } else if (design.collar === 'mock') {
    ctx.lineWidth = 52
    ctx.beginPath()
    ctx.moveTo(u(-0.185), v(0.775))
    ctx.quadraticCurveTo(u(0), v(0.68), u(0.185), v(0.775))
    ctx.stroke()
  } else {
    ctx.lineWidth = 30
    ctx.beginPath()
    ctx.moveTo(u(-0.185), v(0.775))
    ctx.quadraticCurveTo(u(0), v(0.665), u(0.185), v(0.775))
    ctx.stroke()
  }
}

/** Draw print text honouring the print style (solid/outline/shadow). */
function printText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  style: KitPrint['style'],
  fontPx: number,
) {
  if (style === 'shadow') {
    ctx.save()
    ctx.fillStyle = 'rgba(0,0,0,0.38)'
    ctx.fillText(text, x + fontPx * 0.045, y + fontPx * 0.05)
    ctx.restore()
  }
  if (style === 'outline') {
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = fontPx * 0.055
    ctx.strokeText(text, x, y)
    ctx.restore()
    return
  }
  ctx.save()
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = fontPx * 0.028
  ctx.strokeText(text, x, y)
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** Shared measured print layout for flat previews and the model UV atlas. */
function drawMeasuredBackPrint(
  ctx: CanvasRenderingContext2D,
  print: KitPrint,
  x0: number, y0: number, w: number, h: number,
  horizontalOffset: number, verticalOffset: number,
  nameY: number,
) {
  if (!print.enabled) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cx = x0 + w / 2 + print.offsetX * w * horizontalOffset
  const oy = print.offsetY * h * verticalOffset
  const font = (size: number) => print.font === 'block'
    ? `900 ${size}px Archivo, "Arial Black", sans-serif`
    : `600 ${size}px Oswald, Inter, sans-serif`
  const measure = (glyph: string, size: number) => {
    ctx.font = font(size)
    const metrics = ctx.measureText(glyph)
    return Math.max(metrics.width, (metrics.actualBoundingBoxLeft || 0) + (metrics.actualBoundingBoxRight || 0))
  }
  // Keep the whole print within the usable back width as it moves sideways.
  const availableWidth = Math.max(w * 0.2, w * 0.88 - Math.abs(print.offsetX) * w * horizontalOffset * 2)
  const name = layoutPlayerName(print.playerName, Math.min(w * 0.185, h * 0.135) * print.nameScale,
    availableWidth, w * 0.95, measure)
  const nameCenterY = y0 + h * nameY + oy
  ctx.font = font(name.fontPx)
  for (const glyph of name.glyphs) {
    ctx.save()
    ctx.translate(cx + glyph.x, nameCenterY + glyph.y)
    ctx.rotate(glyph.angle)
    printText(ctx, glyph.text, 0, 0, print.color, print.style, name.fontPx)
    ctx.restore()
  }
  // Fit wide numbers and reserve a real gap beneath the lowest name glyph.
  const nameBottom = name.glyphs.length ? nameCenterY + name.bottom : y0 + h * 0.15 + oy
  const bottom = y0 + h * 0.94 + Math.min(0, oy)
  const gap = h * 0.055
  let numPx = Math.min(h * 0.39 * print.numberScale, Math.max(h * 0.12, (bottom - nameBottom - gap) / 1.1))
  const number = String(print.number)
  const numberWidth = measure(number, numPx) + numPx * 0.11
  if (numberWidth > availableWidth) numPx *= availableWidth / numberWidth
  const halfHeight = numPx * 0.55
  const numberY = Math.min(bottom - halfHeight, Math.max(y0 + h * 0.54 + oy, nameBottom + gap + halfHeight))
  ctx.font = font(numPx)
  printText(ctx, number, cx, numberY, print.color, print.style, numPx)
  ctx.restore()
}

function drawBackPrint(ctx: CanvasRenderingContext2D, print: KitPrint, w: number, h: number) {
  drawMeasuredBackPrint(ctx, print, 0, 0, w, h, 0.16, 0.12, 0.16)
}

/** Sponsor-style tagline across the front chest (flat render). */
function drawTaglineFlat(
  ctx: CanvasRenderingContext2D,
  print: KitPrint,
  w: number,
  h: number,
) {
  if (!print.tagline) return
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = `600 44px Oswald, Inter, sans-serif`
  ctx.fillStyle = print.color
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1.4
  const spaced = print.tagline.split('').join('  ')
  ctx.strokeText(spaced, w / 2, h * 0.335)
  ctx.fillText(spaced, w / 2, h * 0.335)
  ctx.restore()
}

export type PanelSide = 'front' | 'back'

/** Paint one torso panel (front or back) into a fresh canvas. */
export function drawPanelCanvas(
  side: PanelSide,
  design: KitDesign,
  print: KitPrint,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = PANEL_W
  canvas.height = PANEL_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  drawPattern(ctx, design, PANEL_W, PANEL_H)
  // Gentle vertical shading so the panel reads as fabric, not a poster.
  const grad = ctx.createLinearGradient(0, 0, PANEL_W, 0)
  grad.addColorStop(0, 'rgba(0,0,0,0.20)')
  grad.addColorStop(0.22, 'rgba(255,255,255,0.05)')
  grad.addColorStop(0.5, 'rgba(255,255,255,0.10)')
  grad.addColorStop(0.78, 'rgba(255,255,255,0.05)')
  grad.addColorStop(1, 'rgba(0,0,0,0.20)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, PANEL_W, PANEL_H)
  drawTrimAndDetails(ctx, design, PANEL_W, PANEL_H)
  if (side === 'back') drawBackPrint(ctx, print, PANEL_W, PANEL_H)
  if (side === 'front') drawTaglineFlat(ctx, print, PANEL_W, PANEL_H)
  weave(ctx, PANEL_W, PANEL_H, design.fabric)
  return canvas
}

/** Sleeve panel — sleeve zone color with a secondary accent near the cuff. */
export function drawSleeveCanvas(design: KitDesign): HTMLCanvasElement {
  const w = 512
  const h = 512
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  ctx.fillStyle = design.colors.sleeves
  ctx.fillRect(0, 0, w, h)
  // Sleeve design (its own control, independent of the torso pattern).
  ctx.fillStyle = design.colors.secondary
  if (design.sleeveStyle === 'band') {
    ctx.globalAlpha = 0.9
    ctx.fillRect(w * 0.52, 0, w * 0.16, h)
    ctx.globalAlpha = 1
  } else if (design.sleeveStyle === 'double-band') {
    ctx.globalAlpha = 0.9
    ctx.fillRect(w * 0.42, 0, w * 0.11, h)
    ctx.fillRect(w * 0.62, 0, w * 0.11, h)
    ctx.globalAlpha = 1
  } else if (design.sleeveStyle === 'fade') {
    const g = ctx.createLinearGradient(w * 0.3, 0, w, 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, design.colors.secondary)
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  } else if (
    design.pattern === 'stripes' ||
    design.pattern === 'hoops' ||
    design.pattern === 'pinstripes' ||
    design.pattern === 'chevron'
  ) {
    ctx.globalAlpha = 0.85
    ctx.fillRect(w * 0.62, 0, w * 0.14, h)
    ctx.globalAlpha = 1
  } else if (design.pattern === 'halves' || design.pattern === 'quarters') {
    ctx.globalAlpha = 0.85
    ctx.fillRect(w * 0.55, 0, w * 0.45, h)
    ctx.globalAlpha = 1
  }
  if (design.pattern === 'gradient') {
    const g = ctx.createLinearGradient(0, 0, w, 0)
    g.addColorStop(0, design.colors.sleeves)
    g.addColorStop(1, shade(design.colors.secondary, -10))
    ctx.fillStyle = g
    ctx.fillRect(0, 0, w, h)
  }
  weave(ctx, w, h, design.fabric)
  return canvas
}

/** Standalone front/back PNG data URL (fallback renders & thumbnails). */
export function panelDataUrl(
  side: PanelSide,
  design: KitDesign,
  print: KitPrint,
): string {
  return drawPanelCanvas(side, design, print).toDataURL('image/png')
}

/* ------------------------------------------------------------------ */
/* Flat display render — the panel texture clipped to the jersey      */
/* silhouette (torso + sleeves + cuffs), for thumbnails, the WebGL    */
/* fallback, gallery cards and the order-summary export. The raw      */
/* panel canvas is texture space (a rectangle); this is the garment.  */
/* ------------------------------------------------------------------ */

const FLAT_W = 1040
const FLAT_H = 900
const FLAT_S = 460 // px per world unit
const flatX = (x: number) => FLAT_W / 2 + x * FLAT_S
const flatY = (y: number) => FLAT_H / 2 - y * FLAT_S

function torsoPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath()
  ctx.moveTo(flatX(-0.18), flatY(0.78))
  ctx.lineTo(flatX(-0.62), flatY(0.85))
  ctx.lineTo(flatX(-0.565), flatY(0.35))
  ctx.quadraticCurveTo(flatX(-0.545), flatY(0), flatX(-0.555), flatY(-0.3))
  ctx.lineTo(flatX(-0.585), flatY(-0.85))
  ctx.quadraticCurveTo(flatX(0), flatY(-0.885), flatX(0.585), flatY(-0.85))
  ctx.lineTo(flatX(0.555), flatY(-0.3))
  ctx.quadraticCurveTo(flatX(0.545), flatY(0), flatX(0.565), flatY(0.35))
  ctx.lineTo(flatX(0.62), flatY(0.85))
  ctx.lineTo(flatX(0.18), flatY(0.78))
  ctx.quadraticCurveTo(flatX(0), flatY(0.665), flatX(-0.18), flatY(0.78))
  ctx.closePath()
}

function drawFlatSleeve(
  ctx: CanvasRenderingContext2D,
  sideSign: 1 | -1,
  design: KitDesign,
) {
  const long = design.modelId === 'pro-long'
  const L = long ? 0.85 : 0.52 // sleeve length in world units
  ctx.save()
  ctx.translate(flatX(0.6 * sideSign), flatY(0.56))
  // Canvas rotation is the negation of the world Z rotation (y-flip).
  // Long sleeves angle down along the arm line, like the 3D model.
  const deg = long ? 52 : 28
  ctx.rotate(
    sideSign === 1 ? (deg * Math.PI) / 180 : ((180 - deg) * Math.PI) / 180,
  )
  const px = (x: number) => x * FLAT_S
  const py = (y: number) => -y * FLAT_S
  ctx.beginPath()
  ctx.moveTo(px(0), py(0.21))
  ctx.lineTo(px(L), py(0.03))
  ctx.lineTo(px(L - 0.055), py(-0.3))
  ctx.lineTo(px(0), py(-0.245))
  ctx.closePath()
  ctx.fillStyle = design.colors.sleeves
  ctx.fill()
  const sleeveAccent = (from: number, width: number) => {
    ctx.save()
    ctx.clip()
    ctx.fillStyle = design.colors.secondary
    ctx.globalAlpha = 0.88
    ctx.fillRect(px(from), py(0.25), px(width), FLAT_S * 0.6)
    ctx.restore()
  }
  if (design.sleeveStyle === 'band') {
    sleeveAccent(L * 0.52, 0.09)
  } else if (design.sleeveStyle === 'double-band') {
    sleeveAccent(L * 0.4, 0.06)
    sleeveAccent(L * 0.58, 0.06)
  } else if (design.sleeveStyle === 'fade') {
    ctx.save()
    ctx.clip()
    const g = ctx.createLinearGradient(px(L * 0.3), 0, px(L), 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, design.colors.secondary)
    ctx.fillStyle = g
    ctx.fillRect(0, py(0.25), px(L), FLAT_S * 0.6)
    ctx.restore()
  } else if (
    design.pattern === 'stripes' ||
    design.pattern === 'hoops' ||
    design.pattern === 'pinstripes' ||
    design.pattern === 'chevron'
  ) {
    sleeveAccent(L * 0.58, 0.07)
  }
  // cuff in trim
  ctx.beginPath()
  ctx.moveTo(px(L - 0.12), py(0.062))
  ctx.lineTo(px(L + 0.015), py(0.016))
  ctx.lineTo(px(L - 0.048), py(-0.3))
  ctx.lineTo(px(L - 0.12), py(-0.292))
  ctx.closePath()
  ctx.fillStyle = design.colors.trim
  ctx.fill()
  ctx.restore()
}

export function drawFlatCanvas(
  side: PanelSide,
  design: KitDesign,
  print: KitPrint,
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = FLAT_W
  canvas.height = FLAT_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return canvas
  drawFlatSleeve(ctx, -1, design)
  drawFlatSleeve(ctx, 1, design)
  ctx.save()
  torsoPath(ctx)
  ctx.clip()
  const panel = drawPanelCanvas(side, design, print)
  ctx.drawImage(
    panel,
    flatX(TORSO.x0),
    flatY(TORSO.y1),
    TORSO.w * FLAT_S,
    TORSO.h * FLAT_S,
  )
  ctx.restore()
  // collar over the neck scoop, per style
  ctx.strokeStyle = design.colors.trim
  ctx.lineCap = 'round'
  if (design.collar === 'vneck') {
    ctx.lineWidth = 13
    ctx.beginPath()
    ctx.moveTo(flatX(-0.185), flatY(0.78))
    ctx.lineTo(flatX(0), flatY(0.42))
    ctx.lineTo(flatX(0.185), flatY(0.78))
    ctx.stroke()
  } else {
    ctx.lineWidth = design.collar === 'mock' ? 24 : design.collar === 'polo' ? 17 : 15
    ctx.beginPath()
    ctx.moveTo(flatX(-0.185), flatY(0.775))
    ctx.quadraticCurveTo(flatX(0), flatY(0.7), flatX(0.185), flatY(0.775))
    ctx.stroke()
    if (design.collar === 'polo') {
      ctx.fillStyle = shade(design.colors.trim, -14)
      ctx.fillRect(flatX(0) - 7, flatY(0.74), 14, flatY(0.44) - flatY(0.74))
    }
  }
  return canvas
}

export function flatDataUrl(
  side: PanelSide,
  design: KitDesign,
  print: KitPrint,
): string {
  return drawFlatCanvas(side, design, print).toDataURL('image/png')
}

/* ------------------------------------------------------------------ */
/* GLB texture painting — the design painted into the Pro Slim model's */
/* own UV space, using the zone masks from modelZones.ts. The model's  */
/* baked AO + weave normal maps supply the fabric realism on top.      */
/* ------------------------------------------------------------------ */

import { TEX_SIZE, type ModelZones, type UVRect } from './modelZones'

function layerFromMask(
  S: number,
  mask: HTMLCanvasElement,
  paint: (ctx: CanvasRenderingContext2D) => void,
): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = S
  c.height = S
  const ctx = c.getContext('2d')!
  paint(ctx)
  ctx.globalCompositeOperation = 'destination-in'
  // A whisper of blur takes the hard stair-step off zone seams.
  try {
    ctx.filter = 'blur(1px)'
  } catch {
    /* filter unsupported — hard edges are acceptable */
  }
  ctx.drawImage(mask, 0, 0)
  ctx.filter = 'none'
  return c
}

import type { IslandAffine } from './modelZones'

/**
 * Paint one island's pattern in GARMENT space, mapped through the
 * island's affine fit — so stripes are even on the body no matter
 * how the UV island is packed.
 */
function patternForIsland(
  ctx: CanvasRenderingContext2D,
  aff: IslandAffine,
  S: number,
  design: KitDesign,
) {
  const uOf = (gx: number) => (aff.a * gx + aff.b) * S
  const vOf = (gy: number) => (aff.c * gy + aff.d) * S
  const top = vOf(0.27)
  const bottom = vOf(-0.37)
  const left = uOf(-0.29)
  const right = uOf(0.29)
  /** Axis-safe garment-space rect (either affine may run backwards). */
  const rect = (gx1: number, gy1: number, gx2: number, gy2: number) => {
    const ux1 = uOf(gx1)
    const ux2 = uOf(gx2)
    const vy1 = vOf(gy1)
    const vy2 = vOf(gy2)
    ctx.fillRect(
      Math.min(ux1, ux2),
      Math.min(vy1, vy2),
      Math.abs(ux2 - ux1),
      Math.abs(vy2 - vy1),
    )
  }
  const { pattern, colors } = design
  ctx.fillStyle = colors.secondary
  switch (pattern) {
    case 'solid':
      break
    case 'stripes': {
      // Stripe centres symmetric about the body's centre line.
      const half = 0.033
      for (const c of [0, -0.132, 0.132, -0.264, 0.264]) {
        const u1 = uOf(c - half)
        const u2 = uOf(c + half)
        ctx.fillRect(Math.min(u1, u2), top, Math.abs(u2 - u1), bottom - top)
      }
      break
    }
    case 'hoops': {
      const band = 0.058
      for (let gy = 0.21; gy > -0.37; gy -= band * 2) {
        ctx.fillRect(left, vOf(gy), right - left, vOf(gy - band) - vOf(gy))
      }
      break
    }
    case 'sash': {
      // A thick diagonal band, hip to shoulder. Affine maps keep the
      // straight garment-space line straight in UV space.
      ctx.strokeStyle = colors.secondary
      ctx.lineWidth = Math.abs(aff.c) * S * 0.115
      ctx.lineCap = 'butt'
      ctx.beginPath()
      ctx.moveTo(uOf(-0.31), vOf(-0.17))
      ctx.lineTo(uOf(0.31), vOf(0.23))
      ctx.stroke()
      break
    }
    case 'gradient': {
      const g = ctx.createLinearGradient(0, vOf(0.08), 0, vOf(-0.37))
      g.addColorStop(0, 'rgba(0,0,0,0)')
      g.addColorStop(1, colors.secondary)
      ctx.fillStyle = g
      ctx.fillRect(left, top, right - left, bottom - top)
      break
    }
    case 'halves': {
      rect(0, 0.27, 0.29, -0.37)
      break
    }
    case 'quarters': {
      rect(0, 0.27, 0.29, -0.05)
      rect(-0.29, -0.05, 0, -0.37)
      break
    }
    case 'chevron': {
      ctx.save()
      ctx.strokeStyle = colors.secondary
      ctx.lineWidth = Math.abs(aff.c) * S * 0.048
      ctx.lineJoin = 'miter'
      for (const baseGy of [0.16, 0.0, -0.16]) {
        ctx.beginPath()
        ctx.moveTo(uOf(-0.3), vOf(baseGy + 0.075))
        ctx.lineTo(uOf(0), vOf(baseGy - 0.055))
        ctx.lineTo(uOf(0.3), vOf(baseGy + 0.075))
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'pinstripes': {
      for (let gx = -0.286; gx < 0.29; gx += 0.044) {
        rect(gx - 0.0055, 0.27, gx + 0.0055, -0.37)
      }
      break
    }
    case 'yoke': {
      rect(-0.29, 0.27, 0.29, 0.1)
      rect(-0.29, 0.045, 0.29, 0.015)
      break
    }
    case 'bias': {
      // Diagonal stripes in garment space (straight lines stay
      // straight through the affine map).
      ctx.save()
      ctx.strokeStyle = colors.secondary
      ctx.lineWidth = Math.abs(aff.c) * S * 0.055
      for (let d = -0.75; d < 0.75; d += 0.132) {
        ctx.beginPath()
        ctx.moveTo(uOf(-0.31), vOf(-0.31 * 0.9 + d))
        ctx.lineTo(uOf(0.31), vOf(0.31 * 0.9 + d))
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'wave': {
      ctx.save()
      ctx.strokeStyle = colors.secondary
      ctx.lineWidth = Math.abs(aff.c) * S * 0.052
      for (let row = 0; row < 5; row++) {
        const yBase = 0.19 - row * 0.116
        ctx.beginPath()
        for (let gx = -0.29; gx <= 0.29; gx += 0.02) {
          const gy = yBase + Math.sin(((gx + 0.29) / 0.58) * Math.PI * 4) * 0.016
          const px = uOf(gx)
          const py = vOf(gy)
          if (gx === -0.29) ctx.moveTo(px, py)
          else ctx.lineTo(px, py)
        }
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'burst': {
      ctx.save()
      ctx.strokeStyle = colors.secondary
      ctx.lineWidth = Math.abs(aff.c) * S * 0.038
      const cxG = 0
      const cyG = 0.17
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.13
        ctx.beginPath()
        ctx.moveTo(uOf(cxG), vOf(cyG))
        ctx.lineTo(uOf(cxG + Math.cos(a) * 0.62), vOf(cyG + Math.sin(a) * 0.62))
        ctx.stroke()
      }
      ctx.restore()
      break
    }
    case 'grid': {
      for (let gx = -0.232; gx <= 0.24; gx += 0.116) {
        rect(gx - 0.0035, 0.27, gx + 0.0035, -0.37)
      }
      for (let gy = 0.176; gy >= -0.3; gy -= 0.116) {
        rect(-0.29, gy + 0.0035, 0.29, gy - 0.0035)
      }
      break
    }
  }
}

function drawBackPrintUV(ctx: CanvasRenderingContext2D, rect: UVRect, S: number, print: KitPrint) {
  drawMeasuredBackPrint(ctx, print, rect.minU * S, rect.minV * S,
    (rect.maxU - rect.minU) * S, (rect.maxV - rect.minV) * S, 0.32, 0.22, 0.09)
}

/** Sponsor-style tagline across the front chest (UV space). */
function drawTaglineUV(
  ctx: CanvasRenderingContext2D,
  zones: ModelZones,
  S: number,
  print: KitPrint,
) {
  if (!print.tagline) return
  const aff = zones.frontAffine
  let fontPx = Math.abs(aff.c) * S * 0.03
  const spaced = print.tagline.split('').join('  ')
  ctx.save()
  ctx.font = `600 ${fontPx}px Oswald, Inter, sans-serif`
  // Fit the tagline inside the chest (max ~62% of the island width).
  const maxW = Math.abs(aff.a) * S * 0.36
  const tw = ctx.measureText(spaced).width
  if (tw > maxW) {
    fontPx *= maxW / tw
    ctx.font = `600 ${fontPx}px Oswald, Inter, sans-serif`
  }
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = print.color
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'
  ctx.lineWidth = fontPx * 0.045
  const x = (aff.a * 0 + aff.b) * S
  const y = (aff.c * 0.015 + aff.d) * S
  ctx.strokeText(spaced, x, y)
  ctx.fillText(spaced, x, y)
  ctx.restore()
}

/* ------------------------------------------------------------------ */
/* Logo — uploaded image or a built-in badge, on chest or sleeve.     */
/* Device-local by design; never part of the share schema.            */
/* ------------------------------------------------------------------ */

export interface LogoRender {
  kind: 'upload' | 'shield' | 'roundel'
  img: HTMLImageElement | null
  placement: 'chest' | 'sleeve-left' | 'sleeve-right'
  scale: number
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  kind: 'shield' | 'roundel',
  cx: number,
  cy: number,
  size: number,
  design: KitDesign,
) {
  ctx.save()
  ctx.translate(cx, cy)
  const s = size / 2
  if (kind === 'shield') {
    ctx.beginPath()
    ctx.moveTo(-s * 0.8, -s * 0.7)
    ctx.lineTo(s * 0.8, -s * 0.7)
    ctx.lineTo(s * 0.8, s * 0.1)
    ctx.quadraticCurveTo(s * 0.8, s * 0.75, 0, s)
    ctx.quadraticCurveTo(-s * 0.8, s * 0.75, -s * 0.8, s * 0.1)
    ctx.closePath()
    ctx.fillStyle = design.colors.trim
    ctx.fill()
    ctx.lineWidth = size * 0.035
    ctx.strokeStyle = design.colors.primary
    ctx.stroke()
    // star
    ctx.fillStyle = design.colors.secondary
    ctx.beginPath()
    const R = s * 0.42
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? R : R * 0.45
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const px = Math.cos(a) * r
      const py = Math.sin(a) * r - s * 0.08
      if (i === 0) ctx.moveTo(px, py)
      else ctx.lineTo(px, py)
    }
    ctx.closePath()
    ctx.fill()
  } else {
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.85, 0, Math.PI * 2)
    ctx.fillStyle = design.colors.trim
    ctx.fill()
    ctx.lineWidth = size * 0.04
    ctx.strokeStyle = design.colors.secondary
    ctx.beginPath()
    ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2)
    ctx.stroke()
    ctx.fillStyle = design.colors.secondary
    ctx.font = `900 ${size * 0.52}px Archivo, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('K', 0, size * 0.02)
  }
  ctx.restore()
}

function drawLogoUV(
  ctx: CanvasRenderingContext2D,
  zones: ModelZones,
  S: number,
  design: KitDesign,
  logo: LogoRender,
) {
  let cx = 0
  let cy = 0
  let size = 0
  if (logo.placement === 'chest') {
    const aff = zones.frontAffine
    cx = (aff.a * 0.105 + aff.b) * S
    cy = (aff.c * 0.125 + aff.d) * S
    size = Math.abs(aff.a) * S * 0.052 * logo.scale
  } else {
    const fit = zones.sleeveFits[logo.placement === 'sleeve-left' ? 'left' : 'right']
    cx = (fit.a * 0.222 + fit.b) * S
    cy = fit.frontV * S
    size = Math.abs(fit.a) * S * 0.045 * logo.scale
  }
  if (logo.kind === 'upload') {
    if (!logo.img || !logo.img.complete || logo.img.naturalWidth === 0) return
    const aspect = logo.img.naturalHeight / logo.img.naturalWidth
    ctx.drawImage(logo.img, cx - size / 2, cy - (size * aspect) / 2, size, size * aspect)
  } else {
    drawBadge(ctx, logo.kind, cx, cy, size * 1.7, design)
  }
}

/**
 * Paint one Pro Long sleeve tube in tube space: u around the arm
 * (0.5 = front centre), v from shoulder (0) to wrist (1). A
 * dedicated canvas per side is what lets the cuff and the sleeve
 * bands finish as crisp straight rings on the 3D model.
 */
export function drawSleeveTubeTexture(
  design: KitDesign,
  logo: LogoRender | null,
  side: 'left' | 'right',
): HTMLCanvasElement {
  const W = 512
  const H = 1024
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  const { colors } = design

  ctx.fillStyle = colors.sleeves
  ctx.fillRect(0, 0, W, H)

  // Sleeve design, in the same order the sheet painter uses:
  // fade / bands in secondary, then the trim cuff on top.
  if (design.sleeveStyle === 'fade') {
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H * 0.98)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, colors.secondary)
    ctx.fillStyle = g
    ctx.fillRect(0, H * 0.45, W, H * 0.55)
  } else if (design.sleeveStyle === 'band') {
    ctx.globalAlpha = 0.92
    ctx.fillStyle = colors.secondary
    ctx.fillRect(0, H * 0.55, W, H * 0.11)
    ctx.globalAlpha = 1
  } else if (design.sleeveStyle === 'double-band') {
    ctx.globalAlpha = 0.92
    ctx.fillStyle = colors.secondary
    ctx.fillRect(0, H * 0.5, W, H * 0.08)
    ctx.fillRect(0, H * 0.64, W, H * 0.08)
    ctx.globalAlpha = 1
  }

  // Cuff: a clean trim ring at the wrist.
  ctx.fillStyle = colors.trim
  ctx.fillRect(0, H * 0.875, W, H * 0.125)

  // Fabric character, same hand as the main texture.
  weave(ctx, W, H, design.fabric)

  // Sleeve logo, front centre of the upper arm.
  if (logo && logo.placement === `sleeve-${side}`) {
    const cx = W / 2
    const cy = H * 0.3
    const size = 100 * logo.scale
    if (logo.kind === 'upload') {
      if (logo.img && logo.img.complete && logo.img.naturalWidth > 0) {
        const aspect = logo.img.naturalHeight / logo.img.naturalWidth
        ctx.drawImage(logo.img, cx - size / 2, cy - (size * aspect) / 2, size, size * aspect)
      }
    } else {
      drawBadge(ctx, logo.kind, cx, cy, size * 1.15, design)
    }
  }

  return canvas
}

/**
 * Paint the wrist cuff texture (mat_cuff): the Trim zone colour
 * with fine vertical ribbing, so the cuff reads as ribbed elastic.
 * u runs around the wrist, v from the sleeve joint (0) to the
 * closed end (1).
 */
export function drawCollarTexture(design: KitDesign): HTMLCanvasElement {
  if (design.collar === 'mock') return drawCuffTexture(design)
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = design.colors.trim
  ctx.fillRect(0, 0, 256, 256)
  weave(ctx, 256, 256, design.fabric)
  return canvas
}

export function drawCuffTexture(design: KitDesign): HTMLCanvasElement {
  const W = 256
  const H = 256
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = design.colors.trim
  ctx.fillRect(0, 0, W, H)
  // Ribbing: fine vertical ribs around the wrist.
  for (let x = 0; x < W; x += 7) {
    ctx.fillStyle = 'rgba(0,0,0,0.13)'
    ctx.fillRect(x, 0, 2.4, H)
    ctx.fillStyle = 'rgba(255,255,255,0.07)'
    ctx.fillRect(x + 3.4, 0, 1.6, H)
  }
  // Sewn-edge shading at both ends of the cuff band.
  const edge = ctx.createLinearGradient(0, 0, 0, H)
  edge.addColorStop(0, 'rgba(0,0,0,0.16)')
  edge.addColorStop(0.14, 'rgba(0,0,0,0)')
  edge.addColorStop(0.86, 'rgba(0,0,0,0)')
  edge.addColorStop(1, 'rgba(0,0,0,0.20)')
  ctx.fillStyle = edge
  ctx.fillRect(0, 0, W, H)
  weave(ctx, W, H, design.fabric)
  return canvas
}

/** Paint the full design into the GLB's UV space. */
export function drawKitTexture(
  design: KitDesign,
  print: KitPrint,
  zones: ModelZones,
  logo?: LogoRender | null,
): HTMLCanvasElement {
  const S = TEX_SIZE
  const canvas = document.createElement('canvas')
  canvas.width = S
  canvas.height = S
  const ctx = canvas.getContext('2d')!
  const { colors } = design

  // Base: primary everywhere (any unclassified texel matches the body).
  ctx.fillStyle = colors.primary
  ctx.fillRect(0, 0, S, S)

  // Pattern on torso islands (secondary), painted in garment space
  // through each island's affine fit.
  const patternLayer = layerFromMask(S, zones.torsoMask, (pctx) => {
    patternForIsland(pctx, zones.frontAffine, S, design)
    patternForIsland(pctx, zones.backAffine, S, design)
  })
  ctx.drawImage(patternLayer, 0, 0)

  // Sleeves zone.
  ctx.drawImage(
    layerFromMask(S, zones.masks.sleeves, (pctx) => {
      pctx.fillStyle = colors.sleeves
      pctx.fillRect(0, 0, S, S)
    }),
    0,
    0,
  )

  // Sleeve design — bands/fade along the arm, painted through the
  // per-sleeve UV fits and clipped to the sleeve mask.
  if (design.sleeveStyle !== 'plain') {
    const sleeveLayer = layerFromMask(S, zones.masks.sleeves, (pctx) => {
      pctx.fillStyle = colors.secondary
      for (const side of ['left', 'right'] as const) {
        const fit = zones.sleeveFits[side]
        const uAt = (s: number) => (fit.a * s + fit.b) * S
        const v0 = fit.minV * S
        const vh = (fit.maxV - fit.minV) * S
        const span = (s1: number, s2: number) => {
          const a = uAt(s1)
          const b = uAt(s2)
          pctx.fillRect(Math.min(a, b), v0, Math.abs(b - a), vh)
        }
        if (design.sleeveStyle === 'band') {
          pctx.globalAlpha = 0.92
          span(0.203, 0.224)
        } else if (design.sleeveStyle === 'double-band') {
          pctx.globalAlpha = 0.92
          span(0.196, 0.21)
          span(0.224, 0.238)
        } else if (design.sleeveStyle === 'fade') {
          const a = uAt(0.19)
          const b = uAt(0.274)
          const g = pctx.createLinearGradient(a, 0, b, 0)
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(1, colors.secondary)
          pctx.fillStyle = g
          pctx.fillRect(Math.min(a, b), v0, Math.abs(b - a), vh)
          pctx.fillStyle = colors.secondary
        }
        pctx.globalAlpha = 1
      }
    })
    ctx.drawImage(sleeveLayer, 0, 0)
  }

  // Trim zones from masks: cuffs and the collar rib.
  for (const z of ['cuff', 'collar'] as const) {
    ctx.drawImage(
      layerFromMask(S, zones.masks[z], (pctx) => {
        pctx.fillStyle = colors.trim
        pctx.fillRect(0, 0, S, S)
      }),
      0,
      0,
    )
  }

  // Trim zones painted in garment space (smooth bands, immune to
  // triangle size): hem band + side panels, clipped to the torso.
  const trimLayer = layerFromMask(S, zones.torsoMask, (pctx) => {
    pctx.fillStyle = colors.trim
    for (const aff of [zones.frontAffine, zones.backAffine]) {
      const uOf = (gx: number) => (aff.a * gx + aff.b) * S
      const vOf = (gy: number) => (aff.c * gy + aff.d) * S
      const hx1 = uOf(-0.3)
      const hx2 = uOf(0.3)
      pctx.fillRect(
        Math.min(hx1, hx2),
        vOf(-0.328),
        Math.abs(hx2 - hx1),
        vOf(-0.4) - vOf(-0.328),
      )
      // Note: side-panel strips were tried here and dropped — the
      // back island's U is too non-linear for a straight garment-space
      // strip, and the wandering edge cost more realism than the
      // detail added. Trim lives on collar, cuffs and hem.
    }
  })
  ctx.drawImage(trimLayer, 0, 0)

  // Neckline styles are modeled in 3D; trim is confined to the collar rib.

  // Fabric character over the garment (print and logo sit on top).
  weave(ctx, S, S, design.fabric)

  // Front tagline + logo, then the back print.
  drawTaglineUV(ctx, zones, S, print)
  if (logo) drawLogoUV(ctx, zones, S, design, logo)
  drawBackPrintUV(ctx, zones.backPrintRect, S, print)

  return canvas
}


