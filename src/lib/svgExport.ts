/**
 * KitStudio — vector export for Adobe Illustrator.
 *
 * Illustrator's native editable formats are proprietary, but it
 * opens and fully edits SVG — so the design is exported as a clean,
 * layered SVG: front and back on one artboard, patterns as vector
 * shapes, print as live <text> (Archivo/Oswald), colors as flat
 * fills a designer can re-ink. Not a manufacturing file.
 */
import type { SharedDesignV1 } from './types'

const S = 460 // px per world unit, mirroring the flat render
const W = 1040
const H = 900
const fx = (x: number) => W / 2 + x * S
const fy = (y: number) => H / 2 - y * S

function torsoPath(): string {
  const p: string[] = []
  const M = (x: number, y: number) => `M ${fx(x).toFixed(1)} ${fy(y).toFixed(1)}`
  const L = (x: number, y: number) => `L ${fx(x).toFixed(1)} ${fy(y).toFixed(1)}`
  const Q = (cx: number, cy: number, x: number, y: number) =>
    `Q ${fx(cx).toFixed(1)} ${fy(cy).toFixed(1)} ${fx(x).toFixed(1)} ${fy(y).toFixed(1)}`
  p.push(M(-0.18, 0.78))
  p.push(L(-0.62, 0.85))
  p.push(L(-0.565, 0.35))
  p.push(Q(-0.545, 0, -0.555, -0.3))
  p.push(L(-0.585, -0.85))
  p.push(Q(0, -0.885, 0.585, -0.85))
  p.push(L(0.555, -0.3))
  p.push(Q(0.545, 0, 0.565, 0.35))
  p.push(L(0.62, 0.85))
  p.push(L(0.18, 0.78))
  p.push(Q(0, 0.665, -0.18, 0.78))
  p.push('Z')
  return p.join(' ')
}

function sleevePolygon(sideSign: 1 | -1, long: boolean): string {
  const L = long ? 0.85 : 0.52
  const deg = long ? 52 : 28
  const rad = ((sideSign === 1 ? deg : 180 - deg) * Math.PI) / 180
  const ox = fx(0.6 * sideSign)
  const oy = fy(0.56)
  const pt = (lx: number, ly: number): [number, number] => {
    // canvas-space local point (y down) rotated by rad
    const c = Math.cos(rad)
    const s = Math.sin(rad)
    return [ox + (lx * c - ly * s) * S * 0 + (lx * c - -ly * s), oy]
  }
  void pt
  // Simpler: compute in canvas px directly.
  const px = (lx: number, ly: number): [number, number] => {
    const X = lx * S
    const Y = -ly * S
    const c = Math.cos(rad)
    const s = Math.sin(rad)
    return [ox + X * c - Y * s, oy + X * s + Y * c]
  }
  const pts = [
    px(0, 0.21),
    px(L, 0.03),
    px(L - 0.055, -0.3),
    px(0, -0.245),
  ]
  return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
}

