import { useMemo, useState, type CSSProperties } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, FolderOpen, Trash2 } from 'lucide-react'
import { PRESETS } from '../lib/presets'
import { flatDataUrl } from '../lib/texture'
import { deleteMyDesign, loadMyDesigns, useKitStore } from '../lib/store'
import {
  PATTERN_LABELS,
  type Pattern,
  type SavedDesign,
} from '../lib/types'

function previewStyle(pattern: Pattern, primary: string, secondary: string): CSSProperties {
  switch (pattern) {
    case 'stripes':
      return { background: `repeating-linear-gradient(90deg, ${secondary} 0 12px, ${primary} 12px 24px)` }
    case 'hoops':
      return { background: `repeating-linear-gradient(0deg, ${secondary} 0 12px, ${primary} 12px 24px)` }
    case 'sash':
      return { background: `linear-gradient(118deg, ${primary} 0 38%, ${secondary} 38% 62%, ${primary} 62% 100%)` }
    case 'gradient':
      return { background: `linear-gradient(180deg, ${primary} 20%, ${secondary} 100%)` }
    case 'halves':
      return { background: `linear-gradient(90deg, ${primary} 0 50%, ${secondary} 50% 100%)` }
    case 'quarters':
      return {
        background: `conic-gradient(from 0deg at 50% 50%, ${secondary} 0 25%, ${primary} 0 50%, ${secondary} 0 75%, ${primary} 0 100%)`,
      }
    case 'chevron':
      return { background: `repeating-linear-gradient(135deg, ${secondary} 0 10px, ${primary} 10px 20px)` }
    case 'pinstripes':
      return { background: `repeating-linear-gradient(90deg, ${secondary} 0 4px, ${primary} 4px 18px)` }
    case 'yoke':
      return { background: `linear-gradient(180deg, ${secondary} 0 32%, ${primary} 32% 100%)` }
    case 'bias':
      return { background: `repeating-linear-gradient(45deg, ${secondary} 0 10px, ${primary} 10px 20px)` }
    case 'wave':
      return { background: `repeating-linear-gradient(0deg, ${secondary} 0 7px, ${primary} 7px 17px)` }
    case 'burst':
      return { background: `conic-gradient(from -90deg at 50% 20%, ${secondary} 0 20deg, ${primary} 20deg 45deg, ${secondary} 45deg 65deg, ${primary} 65deg 90deg, ${secondary} 90deg 110deg, ${primary} 110deg 135deg, ${secondary} 135deg 155deg, ${primary} 155deg 180deg, ${secondary} 180deg 200deg, ${primary} 200deg 225deg, ${secondary} 225deg 245deg, ${primary} 245deg 270deg, ${secondary} 270deg 290deg, ${primary} 290deg 315deg, ${secondary} 315deg 335deg, ${primary} 335deg 360deg)` }
    case 'grid':
      return { background: `repeating-linear-gradient(90deg, transparent 0 14px, ${secondary} 14px 16px), repeating-linear-gradient(0deg, ${primary} 0 16px, ${secondary} 16px 17px)` }
    default:
      return { background: primary }
  }
}

export default function Gallery() {
  const navigate = useNavigate()
  const loadState = useKitStore((s) => s.loadState)
  const applyPreset = useKitStore((s) => s.applyPreset)
  const showToast = useKitStore((s) => s.showToast)

  const initial = useMemo(loadMyDesigns, [])
  const [designs, setDesigns] = useState<SavedDesign[]>(initial.designs)
  const [corrupted] = useState(initial.corrupted)

  const open = (d: SavedDesign) => {
    loadState(structuredClone(d.state))
    navigate('/studio')
  }

  const remove = (id: string) => {
    setDesigns(deleteMyDesign(id))
    showToast('Design deleted from this device.', 'info')
  }

  return (
    <div className="min-h-dvh bg-ink text-bone">
      <header className="mx-auto flex max-w-6xl items-center gap-4 px-5 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-warmgray hover:text-bone">
          <ArrowLeft size={16} aria-hidden /> Home
        </Link>
        <h1 className="font-display text-2xl font-black tracking-tight uppercase">
          Gallery
        </h1>
      </header>

      <main className="mx-auto max-w-6xl space-y-12 px-5 pb-16">
        {/* My Designs — local to this device */}
        <section aria-labelledby="my-designs">
          <div className="mb-1 flex items-baseline gap-3">
            <h2 id="my-designs" className="font-display text-xl font-black uppercase">My Designs</h2>
            <span className="font-mono text-[11px] tracking-widest text-warmgray uppercase">
              Saved on this device only
            </span>
          </div>
          {corrupted && (
            <p role="alert" className="mb-4 rounded-xl border border-cardred/50 bg-cardred/10 px-4 py-3 text-sm">
              Some saved designs could not be read (corrupted local storage) and were skipped.
            </p>
          )}
          {designs.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-smoke p-8 text-center">
              <FolderOpen size={22} className="mx-auto text-warmgray" aria-hidden />
              <p className="mt-2 text-warmgray">Nothing saved yet. Design a kit and hit Save in the studio.</p>
              <Link to="/studio" className="mt-3 inline-block font-semibold text-volt hover:underline">
                Open the Studio →
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {designs.map((d) => (
                <article key={d.id} className="overflow-hidden rounded-2xl border border-smoke bg-carbon">
                  <img
                    src={flatDataUrl('front', d.state.design, d.state.print)}
                    alt={`Front of saved design ${d.state.name}`}
                    className="h-44 w-full bg-ink object-contain"
                  />
                  <div className="p-4">
                    <h3 className="font-display text-base font-bold">{d.state.name}</h3>
                    <p className="mt-0.5 text-xs text-warmgray">
                      {PATTERN_LABELS[d.state.design.pattern]} · {d.state.roster.length} players ·{' '}
                      {new Date(d.savedAt).toLocaleDateString('en-GB')}
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => open(d)}
                        className="flex-1 rounded-[10px] bg-volt px-3 py-2 text-sm font-bold text-ink transition hover:brightness-110"
                      >
                        Open in Studio
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(d.id)}
                        aria-label={`Delete saved design ${d.state.name}`}
                        className="rounded-[10px] border border-smoke px-2.5 text-warmgray transition hover:border-cardred hover:text-cardred"
                      >
                        <Trash2 size={15} aria-hidden />
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {/* Preset Gallery — bundled */}
        <section aria-labelledby="preset-gallery">
          <div className="mb-4 flex items-baseline gap-3">
            <h2 id="preset-gallery" className="font-display text-xl font-black uppercase">Preset Gallery</h2>
            <span className="font-mono text-[11px] tracking-widest text-warmgray uppercase">
              Bundled with KitStudio
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PRESETS.map((p) => (
              <article key={p.id} className="overflow-hidden rounded-2xl border border-smoke bg-carbon">
                <div
                  className="h-36"
                  style={previewStyle(p.design.pattern, p.design.colors.primary, p.design.colors.secondary)}
                  aria-hidden
                />
                <div className="p-4">
                  <h3 className="font-display text-base font-bold">{p.name}</h3>
                  <p className="mt-0.5 text-sm text-warmgray">{p.description}</p>
                  <button
                    type="button"
                    onClick={() => {
                      applyPreset(p.id)
                      navigate('/studio')
                    }}
                    className="mt-3 w-full rounded-[10px] border border-smoke bg-graphite px-3 py-2 text-sm font-semibold text-bone transition hover:border-volt hover:text-volt"
                  >
                    Use this preset
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}
