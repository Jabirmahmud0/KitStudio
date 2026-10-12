export interface NameGlyph {
  text: string
  x: number
  y: number
  angle: number
  width: number
}

/** Measured tracking on a shallow arc, including room for print outlines. */
export function layoutPlayerName(
  text: string,
  requestedFontPx: number,
  maxWidth: number,
  radius: number,
  measure: (glyph: string, fontPx: number) => number,
): { fontPx: number; glyphs: NameGlyph[]; bottom: number } {
  const characters = Array.from(text.trim().toUpperCase())
  if (!characters.length) return { fontPx: requestedFontPx, glyphs: [], bottom: 0 }
  let fontPx = requestedFontPx
  const cellWidths = (size: number) => characters.map(glyph => measure(glyph, size) + size * 0.24)
  let widths = cellWidths(fontPx)
  let total = widths.reduce((sum, width) => sum + width, 0)
  if (total > maxWidth) {
    fontPx *= maxWidth / total
    widths = cellWidths(fontPx)
    total = widths.reduce((sum, width) => sum + width, 0)
  }
  let cursor = -total / 2
  const glyphs = characters.map((text, i) => {
    const angle = (cursor + widths[i] / 2) / radius
    cursor += widths[i]
    return { text, angle, x: radius * Math.sin(angle), y: radius * (1 - Math.cos(angle)), width: widths[i] - fontPx * 0.24 }
  })
  return { fontPx, glyphs, bottom: Math.max(...glyphs.map(g => g.y)) + fontPx * 0.65 }
}