/** Pattern shapes in panel space (1024×1160), mirroring texture.ts. */
function patternShapes(d: SharedDesignV1['design']): string {
  const w = 1024
  const h = 1160
  const sec = d.colors.secondary
  const out: string[] = []
  switch (d.pattern) {
    case 'stripes': {
      const band = w / 9
      for (let x = band * 0.5; x < w; x += band * 2)
        out.push(`<rect x="${x}" y="0" width="${band}" height="${h}" fill="${sec}"/>`)
      break
    }
    case 'hoops': {
      const band = h / 11
      for (let y = band * 0.6; y < h; y += band * 2)
        out.push(`<rect x="0" y="${y}" width="${w}" height="${band}" fill="${sec}"/>`)
      break
    }
    case 'sash':
      out.push(
        `<polygon points="${-w},${h * 0.28} ${w * 2},${h * 0.02} ${w * 2},${h * 0.24} ${-w},${h * 0.5}" fill="${sec}"/>`,
      )
      break
    case 'gradient':
      out.push(
        `<defs><linearGradient id="grad${d.pattern}" x1="0" y1="0" x2="0" y2="1"><stop offset="0.25" stop-color="${d.colors.primary}"/><stop offset="1" stop-color="${sec}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#grad${d.pattern})"/>`,
      )
      break
    case 'halves':
      out.push(`<rect x="${w / 2}" width="${w / 2}" height="${h}" fill="${sec}"/>`)
      break
    case 'quarters':
      out.push(`<rect x="${w / 2}" width="${w / 2}" height="${h / 2}" fill="${sec}"/>`)
      out.push(`<rect y="${h / 2}" width="${w / 2}" height="${h / 2}" fill="${sec}"/>`)
      break
    case 'chevron': {
      for (let row = 0; row < 3; row++) {
        const yB = h * (0.24 + row * 0.26)
        out.push(
          `<polyline points="-10,${yB - h * 0.07} ${w / 2},${yB + h * 0.07} ${w + 10},${yB - h * 0.07}" fill="none" stroke="${sec}" stroke-width="${h * 0.052}"/>`,
        )
      }
      break
    }
    case 'pinstripes': {
      const step = w / 16
      for (let x = step * 0.5; x < w; x += step)
        out.push(`<rect x="${x}" width="${Math.max(3, w / 72)}" height="${h}" fill="${sec}"/>`)
      break
    }
    case 'yoke':
      out.push(`<rect width="${w}" height="${h * 0.3}" fill="${sec}"/>`)
      out.push(`<rect y="${h * 0.36}" width="${w}" height="${h * 0.035}" fill="${sec}"/>`)
      break
    case 'bias': {
      const band = w / 8
      for (let x = -w; x < w; x += band * 2)
        out.push(
          `<g transform="translate(${w / 2} ${h / 2}) rotate(-38)"><rect x="${x}" y="${-h}" width="${band}" height="${h * 2}" fill="${sec}"/></g>`,
        )
      break
    }
    case 'wave': {
      const bandH = h / 11
      for (let row = 0; row < 6; row++) {
        const yB = bandH * 0.6 + row * bandH * 2
        const pts: string[] = []
        for (let x = 0; x <= w; x += w / 24)
          pts.push(`${x},${(yB + Math.sin((x / w) * Math.PI * 4) * h * 0.018).toFixed(1)}`)
        out.push(
          `<polyline points="${pts.join(' ')}" fill="none" stroke="${sec}" stroke-width="${bandH}"/>`,
        )
      }
      break
    }
    case 'burst': {
      const cx = w / 2
      const cy = h * 0.16
      const R = Math.hypot(w, h)
      for (let i = 0; i < 12; i++) {
        const a0 = (i / 12) * Math.PI * 2
        const a1 = a0 + Math.PI / 24
        out.push(
          `<polygon points="${cx},${cy} ${cx + R * Math.cos(a0)},${cy + R * Math.sin(a0)} ${cx + R * Math.cos(a1)},${cy + R * Math.sin(a1)}" fill="${sec}"/>`,
        )
      }
      break
    }
    case 'grid': {
      for (let x = w / 6; x < w; x += w / 6)
        out.push(`<rect x="${x - 2}" width="4" height="${h}" fill="${sec}"/>`)
      for (let y = h / 7; y < h; y += h / 7)
        out.push(`<rect y="${y - 2}" width="${w}" height="4" fill="${sec}"/>`)
      break
    }
    default:
      break
  }
  return out.join('')
}

