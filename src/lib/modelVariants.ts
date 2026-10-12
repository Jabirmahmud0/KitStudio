import * as THREE from 'three'
import { LONG_MODEL_ID, LOOSE_MODEL_ID } from './presets'

const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
const smooth = (t: number) => t * t * (3 - 2 * t)

export function transformGarmentGeometry(geo: THREE.BufferGeometry, modelId: string): boolean {
  if (modelId !== LOOSE_MODEL_ID) return false
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const drop = clamp01((-y + 0.05) / 0.42)
    pos.setXYZ(i, x * (1.05 + 0.11 * drop), y - 0.018 * drop, z * 1.12)
  }
  return true
}

export interface SleeveParts {
  sleeve: THREE.BufferGeometry
  cuff: THREE.BufferGeometry
}

// Replace the entire short sleeve at the shoulder. All vertices farther
// outboard than this plane belong to the arm, including the old cuff fold.
// One continuous loft now runs from this armhole to the wrist.
export const LONG_SLEEVE_SHOULDER_X = 0.155
// The original cuff opening reaches inboard to |x| = 0.160. The old
// 0.175 cut left its inner lip attached beneath the armpit. Move the
// armhole inside that entire opening, easing back out below the underarm
// so the torso and hem keep their original width.
export const longSleeveCutX = (y: number) =>
  THREE.MathUtils.lerp(0.175, LONG_SLEEVE_SHOULDER_X, smooth(clamp01((y + 0.08) / 0.055)))
const armAxis = (side: number) => new THREE.Vector3(side, 0, 0)
const cutDistance = (p: number[], side: number) => longSleeveCutX(p[1]) - side * p[0]
const CUFF_START = 0.875
const keyOf = (p: THREE.Vector3) => `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)},${Math.round(p.z * 1e6)}`

/** Relax the baked underarm pleats before making the new armhole. Work on
 * welded positions so UV seams cannot separate. Keep X fixed so none of the
 * old cuff opening can migrate inside the cut and survive as a loose lip. */
function relaxUnderarms(geo: THREE.BufferGeometry) {
  const p = geo.getAttribute('position')
  const groups = new Map<string, number>()
  const ids: number[] = [], points: THREE.Vector3[] = [], adjacent: Set<number>[] = []
  for (let i = 0; i < p.count; i++) {
    const point = new THREE.Vector3().fromBufferAttribute(p, i)
    const key = keyOf(point)
    let id = groups.get(key)
    if (id === undefined) {
      id = points.length; groups.set(key, id); points.push(point); adjacent.push(new Set())
    }
    ids.push(id)
  }
  const index = geo.index
  for (let i = 0; i < (index?.count ?? p.count); i += 3) {
    const tri = [0, 1, 2].map(k => ids[index ? index.getX(i + k) : i + k])
    for (let k = 0; k < 3; k++) {
      adjacent[tri[k]].add(tri[(k + 1) % 3])
      adjacent[tri[k]].add(tri[(k + 2) % 3])
    }
  }
  const weights = points.map(v => smooth(clamp01((Math.abs(v.x) - 0.115) / 0.025))
    * smooth(clamp01((v.y + 0.08) / 0.05)) * (1 - smooth(clamp01((v.y - 0.025) / 0.09))))
  for (let pass = 0; pass < 28; pass++) {
    const next = points.map((v, i) => {
      if (!weights[i] || !adjacent[i].size) return v.clone()
      const mean = new THREE.Vector3()
      for (const n of adjacent[i]) mean.add(points[n])
      mean.divideScalar(adjacent[i].size)
      return new THREE.Vector3(v.x, THREE.MathUtils.lerp(v.y, mean.y, weights[i] * 0.5),
        THREE.MathUtils.lerp(v.z, mean.z, weights[i] * 0.5))
    })
    points.splice(0, points.length, ...next)
  }
  for (let i = 0; i < p.count; i++) p.setXYZ(i, points[ids[i]].x, points[ids[i]].y, points[ids[i]].z)
  geo.computeVertexNormals()
  const normals = geo.getAttribute('normal')
  const weldedNormals = points.map(() => new THREE.Vector3())
  for (let i = 0; i < p.count; i++) weldedNormals[ids[i]].add(new THREE.Vector3().fromBufferAttribute(normals, i))
  for (let i = 0; i < p.count; i++) {
    const n = weldedNormals[ids[i]].clone().normalize()
    normals.setXYZ(i, n.x, n.y, n.z)
  }
}

