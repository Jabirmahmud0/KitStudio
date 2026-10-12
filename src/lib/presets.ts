/**
 * KitStudio — catalog (PRD §3.1, §5.3 + fast-follow expansion).
 * Three models, ten patterns, ten presets. The architecture is
 * catalog-driven, so content grows as data, not code. All models
 * share one sculpted base garment; fit variants are derived from
 * it in lib/modelVariants.ts (the semantic adapter in
 * lib/modelZones.ts is UV-based, so zones survive every variant).
 */
import type { CollarStyle, Fabric, KitDesign, Pattern, SleeveStyle } from './types'

export const HERO_MODEL_ID = 'pro-slim'
export const LOOSE_MODEL_ID = 'heritage-loose'
export const LONG_MODEL_ID = 'pro-long'

export interface ModelInfo {
  id: string
  name: string
  description: string
  sleeves: 'short' | 'long'
  /** Illustrative per-kit price delta vs the base model, BDT. */
  priceDelta: number
}

/** Semantic model contract (PRD §6.3). */
export const MODELS: ModelInfo[] = [
  {
    id: HERO_MODEL_ID,
    name: 'Pro Slim',
    description: 'Modern slim-fit match jersey, short sleeves.',
    sleeves: 'short',
    priceDelta: 0,
  },
  {
    id: LOOSE_MODEL_ID,
    name: 'Heritage Loose',
    description: 'Relaxed boxy fit with a longer drape, short sleeves.',
    sleeves: 'short',
    priceDelta: 0,
  },
  {
    id: LONG_MODEL_ID,
    name: 'Pro Long Sleeve',
    description: 'Slim fit with full-length sleeves and ribbed wrists.',
    sleeves: 'long',
    priceDelta: 75,
  },
]

export function modelById(id?: string): ModelInfo {
  return MODELS.find((m) => m.id === id) ?? MODELS[0]
}

/** Curated swatches — strictly no blue tones (PRD §4.1, §5.5). */
export const SWATCHES: { name: string; hex: string }[] = [
  { name: 'Volt', hex: '#C8FA45' },
  { name: 'Ember', hex: '#FF5A1F' },
  { name: 'Crimson', hex: '#C8102E' },
  { name: 'Maroon', hex: '#6E1423' },
  { name: 'Forest', hex: '#1E5631' },
  { name: 'Pitch Black', hex: '#101010' },
  { name: 'Bone', hex: '#F5F3EC' },
  { name: 'Sand', hex: '#D9C7A7' },
  { name: 'Gold', hex: '#E3A008' },
  { name: 'Charcoal', hex: '#2B2B28' },
  { name: 'Wine', hex: '#722F37' },
  { name: 'Olive', hex: '#5B6236' },
]

export const PRINT_COLORS: { name: string; hex: string }[] = [
  { name: 'Bone', hex: '#F5F3EC' },
  { name: 'Ink', hex: '#101010' },
  { name: 'Volt', hex: '#C8FA45' },
  { name: 'Gold', hex: '#E3A008' },
  { name: 'Ember', hex: '#FF5A1F' },
]

export interface Preset {
  id: string
  name: string
  description: string
  design: KitDesign
}

interface DesignOpts {
  collar?: CollarStyle
  sleeveStyle?: SleeveStyle
  fabric?: Fabric
}

function design(
  pattern: Pattern,
  primary: string,
  secondary: string,
  sleeves: string,
  trim: string,
  finish: 'matte' | 'satin' = 'matte',
  modelId: string = HERO_MODEL_ID,
  opts: DesignOpts = {},
): KitDesign {
  return {
    modelId,
    pattern,
    colors: { primary, secondary, sleeves, trim },
    finish,
    collar: opts.collar ?? 'crew',
    sleeveStyle: opts.sleeveStyle ?? 'plain',
    fabric: opts.fabric ?? 'smooth',
  }
}

