/**
 * KitStudio — application store (Zustand).
 * Design state (shareable) is kept strictly separate from UI state
 * (never shared) per PRD §7.6. Undo history covers design + print +
 * roster changes only.
 */
import { create } from 'zustand'
import { PRESETS, presetById } from './presets'
import type {
  ColorZone,
  KitDesign,
  KitPrint,
  Pattern,
  RosterEntry,
  SavedDesign,
  SharedDesignV1,
} from './types'

export const MY_DESIGNS_KEY = 'kitstudio:my-designs:v1'
const HISTORY_LIMIT = 60

export function defaultState(): SharedDesignV1 {
  const preset = PRESETS[0]
  return {
    v: 1,
    name: 'My Kit',
    presetId: preset.id,
    design: structuredClone(preset.design),
    print: {
      enabled: true,
      playerName: 'JABIR',
      number: 10,
      font: 'block',
      color: '#F5F3EC',
      style: 'solid',
      nameScale: 1,
      numberScale: 1,
      offsetX: 0,
      offsetY: 0,
      tagline: '',
    },
    roster: [],
  }
}

/* ------------------------------------------------------------------ */
/* Logo — device-local (PRD §7.2: uploaded assets are never embedded  */
/* in share links). Persisted in localStorage on this device only.    */
/* ------------------------------------------------------------------ */

export const LOGO_KEY = 'kitstudio:logo:v1'
export type LogoPlacement = 'chest' | 'sleeve-left' | 'sleeve-right'
export interface LogoState {
  kind: 'upload' | 'shield' | 'roundel'
  dataUrl: string | null
  placement: LogoPlacement
  scale: number
}

