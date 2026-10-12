import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDown, ArrowUpRight, Check, ChevronDown, Layers, Palette, Rotate3D, Share2, Shirt, Sparkles, Users } from 'lucide-react'
import JerseyViewer from '../components/JerseyViewer'
import { MODELS, PRESETS, modelById } from '../lib/presets'
import { formatBDT, PRICING } from '../lib/pricing'
import { defaultState } from '../lib/store'
import { PATTERN_LABELS } from '../lib/types'
import './Landing.css'

const HERO_PRESETS = ['volt-fc', 'ember-united', 'forest-rovers']
const FEATURED = ['volt-fc', 'ember-united', 'forest-rovers', 'crimson-city', 'maroon-royals', 'ember-line', 'bias-kings', 'polo-classic']
const FITS = [{ id: 'all', label: 'All designs' }, { id: 'pro-slim', label: 'Pro Slim' }, { id: 'heritage-loose', label: 'Relaxed fit' }, { id: 'pro-long', label: 'Long sleeve' }]
const STEPS = [
  { n: '01', icon: Palette, title: 'Make it your own.', text: 'Choose a fit. Find your colors. Add a pattern, collar and crest that feel like your club.' },
  { n: '02', icon: Users, title: 'Bring the whole squad.', text: 'Give every player a name, number and size. Keep the entire roster with your design.' },
  { n: '03', icon: Share2, title: 'Get everyone on board.', text: 'Share one link for team approval. Save snapshots or export an editable design and order summary.' },
]