/** Fifteen presets (PRD §5.3 + expansions) — design fields only, no print/roster. */
export const PRESETS: Preset[] = [
  {
    id: 'volt-fc',
    name: 'Volt FC',
    description: 'Ink body with Volt vertical stripes.',
    design: design('stripes', '#101010', '#C8FA45', '#101010', '#C8FA45'),
  },
  {
    id: 'ember-united',
    name: 'Ember United',
    description: 'Ember sash on Bone.',
    design: design('sash', '#F5F3EC', '#FF5A1F', '#F5F3EC', '#101010'),
  },
  {
    id: 'mono-athletic',
    name: 'Mono Athletic',
    description: 'Charcoal solid with Bone trim.',
    design: design('solid', '#2B2B28', '#2B2B28', '#2B2B28', '#F5F3EC'),
  },
  {
    id: 'forest-rovers',
    name: 'Forest Rovers',
    description: 'Forest hoops with Gold trim.',
    design: design('hoops', '#1E5631', '#F5F3EC', '#1E5631', '#E3A008', 'satin'),
  },
  {
    id: 'crimson-city',
    name: 'Crimson City',
    description: 'Crimson and Bone vertical stripes.',
    design: design('stripes', '#C8102E', '#F5F3EC', '#C8102E', '#F5F3EC'),
  },
  {
    id: 'sahara-sc',
    name: 'Sahara SC',
    description: 'Sand and Ember halves on the loose fit.',
    design: design('halves', '#D9C7A7', '#FF5A1F', '#D9C7A7', '#101010', 'matte', LOOSE_MODEL_ID),
  },
  {
    id: 'maroon-royals',
    name: 'Maroon Royals',
    description: 'Gold chevrons on deep Maroon, satin.',
    design: design('chevron', '#6E1423', '#E3A008', '#6E1423', '#E3A008', 'satin'),
  },
  {
    id: 'olive-athletic',
    name: 'Olive Athletic',
    description: 'Bone chest yoke on Olive, loose fit.',
    design: design('yoke', '#5B6236', '#F5F3EC', '#5B6236', '#F5F3EC', 'matte', LOOSE_MODEL_ID),
  },
  {
    id: 'ember-line',
    name: 'Ember Line',
    description: 'Ember pinstripes on Bone, full sleeves.',
    design: design('pinstripes', '#F5F3EC', '#FF5A1F', '#F5F3EC', '#101010', 'matte', LONG_MODEL_ID),
  },
  {
    id: 'carbon-volt',
    name: 'Carbon Volt',
    description: 'Volt quarters on Charcoal, full sleeves.',
    design: design('quarters', '#2B2B28', '#C8FA45', '#2B2B28', '#C8FA45', 'matte', LONG_MODEL_ID),
  },
  {
    id: 'solar-burst',
    name: 'Solar Burst',
    description: 'Ember sunburst on Ink, aero mesh.',
    design: design('burst', '#101010', '#FF5A1F', '#101010', '#FF5A1F', 'matte', HERO_MODEL_ID, { fabric: 'mesh', sleeveStyle: 'band' }),
  },
  {
    id: 'wave-riders',
    name: 'Wave Riders',
    description: 'Bone waves on Forest, V-neck.',
    design: design('wave', '#1E5631', '#F5F3EC', '#1E5631', '#F5F3EC', 'matte', HERO_MODEL_ID, { collar: 'vneck' }),
  },
  {
    id: 'metro-grid',
    name: 'Metro Grid',
    description: 'Sand windowpane on Charcoal, piqué.',
    design: design('grid', '#2B2B28', '#D9C7A7', '#2B2B28', '#D9C7A7', 'matte', LOOSE_MODEL_ID, { fabric: 'pique' }),
  },
  {
    id: 'bias-kings',
    name: 'Bias Kings',
    description: 'Crimson bias stripes, double-band sleeves, full length.',
    design: design('bias', '#F5F3EC', '#C8102E', '#F5F3EC', '#C8102E', 'satin', LONG_MODEL_ID, { sleeveStyle: 'double-band' }),
  },
  {
    id: 'polo-classic',
    name: 'Polo Classic',
    description: 'Bone polo collar kit with Wine trim, ribbed tech fabric.',
    design: design('solid', '#F5F3EC', '#F5F3EC', '#F5F3EC', '#722F37', 'matte', HERO_MODEL_ID, { collar: 'polo', fabric: 'ribbed' }),
  },
]

export function presetById(id?: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id)
}
