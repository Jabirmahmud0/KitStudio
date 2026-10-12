import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, PenLine } from 'lucide-react'
import JerseyViewer from '../components/JerseyViewer'
import { formatBDT, quote, PRICING } from '../lib/pricing'
import { modelById } from '../lib/presets'
import { decodeShare } from '../lib/share'
import { defaultState, useKitStore, type CameraView } from '../lib/store'
import { PATTERN_LABELS, type SharedDesignV1 } from '../lib/types'

/**
 * Approval Preview (PRD §1.7) — the read-only share view: design,
 * optional roster and illustrative total. No editing controls.
 */
export default function Approval() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const loadState = useKitStore((s) => s.loadState)
  const [view, setView] = useState<CameraView>('front')

  const { state, error } = useMemo((): { state: SharedDesignV1; error: string | null } => {
    const d = searchParams.get('d')
    if (!d) return { state: defaultState(), error: 'No design was included in this link — showing the default kit.' }
    const result = decodeShare(d)
    if (result.ok) return { state: result.state, error: null }
    return { state: defaultState(), error: result.error }
  }, [searchParams])

  const q = quote(state)

  const openInStudio = () => {
    loadState(structuredClone(state))
    navigate('/studio')
  }

  return (
    <div className="min-h-dvh bg-ink text-bone">
      <header className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-5 py-5">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-warmgray hover:text-bone">
          <ArrowLeft size={16} aria-hidden /> KitStudio
        </Link>
        <span className="rounded-full border border-volt/60 px-3 py-1 font-mono text-[11px] tracking-[0.16em] text-volt uppercase">
          Approval Preview · Read-only
        </span>
        <button
          type="button"
          onClick={openInStudio}
          className="ml-auto flex items-center gap-2 rounded-full bg-volt px-4 py-2 text-sm font-bold text-ink transition hover:brightness-110"
        >
          <PenLine size={15} aria-hidden /> Open in Studio
        </button>
      </header>

      {error && (
        <div className="mx-auto max-w-6xl px-5">
          <p role="alert" className="rounded-xl border border-cardred/50 bg-cardred/10 px-4 py-3 text-sm">
            {error}
          </p>
        </div>
      )}

      <main className="mx-auto grid max-w-6xl gap-6 px-5 pb-16 lg:grid-cols-[1.4fr_1fr]">
        <section aria-label="3D design preview">
          <div className="relative overflow-hidden rounded-3xl border border-smoke">
            <JerseyViewer
              state={state}
              view={view}
              background="spotlight"
              className="h-[480px] w-full"
            />
            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full border border-smoke bg-carbon/90 p-1.5 backdrop-blur">
              {(['front', 'back'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold tracking-wide uppercase ${view === v ? 'bg-volt text-ink' : 'text-warmgray hover:text-bone'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
          <p className="mt-3 text-center text-sm text-warmgray">
            Drag to orbit. This view can&rsquo;t be edited — open it in the Studio to make a copy.
          </p>
        </section>

        <section className="space-y-5" aria-label="Design summary">
          <div>
            <h1 className="font-display text-3xl font-black tracking-tight uppercase">{state.name}</h1>
            <p className="mt-1 text-warmgray">
              {modelById(state.design.modelId).name} · {PATTERN_LABELS[state.design.pattern]} · {state.design.finish} finish · {state.design.collar} collar · {state.design.fabric} fabric
            </p>
          </div>

          <dl className="space-y-2 rounded-2xl border border-smoke bg-carbon p-4 text-sm">
            {(Object.entries(state.design.colors) as [string, string][]).map(([zone, hex]) => (
              <div key={zone} className="flex items-center justify-between">
                <dt className="text-warmgray capitalize">{zone}</dt>
                <dd className="flex items-center gap-2 font-mono text-xs uppercase">
                  <span className="h-3.5 w-3.5 rounded-full border border-smoke" style={{ background: hex }} aria-hidden />
                  {hex}
                </dd>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-smoke pt-2">
              <dt className="text-warmgray">Back print</dt>
              <dd className="font-medium">
                {state.print.enabled
                  ? `${state.print.playerName || '—'} · #${state.print.number} · ${state.print.font === 'block' ? 'Classic Block' : 'Modern Slim'}`
                  : 'None'}
              </dd>
            </div>
          </dl>

          {state.roster.length > 0 ? (
            <div className="rounded-2xl border border-smoke bg-carbon p-4">
              <h2 className="mb-3 font-mono text-[11px] tracking-[0.18em] text-warmgray uppercase">
                Roster · {state.roster.length} players
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left font-mono text-[11px] tracking-widest text-warmgray uppercase">
                    <th className="pb-2">Player</th>
                    <th className="pb-2">No.</th>
                    <th className="pb-2">Size</th>
                  </tr>
                </thead>
                <tbody>
                  {state.roster.map((r, i) => (
                    <tr key={i} className="border-t border-smoke">
                      <td className="py-1.5 font-semibold">{r.name || '—'}</td>
                      <td className="py-1.5 font-mono">{r.number}</td>
                      <td className="py-1.5 font-mono">{r.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-smoke p-4 text-sm text-warmgray">
              Single kit — no team roster attached.
            </p>
          )}

          <div className="space-y-1 rounded-2xl bg-graphite p-4 font-mono text-sm">
            <div className="flex justify-between text-warmgray">
              <span>Per kit ({q.tier.min}–{q.tier.max} tier)</span>
              <span className="text-bone">{formatBDT(q.perKit)}</span>
            </div>
            <div className="flex justify-between text-warmgray">
              <span>Quantity</span>
              <span className="text-bone">{q.quantity}</span>
            </div>
            <div className="flex justify-between border-t border-smoke pt-2 text-base">
              <span className="text-bone">Team total</span>
              <span className="font-bold text-volt">{formatBDT(q.total)}</span>
            </div>
            <p className="pt-2 font-body text-xs text-warmgray italic">{PRICING.disclaimer}</p>
          </div>
        </section>
      </main>
    </div>
  )
}
