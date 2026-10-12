/**
 * Studio panels — Design / Print / Roster / Summary tabs (PRD §5.5–5.8)
 * plus the right-rail price card (§5.4).
 */
import { useMemo, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Camera,
  Check,
  Copy,
  Download,
  Eye,
  FileText,
  Plus,
  RotateCw,
  Save,
  Search,
  Trash2,
  Users,
} from 'lucide-react'
import { formatBDT, quote, PRICING } from '../lib/pricing'
import { PRINT_COLORS, SWATCHES, MODELS, PRESETS, modelById } from '../lib/presets'
import { buildShareUrl, duplicateNumbers, isValidPlayerName, MAX_NAME_CHARS, sanitizeSharedDesign } from '../lib/share'
import { downloadSnapshot } from '../lib/snapshot'
import { exportOrderSummary } from '../lib/exportSummary'
import { exportDesignFile, exportSvg } from '../lib/svgExport'
import { flatDataUrl } from '../lib/texture'
import { saveMyDesign, useKitStore, type LogoPlacement } from '../lib/store'
import {
  COLLAR_LABELS,
  COLLAR_STYLES,
  COLOR_ZONES,
  FABRIC_LABELS,
  FABRICS,
  PATTERN_LABELS,
  PATTERNS,
  SIZES,
  SLEEVE_LABELS,
  SLEEVE_STYLES,
  type Pattern,
  type RosterEntry,
  type Size,
} from '../lib/types'

/* ---------------------------------------------------------------- */

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[11px] font-medium tracking-[0.18em] text-warmgray uppercase">
      {children}
    </h3>
  )
}

function patternPreviewStyle(pattern: Pattern, primary: string, secondary: string): CSSProperties {
  switch (pattern) {
    case 'stripes':
      return { background: `repeating-linear-gradient(90deg, ${secondary} 0 9px, ${primary} 9px 18px)` }
    case 'hoops':
      return { background: `repeating-linear-gradient(0deg, ${secondary} 0 9px, ${primary} 9px 18px)` }
    case 'sash':
      return {
        background: `linear-gradient(118deg, ${primary} 0 38%, ${secondary} 38% 62%, ${primary} 62% 100%)`,
      }
    case 'gradient':
      return { background: `linear-gradient(180deg, ${primary} 20%, ${secondary} 100%)` }
    case 'halves':
      return { background: `linear-gradient(90deg, ${primary} 0 50%, ${secondary} 50% 100%)` }
    case 'quarters':
      return {
        background: `conic-gradient(from 0deg at 50% 50%, ${secondary} 0 25%, ${primary} 0 50%, ${secondary} 0 75%, ${primary} 0 100%)`,
      }
    case 'chevron':
      return { background: `repeating-linear-gradient(135deg, ${secondary} 0 7px, ${primary} 7px 14px)` }
    case 'pinstripes':
      return { background: `repeating-linear-gradient(90deg, ${secondary} 0 3px, ${primary} 3px 13px)` }
    case 'yoke':
      return { background: `linear-gradient(180deg, ${secondary} 0 32%, ${primary} 32% 100%)` }
    case 'bias':
      return { background: `repeating-linear-gradient(45deg, ${secondary} 0 8px, ${primary} 8px 16px)` }
    case 'wave':
      return { background: `repeating-linear-gradient(0deg, ${secondary} 0 6px, ${primary} 6px 15px)` }
    case 'burst':
      return {
        background: `conic-gradient(from -90deg at 50% 18%, ${secondary} 0 14deg, ${primary} 14deg 30deg, ${secondary} 30deg 44deg, ${primary} 44deg 60deg, ${secondary} 60deg 74deg, ${primary} 74deg 90deg, ${secondary} 90deg 104deg, ${primary} 104deg 120deg, ${secondary} 120deg 134deg, ${primary} 134deg 150deg, ${secondary} 150deg 164deg, ${primary} 164deg 180deg, ${secondary} 180deg 194deg, ${primary} 194deg 210deg, ${secondary} 210deg 224deg, ${primary} 224deg 240deg, ${secondary} 240deg 254deg, ${primary} 254deg 270deg, ${secondary} 270deg 284deg, ${primary} 284deg 300deg, ${secondary} 300deg 314deg, ${primary} 314deg 330deg, ${secondary} 330deg 344deg, ${primary} 344deg 360deg)`,
      }
    case 'grid':
      return {
        background: `repeating-linear-gradient(90deg, transparent 0 10px, ${secondary} 10px 12px), repeating-linear-gradient(0deg, ${primary} 0 12px, ${secondary} 12px 13px)`,
      }
    default:
      return { background: primary }
  }
}

