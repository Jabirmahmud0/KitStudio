import { describe, expect, it } from 'vitest'
import { layoutPlayerName } from './printLayout'

// Deliberately varied advances reproduce the narrow J/I and wide A/B/W
// combination that the previous fixed-angle spacing overlapped.
const measure = (glyph: string, size: number) => size * ({ J: 0.5, I: 0.3, W: 1.05, M: 0.95, ' ': 0.3 }[glyph] ?? 0.78)

describe('player name layout', () => {
  it.each(['JABIR', 'WILLIAMS', 'VAN DER SAR', 'WWWWWWWWWWWWWW'])('separates every glyph in %s at every supported scale', text => {
    for (const scale of [0.7, 1, 1.4]) {
      const layout = layoutPlayerName(text, 110 * scale, 530, 570, measure)
      expect(layout.glyphs.map(g => g.text).join('')).toBe(text)
      for (let i = 1; i < layout.glyphs.length; i++) {
        const a = layout.glyphs[i - 1], b = layout.glyphs[i]
        // Horizontal ink boxes stay apart even before allowing rotation.
        expect(b.x - a.x).toBeGreaterThan((a.width + b.width) / 2 + layout.fontPx * 0.08)
      }
      for (const glyph of layout.glyphs) expect(Math.abs(glyph.x) + glyph.width / 2).toBeLessThan(265)
    }
  })

  it('centers a single glyph and handles blank names without invalid positions', () => {
    expect(layoutPlayerName('  ', 100, 500, 570, measure).glyphs).toEqual([])
    const single = layoutPlayerName('I', 100, 500, 570, measure)
    expect(single.glyphs[0].x).toBe(0)
    expect(single.glyphs[0].angle).toBe(0)
  })
})
