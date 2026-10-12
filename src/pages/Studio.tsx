import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Camera,
  Expand,
  Image as ImageIcon,
  LayoutGrid,
  Palette,
  Receipt,
  Redo2,
  RotateCcw,
  Save,
  Share2,
  Shirt,
  Type,
  Undo2,
  Users,
} from 'lucide-react'
import JerseyViewer, { type ViewerBackground } from '../components/JerseyViewer'
import {
  ColorSection,
  DesignSection,
  LogoSection,
  PatternSection,
  PriceCard,
  PrintTab,
  RosterTab,
  SummaryTab,
} from '../components/panels'
import { buildShareUrl, decodeShare, encodeShare } from '../lib/share'
import { downloadSnapshot } from '../lib/snapshot'
import { PATTERN_LABELS } from '../lib/types'
import { saveMyDesign, useKitStore, type StudioTab } from '../lib/store'

/* Spized-style steps: a slim icon rail, one section open at a
 * time — no endless sidebar scroll. */
const SECTIONS: { id: StudioTab; label: string; hint: string; icon: typeof Palette }[] = [
  { id: 'design', label: 'Design', hint: 'Choose a model and a starting design', icon: Shirt },
  { id: 'color', label: 'Color', hint: 'Assign colours to each area of the kit', icon: Palette },
  { id: 'pattern', label: 'Pattern', hint: 'Pattern, collar, sleeve, fabric and finish', icon: LayoutGrid },
  { id: 'print', label: 'Print', hint: 'Back name, number and front tagline', icon: Type },
  { id: 'logo', label: 'Logo', hint: 'Upload a crest or pick a badge', icon: ImageIcon },
  { id: 'roster', label: 'Roster', hint: 'Names, numbers and sizes per player', icon: Users },
  { id: 'summary', label: 'Summary', hint: 'Review, share and export the order', icon: Receipt },
]

const BG_CYCLE: ViewerBackground[] = ['ink', 'spotlight', 'paper']