/** Chip group for collar / sleeve / fabric style pickers. */
export function StyleChips<T extends string>({
  label,
  options,
  labels,
  value,
  onChange,
}: {
  label: string
  options: readonly T[]
  labels: Record<T, string>
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="space-y-2">
      <SectionLabel>{label}</SectionLabel>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            aria-pressed={value === o}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              value === o
                ? 'border-volt bg-volt text-ink'
                : 'border-smoke bg-carbon text-warmgray hover:border-warmgray hover:text-bone'
            }`}
          >
            {labels[o]}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Small labelled slider row used by the print/logo controls. */
export function SliderRow({
  label,
  value,
  min,
  max,
  step = 0.05,
  display,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  display: string
  onChange: (v: number) => void
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-xs font-medium text-bone">
        {label}
        <span className="font-mono text-[11px] text-warmgray">{display}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[#C8FA45]"
        aria-label={label}
      />
    </label>
  )
}

/** Screen-reader / text alternative describing the current design (§7.5). */
export function describeDesign(): string {
  const s = useKitStore.getState().state
  const c = s.design.colors
  return `Jersey design "${s.name}": ${modelById(s.design.modelId).name} model, ${PATTERN_LABELS[s.design.pattern]} pattern, primary ${c.primary}, secondary ${c.secondary}, sleeves ${c.sleeves}, trim ${c.trim}, ${s.design.finish} finish.${
    s.print.enabled
      ? ` Back print: ${s.print.playerName || 'no name'}, number ${s.print.number}.`
      : ' No back print.'
  } Roster: ${s.roster.length} players.`
}

/* ---------------------------------------------------------------- */
/* DESIGN TAB                                                          */
/* ---------------------------------------------------------------- */

export function DesignSection() {
  const state = useKitStore((s) => s.state)
  const setModel = useKitStore((s) => s.setModel)
  const applyPreset = useKitStore((s) => s.applyPreset)
  const [search, setSearch] = useState('')
  const { design } = state
  const previews = useMemo(() => PRESETS.map(p => ({
    ...p,
    preview: flatDataUrl('front', { ...p.design, modelId: design.modelId }, { ...state.print, enabled: false, tagline: '' }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [design.modelId])
  const visiblePresets = previews.filter(p => `${p.name} ${PATTERN_LABELS[p.design.pattern]}`.toLowerCase().includes(search.toLowerCase().trim()))

  return (
    <div className="studio-design space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-bone">Choose your fit</h3>
          <span className="text-[10px] text-warmgray">3 models</span>
        </div>
        <div className="space-y-2">
          {MODELS.map((m) => {
            const selected = design.modelId === m.id
            return (
              <button key={m.id} type="button" onClick={() => setModel(m.id)} aria-pressed={selected}
                className={`studio-fit-card flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${selected ? 'border-volt/60 bg-volt/[0.06]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}`}>
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${selected ? 'bg-volt/10 text-volt' : 'bg-white/5 text-bone/70'}`}>
                  <svg viewBox="0 0 48 48" width="31" height="31" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" aria-hidden="true">
                    <path d={m.sleeves === 'long' ? 'M17 7l-7 4-6 29 6 1 7-20v20h14V21l7 20 6-1-6-29-7-4c-3 4-11 4-14 0Z' : 'M17 7l-8 4-5 11 8 4 5-7v22h14V19l5 7 8-4-5-11-8-4c-3 4-11 4-14 0Z'} />
                    {m.sleeves === 'long' && <path d="m5 36 6 1m26 0 6-1" />}
                    <path d="M17 7c1 8 13 8 14 0" />
                  </svg>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-semibold text-bone">{m.name}</span>
                  <span className="mt-1 block text-[11px] text-warmgray">{m.id === 'heritage-loose' ? 'Relaxed fit · Short sleeve' : m.sleeves === 'long' ? 'Slim fit · Long sleeve' : 'Slim fit · Short sleeve'}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  <span className={`flex h-4 w-4 items-center justify-center rounded-full border ${selected ? 'border-volt bg-volt text-ink' : 'border-white/20'}`}>
                    {selected && <Check size={10} strokeWidth={3} aria-hidden />}
                  </span>
                  {m.priceDelta > 0 && <span className="text-[9px] font-medium text-volt">+{formatBDT(m.priceDelta)}/kit</span>}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="border-t border-white/[0.08] pt-5">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-bone">Design collection</h3>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-warmgray">{PRESETS.length}</span>
        </div>
        <p className="mb-3 text-[11px] leading-relaxed text-warmgray">A new look. Your selected fit stays.</p>
        <div className="relative mb-3">
          <Search size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-warmgray" aria-hidden />
          <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Find a design…" aria-label="Search designs"
            className="w-full rounded-lg border border-white/10 bg-ink/60 py-2.5 pr-3 pl-9 text-xs text-bone placeholder:text-warmgray/70 focus:border-volt/50" />
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {visiblePresets.map(p => {
            const selected = state.presetId === p.id
            return (
              <button key={p.id} type="button" onClick={() => applyPreset(p.id)} aria-pressed={selected}
                className={`studio-preset-card group overflow-hidden rounded-xl border text-left transition ${selected ? 'border-volt/70 bg-volt/[0.06]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/25'}`}>
                <span className="studio-preset-art relative flex h-[104px] items-center justify-center overflow-hidden">
                  <img src={p.preview} alt="" className="h-[100px] w-full object-contain p-1 transition-transform duration-200 group-hover:scale-105" loading="lazy" />
                  {selected && <span className="absolute top-2 right-2 flex h-5 w-5 items-center justify-center rounded-full bg-volt text-ink"><Check size={12} strokeWidth={3} aria-hidden /></span>}
                </span>
                <span className="block border-t border-white/[0.06] px-2.5 pt-2.5 pb-3">
                  <span className="block truncate text-[11px] font-semibold text-bone">{p.name}</span>
                  <span className="mt-1 flex items-center justify-between gap-1">
                    <span className="truncate text-[9px] text-warmgray">{PATTERN_LABELS[p.design.pattern]}</span>
                    <span className="flex shrink-0 -space-x-0.5" aria-hidden>{[p.design.colors.primary, p.design.colors.secondary, p.design.colors.trim].map((color, i) => <span key={i} className="h-2.5 w-2.5 rounded-full ring-1 ring-carbon" style={{ backgroundColor: color }} />)}</span>
                  </span>
                </span>
              </button>
            )
          })}
        </div>
        {visiblePresets.length === 0 && <p role="status" className="py-8 text-center text-xs text-warmgray">No designs found. Try a different name or pattern.</p>}
      </div>
    </div>
  )
}

export function PatternSection() {
  const state = useKitStore((s) => s.state)
  const updateDesign = useKitStore((s) => s.updateDesign)
  const setPattern = useKitStore((s) => s.setPattern)
  const setFinish = useKitStore((s) => s.setFinish)
  const { design } = state

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SectionLabel>Pattern</SectionLabel>
        <div className="grid grid-cols-2 gap-2">
          {PATTERNS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPattern(p)}
              aria-pressed={design.pattern === p}
              className={`rounded-xl border p-2 text-left transition ${
                design.pattern === p
                  ? 'border-volt bg-graphite'
                  : 'border-smoke bg-carbon hover:border-warmgray'
              }`}
            >
              <span
                className="mb-2 block h-10 rounded-lg"
                style={patternPreviewStyle(p, design.colors.primary, design.colors.secondary)}
                aria-hidden
              />
              <span className="flex items-center gap-1 text-xs font-semibold text-bone">
                {PATTERN_LABELS[p]}
                {design.pattern === p && <Check size={12} className="text-volt" aria-hidden />}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel>Finish</SectionLabel>
        <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-graphite p-1" role="group" aria-label="Finish">
          {(['matte', 'satin'] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFinish(f)}
              aria-pressed={design.finish === f}
              className={`rounded-lg px-3 py-2 text-sm font-semibold capitalize transition ${
                design.finish === f ? 'bg-volt text-ink' : 'text-warmgray hover:text-bone'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      <StyleChips
        label="Collar"
        options={COLLAR_STYLES}
        labels={COLLAR_LABELS}
        value={design.collar}
        onChange={(collar) => updateDesign({ collar })}
      />
      {design.collar === 'polo' && (
        <p className="-mt-3 text-xs text-warmgray">
          Polo collar adds {formatBDT(PRICING.poloCollarAddon)} per kit (illustrative).
        </p>
      )}

      <StyleChips
        label="Sleeve design"
        options={SLEEVE_STYLES}
        labels={SLEEVE_LABELS}
        value={design.sleeveStyle}
        onChange={(sleeveStyle) => updateDesign({ sleeveStyle })}
      />

      <StyleChips
        label="Fabric"
        options={FABRICS}
        labels={FABRIC_LABELS}
        value={design.fabric}
        onChange={(fabric) => updateDesign({ fabric })}
      />
    </div>
  )
}

export function ColorSection() {
  const state = useKitStore((s) => s.state)
  const setZoneColor = useKitStore((s) => s.setZoneColor)
  const rotateColors = useKitStore((s) => s.rotateColors)
  const { design } = state

  return (
    <div className="space-y-6">
      {COLOR_ZONES.map((zone) => (
        <div key={zone.id} className="space-y-2">
          <SectionLabel>{zone.label}</SectionLabel>
          <div className="flex flex-wrap items-center gap-2">
            {SWATCHES.map((sw) => {
              const selected = design.colors[zone.id].toLowerCase() === sw.hex.toLowerCase()
              return (
                <button
                  key={sw.hex}
                  type="button"
                  title={sw.name}
                  aria-label={`${zone.label}: ${sw.name}`}
                  aria-pressed={selected}
                  onClick={() => setZoneColor(zone.id, sw.hex)}
                  className={`flex h-8 w-8 items-center justify-center rounded-full border transition ${
                    selected ? 'ring-2 ring-volt ring-offset-2 ring-offset-carbon' : 'border-smoke'
                  }`}
                  style={{ background: sw.hex }}
                >
                  {selected && (
                    <Check
                      size={14}
                      color={sw.hex.toLowerCase() === '#f5f3ec' || sw.hex.toLowerCase() === '#c8fa45' ? '#101010' : '#f5f3ec'}
                      aria-hidden
                    />
                  )}
                </button>
              )
            })}
            <label
              className="relative flex h-8 w-8 cursor-pointer items-center justify-center overflow-hidden rounded-full border border-dashed border-warmgray text-warmgray"
              title="Custom color"
            >
              <Plus size={14} aria-hidden />
              <input
                type="color"
                aria-label={`${zone.label}: custom color`}
                value={design.colors[zone.id]}
                onChange={(e) => setZoneColor(zone.id, e.target.value)}
                className="absolute inset-0 cursor-pointer opacity-0"
              />
            </label>
            <span className="font-mono text-[11px] text-warmgray uppercase">
              {design.colors[zone.id]}
            </span>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={rotateColors}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-volt px-4 py-2.5 text-sm font-bold text-ink transition hover:brightness-110"
      >
        <RotateCw size={16} aria-hidden /> Rotate Colors
      </button>

    </div>
  )
}

/* ---------------------------------------------------------------- */
/* PRINT TAB                                                           */
/* ---------------------------------------------------------------- */

export function PrintTab() {
  const state = useKitStore((s) => s.state)
  const setPrint = useKitStore((s) => s.setPrint)
  const setCameraView = useKitStore((s) => s.setCameraView)
  const setActiveTab = useKitStore((s) => s.setActiveTab)
  const rosterHintSeen = useKitStore((s) => s.rosterHintSeen)
  const markRosterHintSeen = useKitStore((s) => s.markRosterHintSeen)
  const [hint, setHint] = useState(false)
  const print = state.print

  const toBack = () => setCameraView('back')

  const onNameChange = (value: string) => {
    const upper = value.toUpperCase()
    if (!isValidPlayerName(upper)) {
      // PRD §5.6 — block the invalid character, show the hint, never
      // silently strip.
      setHint(true)
      return
    }
    setHint(false)
    setPrint({ playerName: upper }, 'print-name')
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <SectionLabel>Back print</SectionLabel>
        <button
          type="button"
          role="switch"
          aria-checked={print.enabled}
          aria-label="Back print on or off"
          onClick={() => setPrint({ enabled: !print.enabled })}
          className={`h-6 w-11 rounded-full p-0.5 transition ${print.enabled ? 'bg-volt' : 'bg-smoke'}`}
        >
          <span
            className={`block h-5 w-5 rounded-full bg-ink transition-transform ${print.enabled ? 'translate-x-5 bg-ink' : 'translate-x-0 bg-warmgray'}`}
          />
        </button>
      </div>

      <div className="space-y-2">
        <label htmlFor="player-name" className="text-sm font-medium text-bone">
          Player name
        </label>
        <input
          id="player-name"
          type="text"
          value={print.playerName}
          onChange={(e) => onNameChange(e.target.value)}
          onFocus={toBack}
          maxLength={MAX_NAME_CHARS + 1}
          placeholder="e.g. JABIR"
          autoComplete="off"
          disabled={!print.enabled}
          aria-describedby={hint ? 'name-hint' : undefined}
          aria-invalid={hint}
          className="w-full rounded-[10px] border border-smoke bg-graphite px-3 py-2.5 font-display text-lg font-bold tracking-wide text-bone uppercase placeholder:text-warmgray/50 disabled:opacity-40"
        />
        <p className="text-xs text-warmgray">
          Up to {MAX_NAME_CHARS} characters, printed in an arc on the upper back.
        </p>
        {hint && (
          <p id="name-hint" role="alert" className="flex items-center gap-1.5 text-xs font-medium text-cardred">
            <AlertTriangle size={13} aria-hidden /> Letters, spaces and hyphens only — that character was not added.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <label htmlFor="player-number" className="text-sm font-medium text-bone">
          Number (0–99)
        </label>
        <input
          id="player-number"
          type="number"
          min={0}
          max={99}
          value={print.number}
          onFocus={toBack}
          onChange={(e) => {
            const n = Math.max(0, Math.min(99, Math.floor(Number(e.target.value) || 0)))
            setPrint({ number: n }, 'print-number')
          }}
          disabled={!print.enabled}
          className="w-full rounded-[10px] border border-smoke bg-graphite px-3 py-2.5 font-display text-lg font-bold text-bone disabled:opacity-40"
        />
      </div>

      <div className="space-y-2">
        <SectionLabel>Number font</SectionLabel>
        <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-graphite p-1" role="group" aria-label="Number font">
          <button
            type="button"
            onClick={() => setPrint({ font: 'block' })}
            aria-pressed={print.font === 'block'}
            className={`rounded-lg px-3 py-2 font-display text-sm font-black tracking-wide ${print.font === 'block' ? 'bg-volt text-ink' : 'text-warmgray hover:text-bone'}`}
          >
            99 BLOCK
          </button>
          <button
            type="button"
            onClick={() => setPrint({ font: 'slim' })}
            aria-pressed={print.font === 'slim'}
            style={{ fontFamily: 'Oswald, Inter, sans-serif' }}
            className={`rounded-lg px-3 py-2 text-sm font-medium tracking-[0.2em] ${print.font === 'slim' ? 'bg-volt text-ink' : 'text-warmgray hover:text-bone'}`}
          >
            99 SLIM
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel>Print color</SectionLabel>
        <div className="flex flex-wrap gap-2">
          {PRINT_COLORS.map((c) => {
            const selected = print.color.toLowerCase() === c.hex.toLowerCase()
            return (
              <button
                key={c.hex}
                type="button"
                title={c.name}
                aria-label={`Print color: ${c.name}`}
                aria-pressed={selected}
                onClick={() => setPrint({ color: c.hex })}
                className={`flex h-9 w-9 items-center justify-center rounded-full border ${selected ? 'ring-2 ring-volt ring-offset-2 ring-offset-carbon' : 'border-smoke'}`}
                style={{ background: c.hex }}
              >
                {selected && (
                  <Check size={15} color={c.hex.toLowerCase() === '#101010' ? '#f5f3ec' : '#101010'} aria-hidden />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <SectionLabel>Print style</SectionLabel>
        <div className="grid grid-cols-3 gap-1 rounded-[10px] bg-graphite p-1" role="group" aria-label="Print style">
          {(
            [
              ['solid', 'Solid'],
              ['outline', 'Outline'],
              ['shadow', 'Drop Shadow'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setPrint({ style: id })}
              aria-pressed={print.style === id}
              className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                print.style === id ? 'bg-volt text-ink' : 'text-warmgray hover:text-bone'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {print.enabled && (
        <div className="space-y-3">
          <SectionLabel>Print size & position</SectionLabel>
          <SliderRow
            label="Name size"
            value={print.nameScale}
            min={0.7}
            max={1.4}
            display={`${Math.round(print.nameScale * 100)}%`}
            onChange={(v) => setPrint({ nameScale: v }, 'print-name-scale')}
          />
          <SliderRow
            label="Number size"
            value={print.numberScale}
            min={0.7}
            max={1.4}
            display={`${Math.round(print.numberScale * 100)}%`}
            onChange={(v) => setPrint({ numberScale: v }, 'print-number-scale')}
          />
          <SliderRow
            label="Move left / right"
            value={print.offsetX}
            min={-1}
            max={1}
            step={0.02}
            display={print.offsetX === 0 ? 'centred' : `${print.offsetX > 0 ? 'right' : 'left'} ${Math.abs(Math.round(print.offsetX * 100))}%`}
            onChange={(v) => setPrint({ offsetX: v }, 'print-offset-x')}
          />
          <SliderRow
            label="Move up / down"
            value={print.offsetY}
            min={-1}
            max={1}
            step={0.02}
            display={print.offsetY === 0 ? 'standard' : `${print.offsetY > 0 ? 'down' : 'up'} ${Math.abs(Math.round(print.offsetY * 100))}%`}
            onChange={(v) => setPrint({ offsetY: v }, 'print-offset-y')}
          />
          {(print.offsetX !== 0 || print.offsetY !== 0 || print.nameScale !== 1 || print.numberScale !== 1) && (
            <button
              type="button"
              onClick={() => setPrint({ offsetX: 0, offsetY: 0, nameScale: 1, numberScale: 1 })}
              className="text-xs font-medium text-warmgray underline-offset-2 hover:text-bone hover:underline"
            >
              Reset size & position
            </button>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="tagline" className="text-sm font-medium text-bone">
          Front tagline <span className="text-warmgray">(sponsor text)</span>
        </label>
        <input
          id="tagline"
          type="text"
          value={print.tagline}
          onChange={(e) =>
            setPrint(
              { tagline: e.target.value.toUpperCase().replace(/[^A-Z0-9 .&-]/g, '').slice(0, 24) },
              'print-tagline',
            )
          }
          onFocus={() => setCameraView('front')}
          maxLength={24}
          placeholder="e.g. DHAKA WARRIORS"
          autoComplete="off"
          className="w-full rounded-[10px] border border-smoke bg-graphite px-3 py-2.5 text-sm font-semibold tracking-[0.14em] text-bone uppercase placeholder:text-warmgray/50"
        />
        <p className="text-xs text-warmgray">Printed across the front chest in the print color. Leave empty for none.</p>
      </div>


      {print.enabled && print.playerName && state.roster.length === 0 && !rosterHintSeen && (
        <button
          type="button"
          onClick={() => {
            markRosterHintSeen()
            setActiveTab('roster')
          }}
          className="flex w-full items-center gap-2 rounded-xl border border-ember/60 bg-ember/10 px-3 py-2.5 text-left text-sm font-medium text-bone"
        >
          <Users size={16} className="shrink-0 text-ember" aria-hidden />
          Designing for a team? Build the roster →
        </button>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* LOGO — upload or built-in badge; device-local, never shared.      */
/* ---------------------------------------------------------------- */

export function LogoSection() {
  const logo = useKitStore((s) => s.logo)
  const setLogo = useKitStore((s) => s.setLogo)
  const showToast = useKitStore((s) => s.showToast)
  const [busy, setBusy] = useState(false)

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      showToast('Please choose an image file for the logo.', 'error')
      return
    }
    setBusy(true)
    const reader = new FileReader()
    reader.onload = () => {
      const img = new Image()
      img.onload = () => {
        // Downscale to ≤512px so localStorage stays comfortable.
        const max = 512
        const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
        const c = document.createElement('canvas')
        c.width = Math.round(img.naturalWidth * k)
        c.height = Math.round(img.naturalHeight * k)
        c.getContext('2d')?.drawImage(img, 0, 0, c.width, c.height)
        setLogo({
          kind: 'upload',
          dataUrl: c.toDataURL('image/png'),
          placement: logo?.placement ?? 'chest',
          scale: logo?.scale ?? 1,
        })
        setBusy(false)
        showToast('Logo added — it stays on this device and is not part of share links.')
      }
      img.onerror = () => {
        setBusy(false)
        showToast('That image could not be read.', 'error')
      }
      img.src = String(reader.result)
    }
    reader.onerror = () => {
      setBusy(false)
      showToast('That file could not be read.', 'error')
    }
    reader.readAsDataURL(file)
  }

  const placements: { id: LogoPlacement; label: string }[] = [
    { id: 'chest', label: 'Chest' },
    { id: 'sleeve-left', label: 'Left sleeve' },
    { id: 'sleeve-right', label: 'Right sleeve' },
  ]

  return (
    <div className="space-y-3 rounded-xl border border-smoke bg-graphite/50 p-3">
      <div className="flex items-center justify-between">
        <SectionLabel>Team logo</SectionLabel>
        {logo && (
          <button
            type="button"
            onClick={() => setLogo(null)}
            className="text-xs font-medium text-warmgray underline-offset-2 hover:text-cardred hover:underline"
          >
            Remove
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Logo source">
        <label
          className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
            logo?.kind === 'upload'
              ? 'border-volt bg-volt text-ink'
              : 'border-smoke bg-carbon text-warmgray hover:border-warmgray hover:text-bone'
          }`}
        >
          {busy ? 'Loading…' : 'Upload logo'}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            aria-label="Upload a logo image"
            onChange={(e) => {
              onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </label>
        {(
          [
            ['shield', 'Shield badge'],
            ['roundel', 'Roundel badge'],
          ] as const
        ).map(([kind, label]) => (
          <button
            key={kind}
            type="button"
            aria-pressed={logo?.kind === kind}
            onClick={() =>
              setLogo({
                kind,
                dataUrl: null,
                placement: logo?.placement ?? 'chest',
                scale: logo?.scale ?? 1,
              })
            }
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              logo?.kind === kind
                ? 'border-volt bg-volt text-ink'
                : 'border-smoke bg-carbon text-warmgray hover:border-warmgray hover:text-bone'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {logo && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Logo placement">
            {placements.map((p) => (
              <button
                key={p.id}
                type="button"
                aria-pressed={logo.placement === p.id}
                onClick={() => setLogo({ ...logo, placement: p.id })}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  logo.placement === p.id
                    ? 'border-volt bg-graphite text-bone'
                    : 'border-smoke bg-carbon text-warmgray hover:text-bone'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <SliderRow
            label="Logo size"
            value={logo.scale}
            min={0.6}
            max={1.8}
            display={`${Math.round(logo.scale * 100)}%`}
            onChange={(v) => setLogo({ ...logo, scale: v })}
          />
          <p className="text-xs text-warmgray">
            Logos are stored on this device only — share links never embed uploaded images.
          </p>
        </>
      )}
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* ROSTER TAB                                                          */
/* ---------------------------------------------------------------- */

export function RosterTab() {
  const state = useKitStore((s) => s.state)
  const addRosterRow = useKitStore((s) => s.addRosterRow)
  const updateRosterRow = useKitStore((s) => s.updateRosterRow)
  const removeRosterRow = useKitStore((s) => s.removeRosterRow)
  const [name, setName] = useState('')
  const [number, setNumber] = useState(1)
  const [size, setSize] = useState<Size>('M')
  const q = quote(state)
  const dups = useMemo(() => duplicateNumbers(state.roster), [state.roster])

  const add = () => {
    addRosterRow({ name: name.trim().toUpperCase(), number, size })
    setName('')
    setNumber((n) => Math.min(99, n + 1))
  }

  return (
    <div className="space-y-5">
      <SectionLabel>Squad roster · {state.roster.length}/25</SectionLabel>

      {state.roster.length === 0 ? (
        <div className="rounded-xl border border-dashed border-smoke p-4 text-center">
          <p className="text-sm text-warmgray">Add your first player.</p>
          {state.print.enabled && (
            <button
              type="button"
              onClick={() =>
                addRosterRow({
                  name: state.print.playerName,
                  number: state.print.number,
                  size: 'M',
                })
              }
              className="mt-2 text-sm font-semibold text-volt hover:underline"
            >
              Copy from Print tab ({state.print.playerName || '—'} #{state.print.number})
            </button>
          )}
        </div>
      ) : (
        <ul className="space-y-2">
          {state.roster.map((row, i) => {
            const isDup = dups.has(row.number)
            return (
              <li
                key={i}
                className={`flex items-center gap-2 rounded-xl border bg-graphite p-2 ${isDup ? 'border-cardred' : 'border-smoke'}`}
              >
                <input
                  type="text"
                  value={row.name}
                  aria-label={`Player ${i + 1} name`}
                  placeholder="NAME"
                  onChange={(e) =>
                    updateRosterRow(i, { ...row, name: e.target.value.toUpperCase().slice(0, 40) })
                  }
                  className="min-w-0 flex-1 rounded-lg bg-carbon px-2 py-1.5 text-sm font-semibold text-bone uppercase placeholder:text-warmgray/50"
                />
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={row.number}
                  aria-label={`Player ${i + 1} number`}
                  onChange={(e) =>
                    updateRosterRow(i, {
                      ...row,
                      number: Math.max(0, Math.min(99, Math.floor(Number(e.target.value) || 0))),
                    })
                  }
                  className={`w-14 rounded-lg bg-carbon px-2 py-1.5 text-center font-mono text-sm ${isDup ? 'text-cardred' : 'text-bone'}`}
                />
                <select
                  value={row.size}
                  aria-label={`Player ${i + 1} size`}
                  onChange={(e) => updateRosterRow(i, { ...row, size: e.target.value as Size })}
                  className="rounded-lg bg-carbon px-1.5 py-1.5 font-mono text-sm text-bone"
                >
                  {SIZES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRosterRow(i)}
                  aria-label={`Remove player ${i + 1}`}
                  className="rounded-lg p-1.5 text-warmgray transition hover:bg-cardred/15 hover:text-cardred"
                >
                  <Trash2 size={15} aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
      )}

      {dups.size > 0 && (
        <p role="alert" className="flex items-start gap-1.5 text-xs font-medium text-cardred">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden />
          Duplicate number{dups.size > 1 ? 's' : ''}: {[...dups].join(', ')} — allowed, but worth
          double-checking before ordering.
        </p>
      )}

      <form
        className="space-y-2 rounded-xl border border-smoke bg-carbon p-3"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <div className="flex gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 40))}
            placeholder="PLAYER NAME"
            aria-label="New player name"
            className="min-w-0 flex-1 rounded-lg bg-graphite px-2.5 py-2 text-sm font-semibold text-bone uppercase placeholder:text-warmgray/50"
          />
          <input
            type="number"
            min={0}
            max={99}
            value={number}
            onChange={(e) => setNumber(Math.max(0, Math.min(99, Math.floor(Number(e.target.value) || 0))))}
            aria-label="New player number"
            className="w-16 rounded-lg bg-graphite px-2 py-2 text-center font-mono text-sm text-bone"
          />
          <select
            value={size}
            onChange={(e) => setSize(e.target.value as Size)}
            aria-label="New player size"
            className="rounded-lg bg-graphite px-1.5 py-2 font-mono text-sm text-bone"
          >
            {SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={state.roster.length >= 25}
          className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-volt px-4 py-2 text-sm font-bold text-ink transition hover:brightness-110 disabled:opacity-40"
        >
          <Plus size={15} aria-hidden /> Add player
        </button>
      </form>

      <div className="rounded-xl bg-graphite px-3 py-2.5 font-mono text-xs text-warmgray">
        {q.quantity} kit{q.quantity === 1 ? '' : 's'} × {formatBDT(q.perKit)} ={' '}
        <span className="text-sm font-bold text-volt">{formatBDT(q.total)}</span>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* SUMMARY TAB                                                         */
/* ---------------------------------------------------------------- */

export function SummaryTab() {
  const state = useKitStore((s) => s.state)
  const showToast = useKitStore((s) => s.showToast)
  const resetDesign = useKitStore((s) => s.resetDesign)
  const loadState = useKitStore((s) => s.loadState)
  const navigate = useNavigate()
  const [linkField, setLinkField] = useState<string | null>(null)
  const q = quote(state)

  const frontUrl = useMemo(
    () => flatDataUrl('front', state.design, state.print),
    [state.design, state.print],
  )
  const backUrl = useMemo(
    () => flatDataUrl('back', state.design, state.print),
    [state.design, state.print],
  )

  const copyShare = async () => {
    const url = buildShareUrl(state, window.location.origin, '/studio')
    try {
      await navigator.clipboard.writeText(url)
      showToast('Share link copied — it recreates this exact design.')
    } catch {
      // PRD §7.4 — clipboard denied: show the link in a copyable field.
      setLinkField(url)
      showToast('Clipboard blocked — copy the link from the field below.', 'info')
    }
  }

  const actionBtn =
    'flex items-center gap-2 rounded-[10px] border border-smoke bg-graphite px-3 py-2.5 text-sm font-semibold text-bone transition hover:border-warmgray w-full justify-center'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2">
        <figure className="text-center">
          <img src={frontUrl} alt="Front preview of the jersey" className="w-full rounded-xl bg-ink" />
          <figcaption className="mt-1 font-mono text-[10px] tracking-widest text-warmgray uppercase">Front</figcaption>
        </figure>
        <figure className="text-center">
          <img src={backUrl} alt="Back preview of the jersey" className="w-full rounded-xl bg-ink" />
          <figcaption className="mt-1 font-mono text-[10px] tracking-widest text-warmgray uppercase">Back</figcaption>
        </figure>
      </div>

      <div className="space-y-1.5 text-sm">
        <p className="font-display text-base font-bold text-bone">{state.name}</p>
        <p className="text-warmgray">
          {modelById(state.design.modelId).name} · {PATTERN_LABELS[state.design.pattern]} · {state.design.finish} finish
        </p>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-warmgray">
          {(Object.entries(state.design.colors) as [string, string][]).map(([zone, hex]) => (
            <span key={zone} className="flex items-center gap-1.5 capitalize">
              <span className="h-3 w-3 rounded-full border border-smoke" style={{ background: hex }} aria-hidden />
              {zone} {hex}
            </span>
          ))}
        </p>
        <p className="text-warmgray">
          Print: {state.print.enabled ? `${state.print.playerName || '—'} · #${state.print.number} · ${state.print.font === 'block' ? 'Classic Block' : 'Modern Slim'}` : 'none'}
        </p>
        <p className="text-warmgray">Roster: {state.roster.length} player{state.roster.length === 1 ? '' : 's'}</p>
      </div>

      <div className="space-y-1 rounded-xl bg-graphite p-3 font-mono text-xs text-warmgray">
        <div className="flex justify-between"><span>Base per kit ({q.tier.min}–{q.tier.max} tier)</span><span className="text-bone">{formatBDT(q.basePerKit)}</span></div>
        {q.modelAddonPerKit > 0 && (
          <div className="flex justify-between"><span>Model per kit ({modelById(state.design.modelId).name})</span><span className="text-bone">{formatBDT(q.modelAddonPerKit)}</span></div>
        )}
        {q.collarAddonPerKit > 0 && (
          <div className="flex justify-between"><span>Polo collar per kit</span><span className="text-bone">{formatBDT(q.collarAddonPerKit)}</span></div>
        )}
        <div className="flex justify-between"><span>Print per kit</span><span className="text-bone">{formatBDT(q.printAddonPerKit)}</span></div>
        <div className="flex justify-between"><span>Quantity</span><span className="text-bone">{q.quantity}</span></div>
        <div className="flex justify-between border-t border-smoke pt-1.5 text-sm"><span className="text-bone">Team total</span><span className="font-bold text-volt">{formatBDT(q.total)}</span></div>
        <p className="pt-1 text-[11px] leading-snug">{q.tierMessage}</p>
        <p className="text-[11px] leading-snug italic">{PRICING.disclaimer}</p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          <button type="button" className={actionBtn} onClick={() => void downloadSnapshot(state, 'front')}>
            <Camera size={15} aria-hidden /> Front
          </button>
          <button type="button" className={actionBtn} onClick={() => void downloadSnapshot(state, 'back')}>
            <Camera size={15} aria-hidden /> Back
          </button>
          <button type="button" className={actionBtn} onClick={() => void downloadSnapshot(state, 'both')}>
            <Download size={15} aria-hidden /> Both
          </button>
        </div>
        <button type="button" className={actionBtn} onClick={copyShare}>
          <Copy size={15} aria-hidden /> Copy Share Link
        </button>
        {linkField && (
          <input
            type="text"
            readOnly
            value={linkField}
            aria-label="Share link (copy manually)"
            onFocus={(e) => e.target.select()}
            className="w-full rounded-[10px] border border-smoke bg-carbon px-3 py-2 font-mono text-[11px] text-bone"
          />
        )}
        <button
          type="button"
          className={actionBtn}
          onClick={() => navigate(`/approval?d=${new URL(buildShareUrl(state, window.location.origin, '/approval')).searchParams.get('d')}`)}
        >
          <Eye size={15} aria-hidden /> Open Approval Preview
        </button>
        <button
          type="button"
          className={actionBtn}
          onClick={() => {
            saveMyDesign(state)
            showToast('Saved to My Designs on this device.')
          }}
        >
          <Save size={15} aria-hidden /> Save to My Designs
        </button>
        <button type="button" className={actionBtn} onClick={() => exportOrderSummary(state)}>
          <FileText size={15} aria-hidden /> Export order summary
        </button>
        <button type="button" className={actionBtn} onClick={() => exportSvg(state)}>
          <FileText size={15} aria-hidden /> Export SVG for Illustrator
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={actionBtn} onClick={() => exportDesignFile(state)}>
            <Download size={15} aria-hidden /> Save design file
          </button>
          <label className={`${actionBtn} cursor-pointer`}>
            <Plus size={15} aria-hidden /> Open design file
            <input
              type="file"
              accept=".json,application/json"
              className="sr-only"
              aria-label="Open a KitStudio design file"
              onChange={(e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                f.text()
                  .then((text) => {
                    const parsed: unknown = JSON.parse(text)
                    const cleaned = sanitizeSharedDesign(parsed)
                    if (cleaned) {
                      loadState(cleaned)
                      showToast('Design file loaded — keep editing.')
                    } else {
                      showToast('That file is not a KitStudio design.', 'error')
                    }
                  })
                  .catch(() => showToast('That file could not be read.', 'error'))
              }}
            />
          </label>
        </div>
        <p className="text-[11px] leading-snug text-warmgray">
          SVG opens in Adobe Illustrator as editable vector shapes and text. The design
          file (.kitstudio.json) reloads the full kit — design, print, roster — for editing here.
        </p>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Reset to the default design? Your roster will be cleared.')) {
              resetDesign()
              showToast('Design reset.', 'info')
            }
          }}
          className="w-full pt-1 text-center text-xs font-medium text-warmgray underline-offset-2 hover:text-cardred hover:underline"
        >
          Reset design
        </button>
      </div>
    </div>
  )
}

/* ---------------------------------------------------------------- */
/* RIGHT RAIL PRICE CARD                                               */
/* ---------------------------------------------------------------- */

export function PriceCard() {
  const state = useKitStore((s) => s.state)
  const setActiveTab = useKitStore((s) => s.setActiveTab)
  const q = quote(state)
  return (
    <div className="space-y-3 rounded-2xl border border-smoke bg-carbon p-4">
      <p className="font-mono text-[11px] tracking-[0.18em] text-warmgray uppercase">Per kit</p>
      <p className="font-display text-4xl font-black text-volt">{formatBDT(q.perKit)}</p>
      <p className="text-xs text-warmgray">{q.tierMessage}</p>
      <dl className="space-y-1 border-t border-smoke pt-3 text-sm">
        <div className="flex justify-between"><dt className="text-warmgray">Model</dt><dd className="font-medium text-bone">{modelById(state.design.modelId).name}</dd></div>
        <div className="flex justify-between"><dt className="text-warmgray">Pattern</dt><dd className="font-medium text-bone">{PATTERN_LABELS[state.design.pattern]}</dd></div>
        <div className="flex justify-between"><dt className="text-warmgray">Collar</dt><dd className="font-medium text-bone">{COLLAR_LABELS[state.design.collar]}</dd></div>
        <div className="flex justify-between"><dt className="text-warmgray">Fabric</dt><dd className="font-medium text-bone">{FABRIC_LABELS[state.design.fabric]}</dd></div>
        <div className="flex justify-between"><dt className="text-warmgray">Finish</dt><dd className="font-medium text-bone capitalize">{state.design.finish}</dd></div>
        <div className="flex justify-between"><dt className="text-warmgray">Print</dt><dd className="font-medium text-bone">{state.print.enabled ? `#${state.print.number}` : 'None'}</dd></div>
        <div className="flex justify-between"><dt className="text-warmgray">Roster</dt><dd className="font-medium text-bone">{state.roster.length} players</dd></div>
        {state.roster.length > 0 && (
          <div className="flex justify-between border-t border-smoke pt-1.5"><dt className="text-bone">Team total</dt><dd className="font-mono font-bold text-volt">{formatBDT(q.total)}</dd></div>
        )}
      </dl>
      <button
        type="button"
        onClick={() => setActiveTab('summary')}
        className="w-full rounded-[10px] bg-volt px-3 py-2.5 text-sm font-bold text-ink transition hover:brightness-110"
      >
        Review Summary
      </button>
      <p className="text-[11px] leading-snug text-warmgray italic">{PRICING.disclaimer}</p>
    </div>
  )
}

export type { RosterEntry }


