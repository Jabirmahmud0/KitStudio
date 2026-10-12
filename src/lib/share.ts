/**
 * KitStudio — versioned share links (PRD §7.2).
 * Payload is validated and size-capped on decode. Uploaded assets are
 * never embedded. Unknown versions attempt migration; if that is
 * impossible the caller shows a graceful error and loads defaults.
 * Validation is state-identical, not pixel-identical (PRD v1.3).
 */
import { HERO_MODEL_ID, MODELS } from './presets'
import {
  COLLAR_STYLES,
  FABRICS,
  PATTERNS,
  SIZES,
  SLEEVE_STYLES,
  type RosterEntry,
  type SharedDesignV1,
  type Size,
} from './types'

const clampNum = (v: unknown, min: number, max: number, fallback: number) =>
  typeof v === 'number' && Number.isFinite(v)
    ? Math.max(min, Math.min(max, v))
    : fallback

export const MAX_SHARE_PAYLOAD_CHARS = 12000
export const MAX_ROSTER = 25
export const MAX_NAME_CHARS = 14

const HEX_RE = /^#[0-9a-fA-F]{6}$/
const PLAYER_NAME_RE = /^[A-Za-z -]*$/

export function isValidPlayerName(name: string): boolean {
  return name.length <= MAX_NAME_CHARS && PLAYER_NAME_RE.test(name)
}

function b64urlEncode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''
  bytes.forEach((b) => (bin += String.fromCharCode(b)))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function b64urlDecode(encoded: string): string {
  const b64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
  const bin = atob(padded)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

export function encodeShare(state: SharedDesignV1): string {
  return b64urlEncode(JSON.stringify(state))
}

export function buildShareUrl(
  state: SharedDesignV1,
  origin: string,
  route: '/studio' | '/approval' = '/studio',
): string {
  return `${origin}${route}?d=${encodeShare(state)}`
}

function asHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_RE.test(value) ? value : fallback
}

function sanitizeRoster(value: unknown): RosterEntry[] {
  if (!Array.isArray(value)) return []
  const out: RosterEntry[] = []
  for (const row of value.slice(0, MAX_ROSTER)) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const name = typeof r.name === 'string' ? r.name.slice(0, 40) : ''
    const number =
      typeof r.number === 'number' && Number.isFinite(r.number)
        ? Math.max(0, Math.min(99, Math.floor(r.number)))
        : 0
    const size = SIZES.includes(r.size as Size) ? (r.size as Size) : 'M'
    out.push({ name, number, size })
  }
  return out
}

export type DecodeResult =
  | { ok: true; state: SharedDesignV1 }
  | { ok: false; error: string }

/** Validate + normalize an untrusted payload into a safe SharedDesignV1. */
export function sanitizeSharedDesign(raw: unknown): SharedDesignV1 | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  if (o.v !== 1) return null
  const d = (o.design ?? {}) as Record<string, unknown>
  const dc = (d.colors ?? {}) as Record<string, unknown>
  const p = (o.print ?? {}) as Record<string, unknown>
  const pattern = PATTERNS.includes(d.pattern as never)
    ? (d.pattern as SharedDesignV1['design']['pattern'])
    : 'solid'
  const rawName = typeof p.playerName === 'string' ? p.playerName : ''
  return {
    v: 1,
    name:
      typeof o.name === 'string' && o.name.trim()
        ? o.name.slice(0, 60)
        : 'Untitled Kit',
    presetId: typeof o.presetId === 'string' ? o.presetId : undefined,
    design: {
      modelId:
        typeof d.modelId === 'string' &&
        MODELS.some((m) => m.id === d.modelId)
          ? d.modelId
          : HERO_MODEL_ID,
      pattern,
      colors: {
        primary: asHex(dc.primary, '#101010'),
        secondary: asHex(dc.secondary, '#C8FA45'),
        sleeves: asHex(dc.sleeves, '#101010'),
        trim: asHex(dc.trim, '#C8FA45'),
      },
      finish: d.finish === 'satin' ? 'satin' : 'matte',
      collar: COLLAR_STYLES.includes(d.collar as never)
        ? (d.collar as SharedDesignV1['design']['collar'])
        : 'crew',
      sleeveStyle: SLEEVE_STYLES.includes(d.sleeveStyle as never)
        ? (d.sleeveStyle as SharedDesignV1['design']['sleeveStyle'])
        : 'plain',
      fabric: FABRICS.includes(d.fabric as never)
        ? (d.fabric as SharedDesignV1['design']['fabric'])
        : 'smooth',
    },
    print: {
      enabled: p.enabled !== false,
      playerName: isValidPlayerName(rawName)
        ? rawName.toUpperCase()
        : rawName.toUpperCase().replace(/[^A-Z -]/g, '').slice(0, MAX_NAME_CHARS),
      number:
        typeof p.number === 'number' && Number.isFinite(p.number)
          ? Math.max(0, Math.min(99, Math.floor(p.number)))
          : 10,
      font: p.font === 'slim' ? 'slim' : 'block',
      color: asHex(p.color, '#F5F3EC'),
      style:
        p.style === 'outline' || p.style === 'shadow' ? p.style : 'solid',
      nameScale: clampNum(p.nameScale, 0.7, 1.4, 1),
      numberScale: clampNum(p.numberScale, 0.7, 1.4, 1),
      offsetX: clampNum(p.offsetX, -1, 1, 0),
      offsetY: clampNum(p.offsetY, -1, 1, 0),
      tagline:
        typeof p.tagline === 'string'
          ? p.tagline.toUpperCase().replace(/[^A-Z0-9 .&-]/g, '').slice(0, 24)
          : '',
    },
    roster: sanitizeRoster(o.roster),
  }
}

export function decodeShare(encoded: string): DecodeResult {
  if (!encoded) return { ok: false, error: 'This share link is empty.' }
  if (encoded.length > MAX_SHARE_PAYLOAD_CHARS) {
    return {
      ok: false,
      error: 'This share link is too large to load. A default design was loaded instead.',
    }
  }
  try {
    const parsed: unknown = JSON.parse(b64urlDecode(encoded))
    const version =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>).v
        : undefined
    if (version !== 1) {
      return {
        ok: false,
        error:
          'This share link uses a version KitStudio cannot open. A default design was loaded instead.',
      }
    }
    const state = sanitizeSharedDesign(parsed)
    if (!state) {
      return {
        ok: false,
        error: 'This share link could not be read. A default design was loaded instead.',
      }
    }
    return { ok: true, state }
  } catch {
    return {
      ok: false,
      error: 'This share link looks corrupted. A default design was loaded instead.',
    }
  }
}

/** Duplicate squad numbers in a roster (PRD §5.7 — warn, never hard-block). */
export function duplicateNumbers(roster: RosterEntry[]): Set<number> {
  const seen = new Map<number, number>()
  for (const r of roster) seen.set(r.number, (seen.get(r.number) ?? 0) + 1)
  return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([n]) => n))
}