export default function Landing() {
  const [heroId, setHeroId] = useState(HERO_PRESETS[0])
  const [fit, setFit] = useState('all')
  const [showAll, setShowAll] = useState(false)
  const heroPreset = PRESETS.find(p => p.id === heroId)!
  const heroState = useMemo(() => {
    const s = defaultState()
    s.design = PRESETS.find(p => p.id === heroId)!.design
    s.print.enabled = false
    return s
  }, [heroId])
  const collection = PRESETS.filter(p => fit !== 'all' ? p.design.modelId === fit : showAll || FEATURED.includes(p.id))
  return (
    <div className="home">
      <header className="home-header">
        <div className="home-wrap home-nav">
          <Link className="home-brand" to="/" aria-label="KitStudio home"><span className="home-brand-mark">K</span> KIT<span>STUDIO</span></Link>
          <nav aria-label="Main navigation" className="home-nav-links">
            <a href="#collection">The collection</a><a href="#details">The studio</a><a href="#pricing">Team pricing</a><Link to="/gallery">My designs</Link>
          </nav>
          <Link to="/studio" className="home-nav-cta">Enter the studio <ArrowUpRight size={16} aria-hidden /></Link>
        </div>
      </header>

      <main>
        <section className="home-hero">
          <div className="home-wrap home-hero-grid">
            <div className="home-hero-copy">
              <p className="home-eyebrow"><span className="home-live-dot" /> THE KIT IS YOURS TO CREATE</p>
              <h1>Look like<br />a team.<br /><span>Play like you.</span></h1>
              <p className="home-hero-description">Your colors. Your crest. Your entire squad.<br />Build a match-ready look in our live 3D studio.</p>
              <div className="home-hero-actions">
                <Link to={`/studio?preset=${heroId}`} className="home-button home-button-volt">Create your kit <ArrowUpRight size={20} aria-hidden /></Link>
                <a href="#collection" className="home-text-link">Find your inspiration <ArrowDown size={16} aria-hidden /></a>
              </div>
              <div className="home-hero-benefits"><span><Check size={13} aria-hidden /> No account needed</span><span><Check size={13} aria-hidden /> Made for your whole team</span></div>
            </div>
            <div className="home-hero-product">
              <span className="home-product-watermark" aria-hidden>KIT<br />01</span>
              <div className="home-preview-label"><span><i /> LIVE 3D PREVIEW</span><span>DESIGNED BY YOU</span></div>
              <JerseyViewer state={heroState} view="front" autoRotate controlsEnabled background="ink" className="home-live-viewer" />
              <div className="home-product-caption"><span><Rotate3D size={16} aria-hidden /> Drag to explore</span><span>{heroPreset.name}<ArrowUpRight size={15} aria-hidden /></span></div>
              <div className="home-hero-presets" aria-label="Preview a kit">
                {HERO_PRESETS.map((id, i) => { const p = PRESETS.find(p => p.id === id)!; return <button type="button" key={id} onClick={() => setHeroId(id)} aria-pressed={heroId === id} className={heroId === id ? 'is-selected' : ''}><span className="home-preview-swatch" style={{ background: `linear-gradient(125deg, ${p.design.colors.primary} 50%, ${p.design.colors.secondary} 50%)` }} /><span><small>0{i + 1}</small>{p.name}</span></button> })}
              </div>
            </div>
          </div>
          <div className="home-wrap home-hero-bottom"><span>FROM YOUR FIRST IDEA TO THE WHOLE TEAM'S YES.</span><a href="#collection">Explore the collection <ArrowDown size={14} aria-hidden /></a></div>
        </section>

        <div className="home-ticker" aria-hidden><div>{[0, 1, 2].map(i => <span key={i}>YOUR COLORS <Sparkles size={20} /> YOUR CREST <Sparkles size={20} /> YOUR CLUB <Sparkles size={20} /> YOUR CALL <Sparkles size={20} /></span>)}</div></div>

        <section className="home-collection home-wrap" id="collection">
          <div className="home-section-heading">
            <div><p className="home-eyebrow">01 / THE STARTING LINEUP</p><h2>15 originals.<br /><span>Endless possibilities.</span></h2></div>
            <p>A little inspiration goes a long way. Start with a kit you love, then change every detail until it feels like yours.</p>
          </div>
          <div className="home-collection-toolbar"><div className="home-filter-list" aria-label="Filter collection by fit">{FITS.map(f => <button type="button" key={f.id} aria-pressed={fit === f.id} onClick={() => setFit(f.id)}>{f.label}{f.id === fit && <span className="home-filter-dot" />}</button>)}</div><span>{collection.length} designs to explore</span></div>
          <div className="home-kit-grid">
            {collection.map((p, i) => <Link key={p.id} to={`/studio?preset=${p.id}`} className="home-kit-card">
              <div className="home-kit-photo"><span className="home-kit-index">KS / {String(PRESETS.indexOf(p) + 1).padStart(2, '0')}</span>{p.design.modelId === 'pro-long' && <span className="home-kit-tag">LONG SLEEVE</span>}<img src={`/kits/${p.id}.webp`} width="600" height="620" alt={`${p.name} — ${modelById(p.design.modelId).name} jersey`} loading={i < 4 ? 'eager' : 'lazy'} decoding="async" /><span className="home-kit-hover">Make it yours <ArrowUpRight size={16} aria-hidden /></span></div>
              <div className="home-kit-info"><div><h3>{p.name}</h3><p>{PATTERN_LABELS[p.design.pattern]} <span>·</span> {p.design.modelId === 'heritage-loose' ? 'Relaxed fit' : p.design.modelId === 'pro-long' ? 'Long sleeve' : 'Pro Slim'}</p></div><span className="home-kit-arrow"><ArrowUpRight size={19} aria-hidden /></span></div>
              <div className="home-kit-colors" aria-hidden>{[p.design.colors.primary, p.design.colors.secondary, p.design.colors.sleeves, p.design.colors.trim].map((color, n) => <span key={n} style={{backgroundColor: color}} />)}<span className="home-kit-custom">FULLY CUSTOMIZABLE</span></div>
            </Link>)}
          </div>
          {fit === 'all' && <div className="home-collection-more"><button type="button" className="home-button home-button-outline" onClick={() => setShowAll(!showAll)}>{showAll ? 'Show the featured lineup' : 'Explore all 15 designs'}<ChevronDown size={17} className={showAll ? 'home-rotate' : ''} aria-hidden /></button><span>Every design opens in the live studio.</span></div>}
        </section>

        <section className="home-detail-section" id="details">
          <div className="home-wrap home-details-grid">
            <div className="home-detail-art"><span className="home-art-label">THE FINISHING TOUCHES</span><img src="/kits/personalization.webp" alt="Williams number 7 printed on the back of a custom jersey" width="600" height="620" loading="lazy" /><div className="home-name-tag"><span>PLAYER NAME</span><strong>WILLIAMS</strong><Check size={16} aria-hidden /></div><div className="home-number-tag"><span>SQUAD NUMBER</span><strong>07</strong><span className="home-number-tag-note">Make your mark.</span></div></div>
            <div className="home-detail-copy"><p className="home-eyebrow">02 / BUILT AROUND YOUR CLUB</p><h2>Every detail.<br /><span>All yours.</span></h2><p>From the first stripe to the last squad number, you’re in control. See every choice come together on a jersey you can turn, zoom and make your own.</p><div className="home-detail-features">
              <div><Palette size={20} aria-hidden /><span><strong>A palette with no limits</strong><small>Separate colors for the body, sleeves and trim.</small></span></div>
              <div><Layers size={20} aria-hidden /><span><strong>The feel. The fit. The finish.</strong><small>14 patterns, 4 collars, 4 fabrics and 3 fits.</small></span></div>
              <div><Shirt size={20} aria-hidden /><span><strong>A kit for every name on the team</strong><small>Your crest, player names, numbers and a full roster.</small></span></div>
            </div><Link to="/studio" className="home-button home-button-volt">Take it for a spin <ArrowUpRight size={18} aria-hidden /></Link></div>
          </div>
        </section>

        <section id="models" className="home-models home-wrap">
          <div className="home-section-heading"><div><p className="home-eyebrow">03 / FIND YOUR FIT</p><h2>One team.<br /><span>Three ways to wear it.</span></h2></div><p>Match-day slim, a relaxed classic or full-length sleeves. Start with the silhouette that suits your squad.</p></div>
          <div className="home-model-grid">{MODELS.map((m, i) => { const p = PRESETS.find(p => p.design.modelId === m.id)!; return <Link to={`/studio?preset=${p.id}`} key={m.id} className="home-model-card"><div className="home-model-photo"><span>0{i + 1}</span><img src={`/kits/${p.id}.webp`} width="600" height="620" alt={`${m.name} fit`} loading="lazy" /></div><div className="home-model-info"><h3>{m.name}<ArrowUpRight size={20} aria-hidden /></h3><p>{m.description}</p><span>{m.priceDelta ? `+${formatBDT(m.priceDelta)} / kit` : 'Included in the base price'}</span></div></Link> })}</div>
        </section>

        <section className="home-process"><div className="home-wrap"><div className="home-process-heading"><p className="home-eyebrow">THE GAME PLAN</p><h2>From “what if”<br />to <span>“that’s our kit.”</span></h2><p>Three steps. One shared vision.</p></div><ol className="home-step-grid">{STEPS.map(step => <li key={step.n}><div className="home-step-top"><span>{step.n}</span><step.icon size={22} aria-hidden /></div><h3>{step.title}</h3><p>{step.text}</p></li>)}</ol></div></section>

        <section id="pricing" className="home-pricing"><div className="home-wrap"><div className="home-section-heading"><div><p className="home-eyebrow">04 / FOR THE WHOLE SQUAD</p><h2>More players.<br /><span>Better value.</span></h2></div><p>Build your roster and see the team total in the Studio. The price per kit drops as your squad grows.</p></div><div className="home-price-grid">{PRICING.tiers.map((tier, i) => <div key={tier.min} className={`home-price-card ${i === 3 ? 'home-price-best' : ''}`}><div><span>{tier.min}–{tier.max} players</span>{i === 3 && <span className="home-best-badge">BEST VALUE</span>}</div><strong>{formatBDT(tier.base)}<small>/ kit</small></strong><p>{i === 3 ? `Save ${formatBDT(PRICING.tiers[0].base - tier.base)} per kit` : 'Base jersey price'}</p></div>)}</div><div className="home-price-notes"><p>Personalize it: name & number +{formatBDT(PRICING.printAddon)} · long sleeve +{formatBDT(modelById('pro-long').priceDelta)} · polo collar +{formatBDT(PRICING.poloCollarAddon)} per kit.</p><p>{PRICING.disclaimer}</p></div></div></section>

        <section className="home-final"><div className="home-wrap"><p className="home-eyebrow">YOUR CLUB. YOUR NEXT CHAPTER.</p><h2>Your next kit<br />starts <span>right here.</span></h2><Link to="/studio" className="home-button home-button-dark">Let's make your kit <ArrowUpRight size={22} aria-hidden /></Link><p>No account. No checkout. Just your next great idea.</p></div></section>
      </main>
      <footer className="home-footer"><div className="home-wrap"><Link className="home-brand" to="/" aria-label="KitStudio home"><span className="home-brand-mark">K</span> KIT<span>STUDIO</span></Link><span>MADE FOR THE TEAM. DESIGNED BY YOU.</span><nav aria-label="Footer navigation"><Link to="/gallery">My designs <ArrowUpRight size={12} aria-hidden /></Link><Link to="/studio">Open studio <ArrowUpRight size={12} aria-hidden /></Link></nav></div></footer>
    </div>
  )
}



