import { describe, expect, it } from 'vitest'
import { quote, tierFor } from './pricing'
import { MODELS, PRESETS } from './presets'
import { buildSvg } from './svgExport'
import {
  buildShareUrl,
  decodeShare,
  duplicateNumbers,
  encodeShare,
  isValidPlayerName,
  sanitizeSharedDesign,
} from './share'
import { defaultState, useKitStore } from './store'
import { PATTERNS, type SharedDesignV1 } from './types'

function withRoster(n: number, printEnabled = true): SharedDesignV1 {
  const s = defaultState()
  s.print.enabled = printEnabled
  s.roster = Array.from({ length: n }, (_, i) => ({
    name: `PLAYER ${i + 1}`,
    number: i + 1,
    size: 'M' as const,
  }))
  return s
}

describe('preset fit selection', () => {
  it('keeps each selected fit across every preset and preserves print and roster', () => {
    for (const model of MODELS) {
      const initial = withRoster(2)
      initial.design.modelId = model.id
      useKitStore.getState().loadState(initial)
      for (const preset of PRESETS) {
        useKitStore.getState().applyPreset(preset.id)
        const state = useKitStore.getState().state
        expect(state.design).toEqual({ ...preset.design, modelId: model.id })
        expect(state.print).toEqual(initial.print)
        expect(state.roster).toEqual(initial.roster)
        expect(state.name).toBe(initial.name)
      }
    }
  })

  it('supports undo/redo and loads the advertised fit when opening a preset link', () => {
    const initial = withRoster(0)
    initial.design.modelId = 'pro-long'
    useKitStore.getState().loadState(initial)
    useKitStore.getState().applyPreset('forest-rovers')
    const applied = structuredClone(useKitStore.getState().state)
    useKitStore.getState().undo()
    expect(useKitStore.getState().state).toEqual(initial)
    useKitStore.getState().redo()
    expect(useKitStore.getState().state).toEqual(applied)
    useKitStore.getState().applyPreset('sahara-sc', { preserveModel: false })
    expect(useKitStore.getState().state.design.modelId).toBe('heritage-loose')
    useKitStore.getState().loadState(defaultState())
  })
})

describe('pricing tiers (PRD §8)', () => {
  it('applies the right base at tier boundaries 1, 5, 10, 20', () => {
    expect(tierFor(1).base).toBe(850)
    expect(tierFor(4).base).toBe(850)
    expect(tierFor(5).base).toBe(800)
    expect(tierFor(9).base).toBe(800)
    expect(tierFor(10).base).toBe(750)
    expect(tierFor(19).base).toBe(750)
    expect(tierFor(20).base).toBe(700)
    expect(tierFor(25).base).toBe(700)
  })

  it('adds the flat print add-on per kit and totals the roster', () => {
    const q = quote(withRoster(10))
    expect(q.basePerKit).toBe(750)
    expect(q.printAddonPerKit).toBe(150)
    expect(q.perKit).toBe(900)
    expect(q.total).toBe(9000)
    expect(q.savingPerKit).toBe(100)
  })

  it('prices a single kit when there is no roster', () => {
    const q = quote(withRoster(0, false))
    expect(q.quantity).toBe(1)
    expect(q.perKit).toBe(850)
    expect(q.total).toBe(850)
  })
})

describe('share links (PRD §7.2)', () => {
  it('round-trips the full design state including the roster', () => {
    const s = withRoster(3)
    s.name = 'Final Kit — Home'
    s.print.playerName = 'JABIR'
    s.print.number = 99
    const decoded = decodeShare(encodeShare(s))
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.state).toEqual(s)
    }
  })

  it('builds a studio URL carrying the payload', () => {
    const url = buildShareUrl(defaultState(), 'https://example.com')
    expect(url.startsWith('https://example.com/studio?d=')).toBe(true)
  })

  it('rejects garbage, wrong versions and oversized payloads gracefully', () => {
    expect(decodeShare('!!!not-base64!!!').ok).toBe(false)
    expect(decodeShare('').ok).toBe(false)
    const wrongVersion = encodeShare({ ...defaultState(), v: 2 } as never)
    expect(decodeShare(wrongVersion).ok).toBe(false)
    expect(decodeShare('A'.repeat(12001)).ok).toBe(false)
  })

  it('never embeds uploaded assets — schema has no asset fields', () => {
    const decoded = decodeShare(encodeShare(defaultState()))
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(Object.keys(decoded.state).sort()).toEqual(
        ['design', 'name', 'presetId', 'print', 'roster', 'v'].sort(),
      )
    }
  })
})

