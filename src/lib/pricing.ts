/**
 * KitStudio — illustrative pricing (PRD §8).
 * All prices live in this one versioned config object — never scattered
 * through the UI. Label shown in-app:
 * "Illustrative pricing for visualization only — final pricing depends
 * on the supplier."
 */
import { modelById } from './presets'
import type { SharedDesignV1 } from './types'

export const PRICING_VERSION = 1

export interface PriceTier {
  min: number
  max: number
  base: number
}

export const PRICING = {
  version: PRICING_VERSION,
  currency: 'BDT',
  symbol: '৳',
  disclaimer:
    'Illustrative pricing for visualization only — final pricing depends on the supplier.',
  tiers: [
    { min: 1, max: 4, base: 850 },
    { min: 5, max: 9, base: 800 },
    { min: 10, max: 19, base: 750 },
    { min: 20, max: 25, base: 700 },
  ] as PriceTier[],
  printAddon: 150, // name & number print, per kit
  sponsorAddon: 100, // fast-follow
  poloCollarAddon: 50, // fast-follow
}

export function tierFor(quantity: number): PriceTier {
  const q = Math.max(1, Math.min(25, Math.floor(quantity) || 1))
  return (
    PRICING.tiers.find((t) => q >= t.min && q <= t.max) ?? PRICING.tiers[0]
  )
}

/** Quantity used for pricing: roster size when a roster exists, else 1. */
export function quantityFor(state: SharedDesignV1): number {
  return state.roster.length > 0 ? state.roster.length : 1
}

export interface Quote {
  quantity: number
  tier: PriceTier
  basePerKit: number
  modelAddonPerKit: number
  collarAddonPerKit: number
  printAddonPerKit: number
  perKit: number
  total: number
  /** Saving per kit vs the 1–4 tier base price. */
  savingPerKit: number
  tierMessage: string
}

export function quote(state: SharedDesignV1): Quote {
  const quantity = quantityFor(state)
  const tier = tierFor(quantity)
  const printAddonPerKit = state.print.enabled ? PRICING.printAddon : 0
  const modelAddonPerKit = modelById(state.design.modelId).priceDelta
  const collarAddonPerKit =
    state.design.collar === 'polo' ? PRICING.poloCollarAddon : 0
  const perKit = tier.base + modelAddonPerKit + collarAddonPerKit + printAddonPerKit
  const topBase = PRICING.tiers[0].base
  const savingPerKit = topBase - tier.base
  const tierMessage =
    savingPerKit > 0
      ? `${tier.min}+ kits: ${PRICING.symbol}${tier.base} each — you save ${PRICING.symbol}${savingPerKit} per kit.`
      : `Add ${PRICING.tiers[1].min - quantity} more kit${quantity === 4 ? '' : 's'} to unlock ${PRICING.symbol}${PRICING.tiers[1].base} per kit.`
  return {
    quantity,
    tier,
    basePerKit: tier.base,
    modelAddonPerKit,
    collarAddonPerKit,
    printAddonPerKit,
    perKit,
    total: perKit * quantity,
    savingPerKit,
    tierMessage,
  }
}

export function formatBDT(n: number): string {
  return `${PRICING.symbol}${n.toLocaleString('en-IN')}`
}
