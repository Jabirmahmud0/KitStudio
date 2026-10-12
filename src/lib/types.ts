/**
 * KitStudio — core types.
 * The design state mirrors the versioned share schema in PRD §7.2 exactly,
 * so anything held in the store can be serialized into a share link.
 */

export const PATTERNS = [
  'solid',
  'stripes',
  'hoops',
  'sash',
  'gradient',
  'halves',
  'quarters',
  'chevron',
  'pinstripes',
  'yoke',
  'bias',
  'wave',
  'burst',
  'grid',
] as const
export type Pattern = (typeof PATTERNS)[number]

export const PATTERN_LABELS: Record<Pattern, string> = {
  solid: 'Solid',
  stripes: 'Vertical Stripes',
  hoops: 'Hoops',
  sash: 'Diagonal Sash',
  gradient: 'Gradient Fade',
  halves: 'Halves',
  quarters: 'Quarters',
  chevron: 'Chevron',
  pinstripes: 'Pinstripes',
  yoke: 'Chest Yoke',
  bias: 'Bias Stripes',
  wave: 'Wave Hoops',
  burst: 'Sunburst',
  grid: 'Windowpane Grid',
}

export type Finish = 'matte' | 'satin'
export type PrintFont = 'block' | 'slim'
export type PrintStyle = 'solid' | 'outline' | 'shadow'

export const COLLAR_STYLES = ['crew', 'vneck', 'polo', 'mock'] as const
export type CollarStyle = (typeof COLLAR_STYLES)[number]
export const COLLAR_LABELS: Record<CollarStyle, string> = {
  crew: 'Crew Neck',
  vneck: 'V-Neck',
  polo: 'Polo Collar',
  mock: 'Mock Neck',
}

export const SLEEVE_STYLES = ['plain', 'band', 'double-band', 'fade'] as const
export type SleeveStyle = (typeof SLEEVE_STYLES)[number]
export const SLEEVE_LABELS: Record<SleeveStyle, string> = {
  plain: 'Plain Sleeves',
  band: 'Single Band',
  'double-band': 'Double Band',
  fade: 'Fade to Pattern',
}

export const FABRICS = ['smooth', 'mesh', 'pique', 'ribbed'] as const
export type Fabric = (typeof FABRICS)[number]
export const FABRIC_LABELS: Record<Fabric, string> = {
  smooth: 'Smooth Pro',
  mesh: 'Aero Mesh',
  pique: 'Classic Piqué',
  ribbed: 'Ribbed Tech',
}
export type Size = 'S' | 'M' | 'L' | 'XL' | 'XXL'
export const SIZES: Size[] = ['S', 'M', 'L', 'XL', 'XXL']

export type ColorZone = 'primary' | 'secondary' | 'sleeves' | 'trim'
export const COLOR_ZONES: { id: ColorZone; label: string }[] = [
  { id: 'primary', label: 'Primary · Body' },
  { id: 'secondary', label: 'Secondary · Pattern' },
  { id: 'sleeves', label: 'Sleeves' },
  { id: 'trim', label: 'Trim · Collar & Cuffs' },
]

export interface KitColors {
  primary: string
  secondary: string
  sleeves: string
  trim: string
}

export interface KitDesign {
  modelId: string
  pattern: Pattern
  colors: KitColors
  finish: Finish
  collar: CollarStyle
  sleeveStyle: SleeveStyle
  fabric: Fabric
}

export interface KitPrint {
  enabled: boolean
  playerName: string
  number: number
  font: PrintFont
  color: string
  style: PrintStyle
  /** 0.7–1.4 multipliers — the print is repositionable/resizable. */
  nameScale: number
  numberScale: number
  /** −1…1 offsets from the standard print position. */
  offsetX: number
  offsetY: number
  /** Sponsor-style text across the front chest ('' = none). */
  tagline: string
}

export interface RosterEntry {
  name: string
  number: number
  size: Size
}

/** Versioned share payload — PRD §7.2 (SharedDesignV1). */
export interface SharedDesignV1 {
  v: 1
  name: string
  presetId?: string
  design: KitDesign
  print: KitPrint
  roster: RosterEntry[]
}

export interface SavedDesign {
  id: string
  savedAt: number
  state: SharedDesignV1
}