describe('catalog expansion — models, patterns, presets', () => {
  it('ships three models including a full-sleeve model', () => {
    expect(MODELS.map((m) => m.id)).toEqual([
      'pro-slim',
      'heritage-loose',
      'pro-long',
    ])
    expect(MODELS.find((m) => m.id === 'pro-long')?.sleeves).toBe('long')
    expect(MODELS.find((m) => m.id === 'pro-long')?.priceDelta).toBe(75)
  })

  it('ships fourteen patterns and fifteen presets, all referencing real models', () => {
    expect(PATTERNS).toHaveLength(14)
    expect(PRESETS).toHaveLength(15)
    for (const p of PRESETS) {
      expect(MODELS.some((m) => m.id === p.design.modelId)).toBe(true)
      expect(PATTERNS).toContain(p.design.pattern)
    }
  })

  it('every preset carries valid collar, sleeve and fabric styles', () => {
    for (const p of PRESETS) {
      expect(['crew', 'vneck', 'polo', 'mock']).toContain(p.design.collar)
      expect(['plain', 'band', 'double-band', 'fade']).toContain(p.design.sleeveStyle)
      expect(['smooth', 'mesh', 'pique', 'ribbed']).toContain(p.design.fabric)
    }
  })

  it('charges the polo collar add-on per kit', () => {
    const s = withRoster(0, false)
    s.design.collar = 'polo'
    const q = quote(s)
    expect(q.collarAddonPerKit).toBe(50)
    expect(q.perKit).toBe(850 + 50)
  })

  it('round-trips print position, scale, style and tagline', () => {
    const s = withRoster(1)
    s.print.offsetX = 0.5
    s.print.offsetY = -0.25
    s.print.nameScale = 1.2
    s.print.numberScale = 0.8
    s.print.style = 'outline'
    s.print.tagline = 'DHAKA WARRIORS'
    const decoded = decodeShare(encodeShare(s))
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.state.print.offsetX).toBe(0.5)
      expect(decoded.state.print.style).toBe('outline')
      expect(decoded.state.print.tagline).toBe('DHAKA WARRIORS')
    }
  })

  it('clamps out-of-range print fields in shared links', () => {
    const s = defaultState()
    const cleaned = sanitizeSharedDesign({
      ...s,
      print: { ...s.print, offsetX: 42, nameScale: 9, tagline: 'bad<script>' },
    })
    expect(cleaned?.print.offsetX).toBe(1)
    expect(cleaned?.print.nameScale).toBe(1.4)
    expect(cleaned?.print.tagline).not.toContain('<')
  })

  it('charges the full-sleeve model delta per kit', () => {
    const s = withRoster(0, false)
    s.design.modelId = 'pro-long'
    const q = quote(s)
    expect(q.modelAddonPerKit).toBe(75)
    expect(q.perKit).toBe(850 + 75)
    expect(q.total).toBe(925)
  })

  it('round-trips a full-sleeve design with a new pattern', () => {
    const s = withRoster(2)
    s.design.modelId = 'pro-long'
    s.design.pattern = 'chevron'
    const decoded = decodeShare(encodeShare(s))
    expect(decoded.ok).toBe(true)
    if (decoded.ok) {
      expect(decoded.state.design.modelId).toBe('pro-long')
      expect(decoded.state.design.pattern).toBe('chevron')
    }
  })

  it('falls back to the hero model for unknown model ids in links', () => {
    const s = defaultState()
    const cleaned = sanitizeSharedDesign({
      ...s,
      design: { ...s.design, modelId: 'does-not-exist' },
    })
    expect(cleaned?.design.modelId).toBe('pro-slim')
  })
})

describe('illustrator SVG export', () => {
  it('builds an editable SVG with vector shapes and live text', () => {
    const s = withRoster(0)
    s.design.pattern = 'chevron'
    s.print.tagline = 'GO KINGS'
    const svg = buildSvg(s)
    expect(svg.startsWith('<?xml')).toBe(true)
    expect(svg).toContain('<svg')
    expect(svg).toContain('GO KINGS')
    expect(svg).toContain('JABIR')
    expect(svg).toContain('FRONT')
    expect(svg).toContain('BACK')
  })
})

describe('roster + print validation (PRD §5.6, §5.7)', () => {
  it('flags duplicate numbers without removing them', () => {
    const roster = [
      { name: 'A', number: 10, size: 'M' as const },
      { name: 'B', number: 10, size: 'L' as const },
      { name: 'C', number: 7, size: 'S' as const },
    ]
    expect([...duplicateNumbers(roster)]).toEqual([10])
  })

  it('validates player names: letters, spaces, hyphens, max 14', () => {
    expect(isValidPlayerName('JEAN-LUC')).toBe(true)
    expect(isValidPlayerName('VAN DER SAR')).toBe(true)
    expect(isValidPlayerName('JABIR7')).toBe(false)
    expect(isValidPlayerName('A'.repeat(15))).toBe(false)
    expect(isValidPlayerName('')).toBe(true)
  })
})
