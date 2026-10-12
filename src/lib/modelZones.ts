/**
 * KitStudio — semantic model adapter for the Pro Slim GLB (PRD §6.3).
 *
 * The GLB is a single sculpted mesh with one UV space. The design
 * config stays semantic (colors.primary / .secondary / .sleeves /
 * .trim, print.*, pattern, finish); this module derives the model's
 * zone masks by classifying its triangles from geometry + normals:
 *
 *   front / back — torso panels (by vertex normals)
 *   sleeves      — |x| beyond the shoulder seam
 *   cuff         — outer sleeve ends        → Trim zone
 *   collar       — neck ring                → Trim zone
 *   hem          — bottom band              → Trim zone
 *   side         — torso side strips        → Trim zone (PRD §5.5)
 *
 * Masks are rasterized once per geometry into canvases in UV space
 * and cached. Print rectangles are computed from the central back
 * panel triangles, so name/number placement follows the real UVs.
 */
import * as THREE from 'three'

export const TEX_SIZE = 1536

export type ZoneId =
  | 'front'
  | 'back'
  | 'sleeves'
  | 'cuff'
  | 'collar'
  | 'hem'
  | 'side'

export interface UVRect {
  minU: number
  maxU: number
  minV: number
  maxV: number
}

/** Affine garment→UV fit for one island: u = a·x + b, v = c·y + d. */
export interface IslandAffine {
  a: number
  b: number
  c: number
  d: number
}

/** Sleeve island fit: u ≈ a·|x| + b along the arm, plus its v extent
 * and the v of its front-most line (logo placement). */
export interface SleeveFit {
  a: number
  b: number
  minV: number
  maxV: number
  frontV: number
}

export interface ModelZones {
  masks: Record<ZoneId, HTMLCanvasElement>
  torsoMask: HTMLCanvasElement
  /** Central back panel (flat print area) in UV units. */
  backPrintRect: UVRect
  /** Whole torso extent in UV units (pattern scaling). */
  torsoRect: UVRect
  /** Full front island extent in UV units. */
  frontRect: UVRect
  /** Full back island extent in UV units. */
  backRect: UVRect
  /** Garment-space → UV affine fits, from central panel vertices. */
  frontAffine: IslandAffine
  backAffine: IslandAffine
  /** Per-sleeve UV fits for sleeve bands and sleeve logos. */
  sleeveFits: { left: SleeveFit; right: SleeveFit }
}

type VZone = 'front' | 'back' | 'sleeves' | 'cuff' | 'collar' | 'hem'

/** Classify a triangle from its vertices — smoother zone boundaries. */
function classifyTriangle(
  xs: number[],
  ys: number[],
  zs: number[],
  cnz: number,
  cuv: number,
): VZone {
  const cx = (xs[0] + xs[1] + xs[2]) / 3
  const cy = (ys[0] + ys[1] + ys[2]) / 3
  const cz = (zs[0] + zs[1] + zs[2]) / 3
  const acx = Math.abs(cx)
  const minAx = Math.min(...xs.map(Math.abs))
  // Cuff: only triangles fully out at the sleeve end.
  if (minAx > 0.252 && cy > -0.06) return 'cuff'
  if (acx > 0.183 && cy > -0.03) return 'sleeves'
  // Axis test (same math as the model variants): sleeve material
  // hugs the arm axis — shoulder cap, inner sleeve wall and
  // underarm gusset included; the torso sits far off-axis.
  if (acx > 0.1) {
    const side = cx >= 0 ? 1 : -1
    const rx = cx - side * 0.185
    const ry = cy - 0.095
    const rz = cz + 0.03
    const dC = rx * side * 0.738 + ry * -0.651 + rz * 0.174
    const prx = rx - side * 0.738 * dC
    const pry = ry - -0.651 * dC
    const prz = rz - 0.174 * dC
    const radial = Math.hypot(prx, pry, prz)
    if (dC > -0.03 && dC < 0.14 && radial < 0.115) return 'sleeves'
  }
  // NOTE: no "reaching vertex" fallback here — torso-side
  // triangles that merely touch |x| 0.19+ must stay body-coloured,
  // or the long sleeve exposes them as a stray painted sheet
  // behind the arm (measured: radial ≈ 0.18, barely moved).
  // Collar: the neck rib is its own UV island (v > 0.85) — classify by
  // island + neck position so only the true rib band is Trim.
  if (cy > 0.185 && acx < 0.1 && cuv > 0.85) return 'collar'
  return cnz >= 0 ? 'front' : 'back'
}