export default function Studio() {
  const [searchParams] = useSearchParams()
  const state = useKitStore((s) => s.state)
  const past = useKitStore((s) => s.past)
  const future = useKitStore((s) => s.future)
  const undo = useKitStore((s) => s.undo)
  const redo = useKitStore((s) => s.redo)
  const activeTab = useKitStore((s) => s.activeTab)
  const setActiveTab = useKitStore((s) => s.setActiveTab)
  const cameraView = useKitStore((s) => s.cameraView)
  const setCameraView = useKitStore((s) => s.setCameraView)
  const autoRotate = useKitStore((s) => s.autoRotate)
  const setAutoRotate = useKitStore((s) => s.setAutoRotate)
  const background = useKitStore((s) => s.background)
  const setBackground = useKitStore((s) => s.setBackground)
  const setDesignName = useKitStore((s) => s.setDesignName)
  const showToast = useKitStore((s) => s.showToast)
  const shareError = useKitStore((s) => s.shareError)
  const setShareError = useKitStore((s) => s.setShareError)
  const loadState = useKitStore((s) => s.loadState)
  const applyPreset = useKitStore((s) => s.applyPreset)

  const [viewerKey, setViewerKey] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const hydrated = useRef(false)

  /* Load share payload / preset param once on mount (PRD §7.2, §7.4). */
  useEffect(() => {
    const d = searchParams.get('d')
    const preset = searchParams.get('preset')
    if (d) {
      const result = decodeShare(d)
      if (result.ok) {
        loadState(result.state)
      } else {
        setShareError(result.error)
      }
    } else if (preset) {
      applyPreset(preset, { preserveModel: false })
    }
    hydrated.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* Keep the URL carrying the current design (replaceState, no spam). */
  useEffect(() => {
    if (!hydrated.current) return
    const t = setTimeout(() => {
      const url = `${window.location.pathname}?d=${encodeShare(state)}`
      window.history.replaceState(null, '', url)
    }, 450)
    return () => clearTimeout(t)
  }, [state])

  const description = useMemo(() => {
    const c = state.design.colors
    return `Current design: ${PATTERN_LABELS[state.design.pattern]} pattern. Primary ${c.primary}, secondary ${c.secondary}, sleeves ${c.sleeves}, trim ${c.trim}. ${state.design.finish} finish.${
      state.print.enabled
        ? ` Back print ${state.print.playerName || 'blank'} number ${state.print.number}.`
        : ' No back print.'
    } ${state.roster.length} players on the roster.`
  }, [state])

  const share = async () => {
    const url = buildShareUrl(state, window.location.origin, '/studio')
    try {
      await navigator.clipboard.writeText(url)
      showToast('Share link copied — it recreates this exact design.')
    } catch {
      showToast('Clipboard blocked — the link is in the address bar.', 'info')
    }
  }

  const cycleBackground = () => {
    const next = BG_CYCLE[(BG_CYCLE.indexOf(background) + 1) % BG_CYCLE.length]
    setBackground(next)
  }

  const iconBtn =
    'rounded-[10px] border border-smoke bg-graphite p-2 text-bone transition hover:border-warmgray disabled:opacity-35 disabled:hover:border-smoke'

  return (
    <div className="flex h-dvh flex-col bg-ink text-bone">
      {/* ------------------------------------------------ top bar */}
      <header className="flex items-center gap-2 border-b border-smoke bg-ink px-3 py-2.5 sm:gap-3 sm:px-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-display text-lg font-black tracking-tight text-bone uppercase"
          aria-label="KitStudio — back to home"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-volt font-display text-sm font-black text-ink">
            K
          </span>
          <span className="hidden sm:inline">
            Kit<span className="text-volt">Studio</span>
          </span>
        </Link>

        <input
          type="text"
          value={state.name}
          onChange={(e) => setDesignName(e.target.value.slice(0, 60))}
          aria-label="Design name"
          className="min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-2 py-1.5 text-center font-display text-base font-bold text-bone transition hover:border-smoke focus:border-smoke sm:flex-none sm:px-3 sm:text-left"
        />

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          <button type="button" onClick={undo} disabled={past.length === 0} className={iconBtn} aria-label="Undo">
            <Undo2 size={16} aria-hidden />
          </button>
          <button type="button" onClick={redo} disabled={future.length === 0} className={iconBtn} aria-label="Redo">
            <Redo2 size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => void downloadSnapshot(state, 'both')}
            className={`${iconBtn} hidden sm:block`}
            aria-label="Snapshot front and back"
          >
            <Camera size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => {
              saveMyDesign(state)
              showToast('Saved to My Designs on this device.')
            }}
            className={iconBtn}
            aria-label="Save design"
          >
            <Save size={16} aria-hidden />
          </button>
          <button
            type="button"
            onClick={share}
            className="flex items-center gap-2 rounded-[10px] bg-volt px-3 py-2 text-sm font-bold text-ink transition hover:brightness-110"
          >
            <Share2 size={15} aria-hidden />
            <span className="hidden sm:inline">Share</span>
          </button>
        </div>
      </header>

      {shareError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 border-b border-cardred/50 bg-cardred/15 px-4 py-2 text-sm text-bone"
        >
          <span>{shareError}</span>
          <button
            type="button"
            onClick={() => setShareError(null)}
            className="font-semibold text-volt hover:underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ------------------------------------------------ main */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* viewport */}
        <div
          ref={viewportRef}
          className="relative order-1 h-[46dvh] shrink-0 lg:order-2 lg:h-auto lg:flex-1"
        >
          <JerseyViewer
            key={viewerKey}
            state={state}
            view={cameraView}
            autoRotate={autoRotate}
            background={background}
            registerSnapshot
            className="h-full w-full"
          />
          {/* floating viewport toolbar */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-smoke bg-carbon/90 p-1.5 backdrop-blur">
            {(['front', 'back'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setCameraView(v)}
                aria-pressed={cameraView === v}
                className={`rounded-full px-3.5 py-1.5 text-xs font-bold tracking-wide uppercase transition ${
                  cameraView === v ? 'bg-volt text-ink' : 'text-warmgray hover:text-bone'
                }`}
              >
                {v}
              </button>
            ))}
            <span className="h-5 w-px bg-smoke" aria-hidden />
            <button
              type="button"
              onClick={() => setAutoRotate(!autoRotate)}
              aria-pressed={autoRotate}
              aria-label="Toggle auto-rotate"
              className={`rounded-full p-1.5 transition ${autoRotate ? 'bg-volt text-ink' : 'text-warmgray hover:text-bone'}`}
            >
              <RotateCcw size={15} aria-hidden />
            </button>
            <button
              type="button"
              onClick={cycleBackground}
              aria-label={`Studio background: ${background}. Switch background`}
              className="rounded-full px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-warmgray uppercase transition hover:text-bone"
            >
              {background}
            </button>
            <button
              type="button"
              onClick={() => {
                setCameraView('front')
                setViewerKey((k) => k + 1)
              }}
              aria-label="Reset view"
              className="rounded-full px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-warmgray uppercase transition hover:text-bone"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void viewportRef.current?.requestFullscreen?.()}
              aria-label="Fullscreen"
              className="rounded-full p-1.5 text-warmgray transition hover:text-bone"
            >
              <Expand size={15} aria-hidden />
            </button>
          </div>
          <p className="sr-only">{description}</p>
        </div>

        {/* left: icon rail + one section panel at a time */}
        <section
          className="studio-sidebar order-2 flex min-h-0 flex-1 flex-col border-t border-smoke bg-carbon lg:order-1 lg:w-[392px] lg:flex-none lg:flex-row lg:border-t-0 lg:border-r"
          aria-label="Design controls"
        >
          <nav
            className="studio-nav flex flex-none gap-1 overflow-x-auto border-b border-smoke p-2 lg:w-[68px] lg:flex-col lg:gap-2 lg:overflow-visible lg:border-r lg:border-b-0 lg:px-1.5 lg:py-4"
            aria-label="Studio sections"
          >
            {SECTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                aria-pressed={activeTab === id}
                title={label}
                className={`studio-nav-item flex flex-none items-center gap-2 rounded-xl px-3 py-2 text-[10px] font-medium transition lg:flex-col lg:gap-2 lg:px-1 lg:py-3 lg:text-center ${
                  activeTab === id
                    ? 'studio-nav-active text-volt'
                    : 'text-warmgray hover:bg-white/5 hover:text-bone'
                }`}
              >
                <Icon size={19} aria-hidden />
                {label}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="studio-panel-header border-b border-smoke px-5 pt-5 pb-4">
              <p className="mb-1.5 text-[9px] font-medium tracking-[0.22em] text-warmgray uppercase">Kit customizer</p>
              <h2 className="font-display text-xl font-bold tracking-tight text-bone">
                {SECTIONS.find((s) => s.id === activeTab)?.label}
              </h2>
              <p className="mt-1.5 text-xs leading-relaxed text-warmgray">
                {SECTIONS.find((s) => s.id === activeTab)?.hint}
              </p>
            </div>
            <div className="ks-scroll min-h-0 flex-1 overflow-y-auto p-4 lg:p-5">
              {activeTab === 'design' && <DesignSection />}
              {activeTab === 'color' && <ColorSection />}
              {activeTab === 'pattern' && <PatternSection />}
              {activeTab === 'print' && <PrintTab />}
              {activeTab === 'logo' && <LogoSection />}
              {activeTab === 'roster' && <RosterTab />}
              {activeTab === 'summary' && <SummaryTab />}
            </div>
          </div>
        </section>

        {/* right rail */}
        <aside
          className="order-3 hidden w-[264px] flex-none overflow-y-auto border-l border-smoke bg-ink p-3 lg:block"
          aria-label="Price and summary"
        >
          <PriceCard />
        </aside>
      </main>
    </div>
  )
}