export function buildSleeveParts(geo: THREE.BufferGeometry): SleeveParts[] {
  // Sew tiny disconnected source seams before
  // regularization enlarges them. Garment neck/hem openings remain open.
  const originalPositions = geo.getAttribute('position')
  const originalIndices = geo.index ? Array.from(geo.index.array) : Array.from({ length: originalPositions.count }, (_, i) => i)
  const vertexKeys = Array.from({ length: originalPositions.count }, (_, i) => keyOf(new THREE.Vector3().fromBufferAttribute(originalPositions, i)))
  const edges = new Map<string, { a: number; b: number; count: number }>()
  for (let i = 0; i < originalIndices.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const a = originalIndices[i + k], b = originalIndices[i + (k + 1) % 3]
      const key = [vertexKeys[a], vertexKeys[b]].sort().join('|')
      const edge = edges.get(key)
      if (edge) edge.count++
      else edges.set(key, { a, b, count: 1 })
    }
  }
  const open = [...edges.values()].filter(e => e.count === 1)
  const adjacentOpen = new Map<string, Set<string>>()
  const representative = new Map(vertexKeys.map((key, i) => [key, i]))
  for (const e of open) {
    for (const [a, b] of [[vertexKeys[e.a], vertexKeys[e.b]], [vertexKeys[e.b], vertexKeys[e.a]]]) {
      if (!adjacentOpen.has(a)) adjacentOpen.set(a, new Set())
      adjacentOpen.get(a)!.add(b)
    }
  }
  const visited = new Set<string>()
  const snaps = new Map<string, THREE.Vector3>()
  for (const start of adjacentOpen.keys()) {
    if (visited.has(start)) continue
    const queue = [start], component: string[] = []
    while (queue.length) {
      const key = queue.pop()!
      if (visited.has(key)) continue
      visited.add(key); component.push(key)
      for (const neighbor of adjacentOpen.get(key) ?? []) queue.push(neighbor)
    }
    const points = component.map(key => new THREE.Vector3().fromBufferAttribute(originalPositions, representative.get(key)!))
    if (!points.every(p => Math.abs(p.x) > 0.115 && p.y > -0.08 && p.y < 0.17)) continue
    if (new THREE.Box3().setFromPoints(points).getSize(new THREE.Vector3()).length() > 0.003) continue
    const center = points.reduce((sum, p) => sum.add(p), new THREE.Vector3()).divideScalar(points.length)
    for (const key of component) snaps.set(key, center)
  }
  for (let i = 0; i < originalPositions.count; i++) {
    const p = snaps.get(vertexKeys[i])
    if (p) originalPositions.setXYZ(i, p.x, p.y, p.z)
  }
  geo.setIndex(originalIndices)
  relaxUnderarms(geo)
  const attributes = Object.entries(geo.attributes)
  const source = geo.index
  const positions = geo.getAttribute('position')
  const output = new Map(attributes.map(([name]) => [name, [] as number[]]))
  const boundaries = [new Map<string, THREE.Vector3>(), new Map<string, THREE.Vector3>()]
  const boundaryNormals = new Map<string, THREE.Vector3>()
  const neighbors = [new Map<string, Set<string>>(), new Map<string, Set<string>>()]
  type Vertex = Record<string, number[]>
  const read = (i: number): Vertex => Object.fromEntries(attributes.map(([name, attr]) =>
    [name, Array.from({ length: attr.itemSize }, (_, k) => attr.getComponent(i, k))]))
  const count = source?.count ?? positions.count
  for (let i = 0; i < count; i += 3) {
    let polygon = [0, 1, 2].map(k => read(source ? source.getX(i + k) : i + k))
    for (const side of [1, -1]) {
      const clipped: Vertex[] = []
      const crossings: string[] = []
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j], b = polygon[(j + 1) % polygon.length]
        const da = cutDistance(a.position, side), db = cutDistance(b.position, side)
        if (da >= 0) clipped.push(a)
        if ((da >= 0) !== (db >= 0)) {
          let low = 0, high = 1
          for (let step = 0; step < 28; step++) {
            const mid = (low + high) / 2
            const p = a.position.map((n, k) => n + (b.position[k] - n) * mid)
            if ((cutDistance(p, side) >= 0) === (da >= 0)) low = mid
            else high = mid
          }
          const t = (low + high) / 2
          const v = Object.fromEntries(attributes.map(([name]) =>
            [name, a[name].map((n, k) => n + (b[name][k] - n) * t)]))

          clipped.push(v)
          const p = new THREE.Vector3().fromArray(v.position)
          boundaries[side === 1 ? 0 : 1].set(keyOf(p), p)
          crossings.push(keyOf(p))
          boundaryNormals.set(keyOf(p), new THREE.Vector3().fromArray(v.normal).normalize())
        }
      }
      if (crossings.length === 2 && crossings[0] !== crossings[1]) {
        const graph = neighbors[side === 1 ? 0 : 1]
        for (const [a, b] of [crossings, [...crossings].reverse()]) {
          if (!graph.has(a)) graph.set(a, new Set())
          graph.get(a)!.add(b)
        }
      }
      polygon = clipped
    }
    for (let j = 1; j < polygon.length - 1; j++) {
      for (const v of [polygon[0], polygon[j], polygon[j + 1]]) {
        for (const [name] of attributes) output.get(name)!.push(...v[name])
      }
    }
  }
  geo.setIndex(null)
  for (const [name, attr] of attributes) {
    geo.setAttribute(name, new THREE.Float32BufferAttribute(output.get(name)!, attr.itemSize))
  }

  return boundaries.map((boundary, sideIndex) => {
    const side = sideIndex === 0 ? 1 : -1
    const rim = [...boundary.values()]
    if (rim.length < 3) throw new Error(`Missing ${LONG_MODEL_ID} sleeve opening`)
    const axis = armAxis(side)
    const initialW = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 0, 1), axis).normalize()
    const initialF = new THREE.Vector3().crossVectors(axis, initialW).normalize()
    const rimBounds = new THREE.Box3().setFromPoints(rim)
    const center = rimBounds.getCenter(new THREE.Vector3())
    // Follow triangle connectivity, including small folds that cannot be
    // recovered by angular sorting. Bridge only the GLB's existing UV seams.
    const graph = neighbors[sideIndex]
    const remaining = new Set(boundary.keys())
    const ordered: THREE.Vector3[] = []
    let current = [...remaining].find(k => graph.get(k)?.size === 1) ?? [...remaining][0]
    while (remaining.size) {
      const point = boundary.get(current)!
      ordered.push(point)
      remaining.delete(current)
      const next = [...(graph.get(current) ?? [])].find(k => remaining.has(k))
      if (next) current = next
      else if (remaining.size) current = [...remaining].reduce((a, b) =>
        boundary.get(a)!.distanceToSquared(point) < boundary.get(b)!.distanceToSquared(point) ? a : b)
    }
    const area = ordered.reduce((sum, p, j) => {
      const q = ordered[(j + 1) % ordered.length]
      return sum + side * (p.y * q.z - q.y * p.z)
    }, 0)
    if (area < 0) ordered.reverse()
    const backIndex = ordered.reduce((best, p, i) =>
      p.clone().sub(center).normalize().dot(initialF) < ordered[best].clone().sub(center).normalize().dot(initialF) ? i : best, 0)
    rim.splice(0, rim.length, ...ordered.slice(backIndex), ...ordered.slice(0, backIndex))
    // Regularize the complete armhole before lofting. Dense vertices along
    // baked pleats must not become radial folds extending down the new arm.
    const radiusY = (rimBounds.max.y - rimBounds.min.y) / 2
    const radiusZ = (rimBounds.max.z - rimBounds.min.z) / 2
    const angleAt = (p: THREE.Vector3) => Math.atan2((p.z - center.z) / radiusZ, side * (p.y - center.y) / radiusY)
    const angles = rim.map(angleAt)
    const cleanPoint = (p: THREE.Vector3) => {
      const theta = angleAt(p)
      const y = center.y + side * Math.cos(theta) * radiusY
      return new THREE.Vector3(side * longSleeveCutX(y), y, center.z + Math.sin(theta) * radiusZ)
    }
    const cleanRim = rim.map(p => cleanPoint(new THREE.Vector3().fromArray(new Float32Array(p.toArray()))))
    // Use one continuous deformation field on the body and opening. A
    // nearest-vertex displacement would create ridges along its partitions.
    const body = geo.getAttribute('position')
    for (let i = 0; i < body.count; i++) {
      const p = new THREE.Vector3().fromBufferAttribute(body, i)
      if (Math.sign(p.x) !== side || Math.abs(p.x) <= 0.115 || p.y < -0.08) continue
      const target = cleanPoint(p)
      const exact = Math.abs(cutDistance(p.toArray(), side)) < 1e-6
      const weight = exact ? 1 : smooth(clamp01(1 - (longSleeveCutX(p.y) - Math.abs(p.x)) / 0.04))
      const y = THREE.MathUtils.lerp(p.y, target.y, weight)
      const z = THREE.MathUtils.lerp(p.z, target.z, weight)
      const x = exact ? longSleeveCutX(y) : Math.min(longSleeveCutX(y), Math.abs(p.x) + longSleeveCutX(y) - longSleeveCutX(p.y))
      body.setXYZ(i, side * x, y, z)
    }
    rim.splice(0, rim.length, ...cleanRim)
    geo.computeVertexNormals()
    // Share the new body normals at the shoulder seam.
    const bodyNormals = geo.getAttribute('normal')
    const sums = new Map<string, THREE.Vector3>()
    for (let i = 0; i < body.count; i++) {
      const key = keyOf(new THREE.Vector3().fromBufferAttribute(body, i))
      const n = sums.get(key) ?? new THREE.Vector3()
      n.add(new THREE.Vector3().fromBufferAttribute(bodyNormals, i)); sums.set(key, n)
    }
    for (let i = 0; i < body.count; i++) {
      const n = sums.get(keyOf(new THREE.Vector3().fromBufferAttribute(body, i)))!.clone().normalize()
      bodyNormals.setXYZ(i, n.x, n.y, n.z)
    }
    for (const p of rim) boundaryNormals.set(keyOf(p), (sums.get(keyOf(p)) ?? p.clone().sub(center)).clone().normalize())
    const curve = new THREE.CubicBezierCurve3(
      center,
      center.clone().add(new THREE.Vector3(side * 0.055, -0.025, 0)),
      new THREE.Vector3(side * 0.285, -0.145, 0.012),
      new THREE.Vector3(side * 0.255, -0.295, 0.016),
    )
    // Each meridian follows one cubic surface from shoulder to wrist. Swept
    // frames rotate a deep armhole upward as they bend, producing pockets.
    // Interpolating the whole surface keeps the underside continuous.
    const ring = (s: number) => rim.map((p, j) => {
      if (s === 0) return p.clone()
      const upper = p.clone().add(new THREE.Vector3(side * 0.055, -0.035, 0))
      const elbow = new THREE.Vector3(side * 0.285 + Math.cos(angles[j]) * 0.044,
        -0.145, 0.012 + Math.sin(angles[j]) * 0.044)
      const wrist = new THREE.Vector3(side * 0.255 + Math.cos(angles[j]) * 0.034,
        -0.295, 0.016 + Math.sin(angles[j]) * 0.034)
      const t = 1 - s
      return p.clone().multiplyScalar(t * t * t)
        .addScaledVector(upper, 3 * t * t * s)
        .addScaledVector(elbow, 3 * t * s * s)
        .addScaledVector(wrist, s * s * s)
    })
    const makePart = (start: number, end: number, rows: number, cuff: boolean) => {
      const pos: number[] = [], uv: number[] = [], indices: number[] = []
      const stride = rim.length + 1
      for (let row = 0; row < rows; row++) {
        const s = THREE.MathUtils.lerp(start, end, row / (rows - 1))
        const points = ring(s)
        for (let j = 0; j <= rim.length; j++) {
          const k = j % rim.length
          pos.push(...points[k].toArray())
          // Place the seam behind the arm, with continuous U across each face.
          const theta = j === rim.length ? angles[0] + Math.PI * 2 : angles[k]
          uv.push((theta + Math.PI / 2) / (Math.PI * 2), cuff ? (s - start) / (end - start) : s)
        }
      }
      for (let row = 0; row < rows - 1; row++) {
        for (let j = 0; j < rim.length; j++) {
          const a = row * stride + j, b = a + stride
          indices.push(a, a + 1, b, b, a + 1, b + 1)
        }
      }
      if (cuff) {
        const cap = curve.getPointAt(1).addScaledVector(curve.getTangentAt(1), -0.004)
        const capIndex = pos.length / 3
        pos.push(...cap.toArray()); uv.push(0.5, 1)
        for (let j = 0; j < rim.length; j++) {
          const a = (rows - 1) * stride + j
          indices.push(a, a + 1, capIndex)
        }
      }
      const result = new THREE.BufferGeometry()
      result.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
      result.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
      result.setIndex(indices)
      result.computeVertexNormals()
      const normals = result.getAttribute('normal')
      for (let row = 0; row < rows; row++) {
        const a = row * stride, b = a + rim.length
        const normal = new THREE.Vector3().fromBufferAttribute(normals, a)
          .add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize()
        normals.setXYZ(a, normal.x, normal.y, normal.z)
        normals.setXYZ(b, normal.x, normal.y, normal.z)
      }
      if (!cuff) {
        for (let j = 0; j <= rim.length; j++) {
          const n = boundaryNormals.get(keyOf(rim[j % rim.length]))!
          normals.setXYZ(j, n.x, n.y, n.z)
        }
      }
      return result
    }
    return { sleeve: makePart(0, CUFF_START, 33, false), cuff: makePart(CUFF_START, 1, 6, true) }
  })
}
