/** Least-squares linear fit y ≈ m·x + b. */
function linFit(pts: [number, number][]): { m: number; b: number } {
  const n = pts.length
  const mx = pts.reduce((s, p) => s + p[0], 0) / n
  const my = pts.reduce((s, p) => s + p[1], 0) / n
  let num = 0
  let den = 0
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my)
    den += (x - mx) * (x - mx)
  }
  const m = den === 0 ? 0 : num / den
  return { m, b: my - m * mx }
}

const cache = new WeakMap<THREE.BufferGeometry, ModelZones>()

export function computeModelZones(geometry: THREE.BufferGeometry): ModelZones {
  const hit = cache.get(geometry)
  if (hit) return hit

  const pos = geometry.attributes.position
  const nor = geometry.attributes.normal
  const uv = geometry.attributes.uv
  const index = geometry.index
  if (!pos || !uv || !index) {
    throw new Error('Pro Slim geometry is missing position/uv/index')
  }

  const S = TEX_SIZE
  const zones: ZoneId[] = ['front', 'back', 'sleeves', 'cuff', 'collar', 'hem', 'side']
  const masks = {} as Record<ZoneId, HTMLCanvasElement>
  const ctxs = {} as Record<ZoneId, CanvasRenderingContext2D>
  for (const z of zones) {
    const c = document.createElement('canvas')
    c.width = S
    c.height = S
    masks[z] = c
    ctxs[z] = c.getContext('2d')!
    ctxs[z].fillStyle = '#fff'
  }

  const backRect: UVRect = { minU: 1, maxU: 0, minV: 1, maxV: 0 }
  const torsoRect: UVRect = { minU: 1, maxU: 0, minV: 1, maxV: 0 }
  const frontIsland: UVRect = { minU: 1, maxU: 0, minV: 1, maxV: 0 }
  const backIsland: UVRect = { minU: 1, maxU: 0, minV: 1, maxV: 0 }
  const grow = (r: UVRect, u: number, v: number) => {
    r.minU = Math.min(r.minU, u)
    r.maxU = Math.max(r.maxU, u)
    r.minV = Math.min(r.minV, v)
    r.maxV = Math.max(r.maxV, v)
  }

  // Garment→UV affine fits from central panel vertices.
  const fU: [number, number][] = []
  const fV: [number, number][] = []
  const bU: [number, number][] = []
  const bV: [number, number][] = []
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    if (Math.abs(x) > 0.13) continue
    const nz = nor ? nor.getZ(i) : pos.getZ(i)
    const y = pos.getY(i)
    if (y < -0.3 || y > 0.2) continue
    if (nz >= 0) {
      fU.push([x, uv.getX(i)])
      fV.push([y, uv.getY(i)])
    } else {
      bU.push([x, uv.getX(i)])
      bV.push([y, uv.getY(i)])
    }
  }
  const fu = linFit(fU)
  const fv = linFit(fV)
  const bu = linFit(bU)
  const bv = linFit(bV)
  const frontAffine: IslandAffine = { a: fu.m, b: fu.b, c: fv.m, d: fv.b }
  const backAffine: IslandAffine = { a: bu.m, b: bu.b, c: bv.m, d: bv.b }

  // Sleeve fits: u as a function of distance along the arm (|x|),
  // per side, from sleeve vertices; frontV from the front-most
  // mid-arm vertex (where a sleeve logo would sit).
  const sleeveFits = {} as { left: SleeveFit; right: SleeveFit }
  for (const side of ['left', 'right'] as const) {
    const pts: [number, number][] = []
    let frontV = 0.88
    let bestZ = -Infinity
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const y = pos.getY(i)
      if (Math.abs(x) < 0.183 || y < -0.04) continue
      if ((x > 0) !== (side === 'right')) continue
      pts.push([Math.abs(x), uv.getX(i)])
      if (Math.abs(x) > 0.2 && Math.abs(x) < 0.26 && pos.getZ(i) > bestZ) {
        bestZ = pos.getZ(i)
        frontV = uv.getY(i)
      }
    }
    const fit = linFit(pts)
    sleeveFits[side] = { a: fit.m, b: fit.b, minV: 1, maxV: 0, frontV }
  }

  // Print rect: the flat central back panel in garment space, mapped
  // through the back affine — self-consistent with the fit, unlike a
  // raw triangle bbox (the island wraps and includes rib islands).
  {
    const us: number[] = []
    const vs: number[] = []
    for (const gx of [-0.115, 0.115]) {
      for (const gy of [-0.28, 0.21]) {
        us.push(backAffine.a * gx + backAffine.b)
        vs.push(backAffine.c * gy + backAffine.d)
      }
    }
    backRect.minU = Math.min(...us)
    backRect.maxU = Math.max(...us)
    backRect.minV = Math.min(...vs)
    backRect.maxV = Math.max(...vs)
  }

  const triCount = index.count / 3
  for (let t = 0; t < triCount; t++) {
    const ia = index.getX(t * 3)
    const ib = index.getX(t * 3 + 1)
    const ic = index.getX(t * 3 + 2)
    const idxs = [ia, ib, ic]
    const xs = idxs.map((i) => pos.getX(i))
    const ys = idxs.map((i) => pos.getY(i))
    const zs = idxs.map((i) => pos.getZ(i))
    const cnz =
      ((nor ? nor.getZ(ia) : pos.getZ(ia)) +
        (nor ? nor.getZ(ib) : pos.getZ(ib)) +
        (nor ? nor.getZ(ic) : pos.getZ(ic))) /
      3

    const cuv = (uv.getY(ia) + uv.getY(ib) + uv.getY(ic)) / 3
    const zone: ZoneId = classifyTriangle(xs, ys, zs, cnz, cuv)
    // Side panels and the hem band are painted as smooth affine-space
    // layers in texture.ts (Trim zone, PRD §5.5), not triangle masks —
    // so torso triangles stay front/back here.

    const ctx = ctxs[zone]
    ctx.beginPath()
    idxs.forEach((i, k) => {
      const u = uv.getX(i) * S
      const v = uv.getY(i) * S
      if (k === 0) ctx.moveTo(u, v)
      else ctx.lineTo(u, v)
    })
    ctx.closePath()
    ctx.fill()

    if (zone === 'sleeves' || zone === 'cuff') {
      const triCx = (xs[0] + xs[1] + xs[2]) / 3
      const fit = sleeveFits[triCx >= 0 ? 'right' : 'left']
      for (const i of idxs) {
        fit.minV = Math.min(fit.minV, uv.getY(i))
        fit.maxV = Math.max(fit.maxV, uv.getY(i))
      }
    }
    if (zone === 'front' || zone === 'back') {
      for (const i of idxs) grow(torsoRect, uv.getX(i), uv.getY(i))
    }
    if (zone === 'front') for (const i of idxs) grow(frontIsland, uv.getX(i), uv.getY(i))
    if (zone === 'back') for (const i of idxs) grow(backIsland, uv.getX(i), uv.getY(i))
  }

  // Feather every mask: zone seams then crossfade over a few
  // texels on the garment instead of stair-stepping along
  // triangle edges (very visible on the shoulder seam).
  for (const z of zones) {
    const c = masks[z]
    const cctx = c.getContext('2d')!
    try {
      cctx.filter = 'blur(3px)'
      cctx.drawImage(c, 0, 0)
      cctx.filter = 'none'
    } catch {
      /* filter unsupported — hard edges are acceptable */
    }
  }

  // The sleeves mask gets a stronger treatment: a hard blur plus
  // an alpha re-threshold moves its boundary onto the smooth
  // mid-contour of the blurred field, so the armhole seam reads
  // as one clean curve instead of a triangle-by-triangle zigzag.
  {
    const c = masks.sleeves
    const cctx = c.getContext('2d')!
    try {
      cctx.filter = 'blur(9px)'
      cctx.drawImage(c, 0, 0)
      cctx.filter = 'none'
      const img = cctx.getImageData(0, 0, c.width, c.height)
      const px = img.data
      for (let i = 3; i < px.length; i += 4) {
        const a = px[i]
        px[i] =
          a <= 90 ? 0 : a >= 165 ? 255 : Math.round(((a - 90) / 75) * 255)
      }
      cctx.putImageData(img, 0, 0)
    } catch {
      /* filter/ImageData unavailable — feathered mask still applies */
    }
  }

  // Union of front + back for pattern clipping (side strips are Trim).
  const torsoMask = document.createElement('canvas')
  torsoMask.width = S
  torsoMask.height = S
  const tctx = torsoMask.getContext('2d')!
  tctx.drawImage(masks.front, 0, 0)
  tctx.drawImage(masks.back, 0, 0)

  const zonesOut: ModelZones = {
    masks,
    torsoMask,
    backPrintRect: backRect,
    torsoRect,
    frontRect: frontIsland,
    backRect: backIsland,
    frontAffine,
    backAffine,
    sleeveFits,
  }
  cache.set(geometry, zonesOut)
  return zonesOut
}
