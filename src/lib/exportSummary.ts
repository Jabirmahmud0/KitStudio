/**
 * Lightweight v1 order-summary export (PRD §5.8) — a self-contained
 * HTML approval artifact: design name/date, front & back previews,
 * design choices, roster with sizes, tiered pricing and the
 * illustrative-pricing disclaimer. Not a manufacturing file.
 */
import { formatBDT, quote, PRICING } from './pricing'
import { modelById } from './presets'
import { flatDataUrl } from './texture'
import { PATTERN_LABELS, type SharedDesignV1 } from './types'

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function exportOrderSummary(state: SharedDesignV1) {
  const q = quote(state)
  const front = flatDataUrl('front', state.design, state.print)
  const back = flatDataUrl('back', state.design, state.print)
  const date = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const rosterRows =
    state.roster.length > 0
      ? state.roster
          .map(
            (r, i) =>
              `<tr><td>${i + 1}</td><td>${esc(r.name) || '—'}</td><td>${r.number}</td><td>${r.size}</td></tr>`,
          )
          .join('')
      : '<tr><td colspan="4">No roster — single kit</td></tr>'

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>${esc(state.name)} — KitStudio order summary</title>
<style>
  body{font-family:Inter,system-ui,sans-serif;background:#f4f1ea;color:#101010;margin:0;padding:40px}
  .wrap{max-width:820px;margin:0 auto;background:#fff;border:1px solid #e3ddcf;border-radius:16px;padding:36px}
  h1{font-family:Archivo,sans-serif;font-weight:900;text-transform:uppercase;letter-spacing:-.01em;margin:0 0 4px}
  .meta{color:#8a8578;font-size:13px;margin-bottom:24px}
  .previews{display:flex;gap:16px;flex-wrap:wrap}
  .previews figure{margin:0;flex:1;min-width:240px;text-align:center}
  .previews img{width:100%;border-radius:12px;background:#101010}
  figcaption{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#8a8578;margin-top:8px}
  table{width:100%;border-collapse:collapse;margin-top:12px;font-size:14px}
  th,td{border-bottom:1px solid #e3ddcf;padding:8px 6px;text-align:left}
  th{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#8a8578}
  .totals{margin-top:20px;font-family:"JetBrains Mono",monospace;font-size:14px}
  .totals div{display:flex;justify-content:space-between;padding:4px 0}
  .grand{font-size:18px;font-weight:700;border-top:2px solid #101010;margin-top:8px;padding-top:10px}
  .disclaimer{margin-top:24px;background:#f4f1ea;border-radius:10px;padding:12px 14px;font-size:13px;color:#5c574c}
  .sw{display:inline-block;width:12px;height:12px;border-radius:999px;border:1px solid #ccc;vertical-align:-1px;margin-right:6px}
</style></head>
<body><div class="wrap">
  <h1>${esc(state.name)}</h1>
  <div class="meta">KitStudio order summary · ${date} · Model: ${modelById(state.design.modelId).name} · Pattern: ${PATTERN_LABELS[state.design.pattern]} · Finish: ${state.design.finish} · Collar: ${state.design.collar} · Fabric: ${state.design.fabric}</div>
  <div class="previews">
    <figure><img src="${front}" alt="Front of jersey"><figcaption>Front</figcaption></figure>
    <figure><img src="${back}" alt="Back of jersey"><figcaption>Back</figcaption></figure>
  </div>
  <h2 style="margin-top:28px">Design</h2>
  <p>
    <span class="sw" style="background:${state.design.colors.primary}"></span>Primary ${state.design.colors.primary} ·
    <span class="sw" style="background:${state.design.colors.secondary}"></span>Secondary ${state.design.colors.secondary} ·
    <span class="sw" style="background:${state.design.colors.sleeves}"></span>Sleeves ${state.design.colors.sleeves} ·
    <span class="sw" style="background:${state.design.colors.trim}"></span>Trim ${state.design.colors.trim}
  </p>
  <p>Back print: ${state.print.enabled ? `${esc(state.print.playerName) || '(no name)'} · #${state.print.number} · ${state.print.font === 'block' ? 'Classic Block' : 'Modern Slim'} · ${state.print.color}` : 'None'}</p>
  <h2 style="margin-top:28px">Roster</h2>
  <table><thead><tr><th>#</th><th>Player</th><th>Number</th><th>Size</th></tr></thead><tbody>${rosterRows}</tbody></table>
  <div class="totals">
    <div><span>Quantity</span><span>${q.quantity} kit${q.quantity === 1 ? '' : 's'}</span></div>
    <div><span>Base per kit (${q.tier.min}–${q.tier.max} tier)</span><span>${formatBDT(q.basePerKit)}</span></div>
    ${q.modelAddonPerKit > 0 ? `<div><span>Model per kit (${modelById(state.design.modelId).name})</span><span>${formatBDT(q.modelAddonPerKit)}</span></div>` : ''}
    ${q.collarAddonPerKit > 0 ? `<div><span>Polo collar per kit</span><span>${formatBDT(q.collarAddonPerKit)}</span></div>` : ''}
    <div><span>Print per kit</span><span>${formatBDT(q.printAddonPerKit)}</span></div>
    <div><span>Per kit</span><span>${formatBDT(q.perKit)}</span></div>
    <div class="grand"><span>Team total</span><span>${formatBDT(q.total)}</span></div>
  </div>
  <p class="disclaimer">${PRICING.disclaimer}</p>
</div></body></html>`

  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${state.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'kit'}-order-summary.html`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