function loadLogo(): LogoState | null {
  try {
    const raw = localStorage.getItem(LOGO_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as LogoState
    if (!parsed || typeof parsed !== 'object') return null
    if (!['upload', 'shield', 'roundel'].includes(parsed.kind)) return null
    return {
      kind: parsed.kind,
      dataUrl: typeof parsed.dataUrl === 'string' ? parsed.dataUrl : null,
      placement: ['chest', 'sleeve-left', 'sleeve-right'].includes(parsed.placement)
        ? parsed.placement
        : 'chest',
      scale:
        typeof parsed.scale === 'number'
          ? Math.max(0.6, Math.min(1.8, parsed.scale))
          : 1,
    }
  } catch {
    return null
  }
}

export type StudioTab =
  | 'design'
  | 'color'
  | 'pattern'
  | 'print'
  | 'logo'
  | 'roster'
  | 'summary'
export type CameraView = 'front' | 'back'
export type StudioBackground = 'ink' | 'spotlight' | 'paper'

interface Toast {
  id: number
  message: string
  kind: 'success' | 'error' | 'info'
}

interface KitStore {
  /** Shareable design state. */
  state: SharedDesignV1
  past: SharedDesignV1[]
  future: SharedDesignV1[]

  /** UI state — never serialized into share links. */
  activeTab: StudioTab
  cameraView: CameraView
  autoRotate: boolean
  background: StudioBackground
  toast: Toast | null
  rosterHintSeen: boolean
  shareError: string | null

  loadState: (s: SharedDesignV1) => void
  commit: (next: SharedDesignV1, coalesceKey?: string) => void
  setDesignName: (name: string) => void
  setModel: (modelId: string) => void
  updateDesign: (patch: Partial<KitDesign>) => void
  logo: LogoState | null
  setLogo: (logo: LogoState | null) => void
  setPattern: (pattern: Pattern) => void
  setZoneColor: (zone: ColorZone, hex: string) => void
  setFinish: (finish: KitDesign['finish']) => void
  rotateColors: () => void
  applyPreset: (presetId: string, options?: { preserveModel?: boolean }) => void
  setPrint: (patch: Partial<KitPrint>, coalesceKey?: string) => void
  addRosterRow: (row: RosterEntry) => void
  updateRosterRow: (index: number, row: RosterEntry) => void
  removeRosterRow: (index: number) => void
  resetDesign: () => void
  undo: () => void
  redo: () => void

  setActiveTab: (tab: StudioTab) => void
  setCameraView: (view: CameraView) => void
  setAutoRotate: (on: boolean) => void
  setBackground: (bg: StudioBackground) => void
  setShareError: (msg: string | null) => void
  markRosterHintSeen: () => void
  showToast: (message: string, kind?: Toast['kind']) => void
  clearToast: () => void
}

let lastCoalesce: { key: string; at: number } | null = null
let toastId = 0

export const useKitStore = create<KitStore>((set, get) => {
  /** History-aware commit. Rapid same-key edits (typing) coalesce. */
  function commit(next: SharedDesignV1, coalesceKey?: string) {
    const now = Date.now()
    const coalesce =
      coalesceKey &&
      lastCoalesce?.key === coalesceKey &&
      now - lastCoalesce.at < 900
    lastCoalesce = coalesceKey ? { key: coalesceKey, at: now } : null
    const { state, past } = get()
    if (JSON.stringify(state) === JSON.stringify(next)) return
    set({
      state: next,
      past: coalesce ? past : [...past.slice(-HISTORY_LIMIT), state],
      future: [],
    })
  }

  return {
    state: defaultState(),
    past: [],
    future: [],

    activeTab: 'design',
    cameraView: 'front',
    autoRotate: false,
    background: 'ink',
    toast: null,
    rosterHintSeen: false,
    shareError: null,

    loadState: (s) => {
      lastCoalesce = null
      set({ state: s, past: [], future: [] })
    },
    commit,

    setDesignName: (name) =>
      commit({ ...get().state, name }, 'design-name'),

    setModel: (modelId) =>
      commit({
        ...get().state,
        presetId: undefined,
        design: { ...get().state.design, modelId },
      }),

    updateDesign: (patch) =>
      commit({
        ...get().state,
        presetId: undefined,
        design: { ...get().state.design, ...patch },
      }),

    logo: typeof localStorage !== 'undefined' ? loadLogo() : null,
    setLogo: (logo) => {
      try {
        if (logo) localStorage.setItem(LOGO_KEY, JSON.stringify(logo))
        else localStorage.removeItem(LOGO_KEY)
      } catch {
        /* storage unavailable — logo still applies for this session */
      }
      set({ logo })
    },

    setPattern: (pattern) =>
      commit({
        ...get().state,
        presetId: undefined,
        design: { ...get().state.design, pattern },
      }),

    setZoneColor: (zone, hex) =>
      commit(
        {
          ...get().state,
          presetId: undefined,
          design: {
            ...get().state.design,
            colors: { ...get().state.design.colors, [zone]: hex },
          },
        },
        `color-${zone}`,
      ),

    setFinish: (finish) =>
      commit({
        ...get().state,
        design: { ...get().state.design, finish },
      }),

    rotateColors: () => {
      const c = get().state.design.colors
      commit({
        ...get().state,
        presetId: undefined,
        design: {
          ...get().state.design,
          colors: {
            primary: c.trim,
            secondary: c.primary,
            sleeves: c.secondary,
            trim: c.sleeves,
          },
        },
      })
    },

    applyPreset: (presetId, options) => {
      const preset = presetById(presetId)
      if (!preset) return
      // PRD §2.3 — presets replace design fields only; print, roster
      // and design name are untouched. The change is undoable.
      commit({
        ...get().state,
        presetId,
        design: {
          ...structuredClone(preset.design),
          modelId: options?.preserveModel === false ? preset.design.modelId : get().state.design.modelId,
        },
      })
      get().showToast(options?.preserveModel === false ? 'Preset loaded.' : 'Design applied. Your fit, roster and print are kept.')
    },

    setPrint: (patch, coalesceKey) =>
      commit(
        { ...get().state, print: { ...get().state.print, ...patch } },
        coalesceKey,
      ),

    addRosterRow: (row) => {
      const roster = get().state.roster
      if (roster.length >= 25) {
        get().showToast('Roster is full (25 players max).', 'error')
        return
      }
      commit({ ...get().state, roster: [...roster, row] })
    },

    updateRosterRow: (index, row) => {
      const roster = get().state.roster.map((r, i) => (i === index ? row : r))
      commit({ ...get().state, roster }, `roster-${index}`)
    },

    removeRosterRow: (index) => {
      const roster = get().state.roster.filter((_, i) => i !== index)
      commit({ ...get().state, roster })
    },

    resetDesign: () => commit(defaultState()),

    undo: () => {
      const { past, state, future } = get()
      if (past.length === 0) return
      lastCoalesce = null
      set({
        state: past[past.length - 1],
        past: past.slice(0, -1),
        future: [state, ...future].slice(0, HISTORY_LIMIT),
      })
    },

    redo: () => {
      const { past, state, future } = get()
      if (future.length === 0) return
      lastCoalesce = null
      set({
        state: future[0],
        past: [...past, state],
        future: future.slice(1),
      })
    },

    setActiveTab: (tab) => set({ activeTab: tab }),
    setCameraView: (view) => set({ cameraView: view }),
    setAutoRotate: (on) => set({ autoRotate: on }),
    setBackground: (bg) => set({ background: bg }),
    setShareError: (msg) => set({ shareError: msg }),
    markRosterHintSeen: () => set({ rosterHintSeen: true }),
    showToast: (message, kind = 'success') =>
      set({ toast: { id: ++toastId, message, kind } }),
    clearToast: () => set({ toast: null }),
  }
})

/* ------------------------------------------------------------------ */
/* My Designs — localStorage persistence (PRD §1.7, §7.6)              */
/* ------------------------------------------------------------------ */

export function loadMyDesigns(): { designs: SavedDesign[]; corrupted: boolean } {
  try {
    const raw = localStorage.getItem(MY_DESIGNS_KEY)
    if (!raw) return { designs: [], corrupted: false }
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return { designs: [], corrupted: true }
    const designs = parsed.filter(
      (d): d is SavedDesign =>
        !!d &&
        typeof d === 'object' &&
        typeof (d as SavedDesign).id === 'string' &&
        !!(d as SavedDesign).state,
    )
    return { designs, corrupted: designs.length !== parsed.length }
  } catch {
    return { designs: [], corrupted: true }
  }
}

export function saveMyDesign(state: SharedDesignV1): SavedDesign[] {
  const { designs } = loadMyDesigns()
  const entry: SavedDesign = {
    id: `d-${Date.now().toString(36)}`,
    savedAt: Date.now(),
    state: structuredClone(state),
  }
  const next = [entry, ...designs].slice(0, 50)
  try {
    localStorage.setItem(MY_DESIGNS_KEY, JSON.stringify(next))
  } catch {
    /* storage full/unavailable — saving is best-effort */
  }
  return next
}

export function deleteMyDesign(id: string): SavedDesign[] {
  const { designs } = loadMyDesigns()
  const next = designs.filter((d) => d.id !== id)
  try {
    localStorage.setItem(MY_DESIGNS_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
  return next
}