function sideGroup(state: SharedDesignV1, side: 'front' | 'back', ox: number): string {
  const d = state.design
  const p = state.print
  const long = d.modelId === 'pro-long'
  const torso = torsoPath()
  const panelX = fx(-0.75)
  const panelY = fy(0.85)
  const panelW = 1.5 * S
  const panelH = 1.7 * S
  const parts: string[] = []
  parts.push(`<g transform="translate(${ox} 0)">`)
  // sleeves
  for (const s of [-1, 1] as const) {
    parts.push(
      `<polygon points="${sleevePolygon(s, long)}" fill="${d.colors.sleeves}"/>`,
    )
  }
  // torso with clipped panel pattern
  parts.push(`<clipPath id="torso-${side}"><path d="${torso}"/></clipPath>`)
  parts.push(`<g clip-path="url(#torso-${side})">`)
  parts.push(`<rect x="${panelX}" y="${panelY}" width="${panelW}" height="${panelH}" fill="${d.colors.primary}"/>`)
  parts.push(
    `<g transform="translate(${panelX} ${panelY}) scale(${panelW / 1024} ${panelH / 1160})">${patternShapes(d)}</g>`,
  )
  // hem
  parts.push(`<rect x="${fx(-0.6)}" y="${fy(-0.83)}" width="${1.2 * S}" height="14" fill="${d.colors.trim}"/>`)
  parts.push('</g>')
  parts.push(`<path d="${torso}" fill="none" stroke="rgba(0,0,0,0.18)" stroke-width="2"/>`)
  // collar
  if (d.collar === 'vneck') {
    parts.push(
      `<polyline points="${fx(-0.185)},${fy(0.78)} ${fx(0)},${fy(0.42)} ${fx(0.185)},${fy(0.78)}" fill="none" stroke="${d.colors.trim}" stroke-width="13" stroke-linecap="round"/>`,
    )
  } else {
    parts.push(
      `<path d="M ${fx(-0.185)} ${fy(0.775)} Q ${fx(0)} ${fy(0.7)} ${fx(0.185)} ${fy(0.775)}" fill="none" stroke="${d.colors.trim}" stroke-width="${d.collar === 'mock' ? 24 : 15}" stroke-linecap="round"/>`,
    )
    if (d.collar === 'polo') {
      parts.push(
        `<rect x="${fx(0) - 7}" y="${fy(0.74)}" width="14" height="${fy(0.44) - fy(0.74)}" fill="${d.colors.trim}"/>`,
      )
    }
  }
  // texts
  const cxT = fx(0)
  if (side === 'front' && p.tagline) {
    parts.push(
      `<text x="${cxT}" y="${fy(0.28)}" text-anchor="middle" font-family="Oswald, Inter, sans-serif" font-weight="600" font-size="30" letter-spacing="5" fill="${p.color}">${escapeXml(p.tagline)}</text>`,
    )
  }
  if (side === 'back' && p.enabled) {
    const dxT = p.offsetX * 130
    const dyT = p.offsetY * 95
    if (p.playerName) {
      parts.push(
        `<text x="${cxT + dxT}" y="${fy(0.52) + dyT}" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="900" font-size="${64 * p.nameScale}" letter-spacing="3" fill="${p.color}">${escapeXml(p.playerName)}</text>`,
      )
    }
    parts.push(
      `<text x="${cxT + dxT}" y="${fy(-0.18) + dyT}" text-anchor="middle" font-family="Archivo, Arial, sans-serif" font-weight="900" font-size="${290 * p.numberScale}" fill="${p.color}">${p.number}</text>`,
    )
  }
  parts.push(
    `<text x="${cxT}" y="${H - 24}" text-anchor="middle" font-family="Inter, sans-serif" font-size="20" letter-spacing="4" fill="#8a8578">${side.toUpperCase()}</text>`,
  )
  parts.push('</g>')
  return parts.join('')
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildSvg(state: SharedDesignV1): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W * 2}" height="${H}" viewBox="0 0 ${W * 2} ${H}">
<title>${escapeXml(state.name)} — KitStudio design (editable vector)</title>
<rect width="${W * 2}" height="${H}" fill="#101010"/>
${sideGroup(state, 'front', 0)}
${sideGroup(state, 'back', W)}
</svg>`
}

export function exportSvg(state: SharedDesignV1) {
  const blob = new Blob([buildSvg(state)], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kit'}-design.svg`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

/** Download the design as an editable KitStudio file (JSON state). */
export function exportDesignFile(state: SharedDesignV1) {
  const blob = new Blob([JSON.stringify(state, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kit'}.kitstudio.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
