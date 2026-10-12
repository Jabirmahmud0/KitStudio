import * as THREE from 'three'
import type { CollarStyle } from './types'

const keyOf = (p: THREE.Vector3) => p.toArray().map(v => Math.round(v * 1e6)).join(',')

/** Apply a real neckline shape, then build raised/folded collar fabric where needed. */
export function buildCollarGeometry(geo: THREE.BufferGeometry, style: CollarStyle): THREE.BufferGeometry | null {
  const positions = geo.getAttribute('position')
  if (style === 'crew') return null
  if (style === 'vneck') {
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i)
      if (y <= 0.12 || Math.abs(x) >= 0.095 || z <= -0.015) continue
      const center = Math.max(0, 1 - Math.abs(x) / 0.095)
      const height = THREE.MathUtils.smoothstep(y, 0.12, 0.205)
      const front = THREE.MathUtils.smoothstep(z, -0.015, 0.04)
      positions.setY(i, y - 0.075 * center * height * front)
    }
    geo.computeVertexNormals()
    const normals = geo.getAttribute('normal')
    const sums = new Map<string, THREE.Vector3>()
    for (let i = 0; i < positions.count; i++) {
      const key = keyOf(new THREE.Vector3().fromBufferAttribute(positions, i))
      const sum = sums.get(key) ?? new THREE.Vector3()
      sum.add(new THREE.Vector3().fromBufferAttribute(normals, i)); sums.set(key, sum)
    }
    for (let i = 0; i < positions.count; i++) {
      const n = sums.get(keyOf(new THREE.Vector3().fromBufferAttribute(positions, i)))!.clone().normalize()
      normals.setXYZ(i, n.x, n.y, n.z)
    }
    return null
  }

  // Reuse the actual open neck perimeter, welding the GLB's UV seams.
  const index = geo.index
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; count: number }>()
  for (let i = 0; i < (index?.count ?? positions.count); i += 3) {
    const points = [0, 1, 2].map(k => new THREE.Vector3().fromBufferAttribute(positions, index ? index.getX(i + k) : i + k))
    for (let k = 0; k < 3; k++) {
      const a = points[k], b = points[(k + 1) % 3]
      const key = [keyOf(a), keyOf(b)].sort().join('|')
      const e = edges.get(key)
      if (e) e.count++
      else edges.set(key, { a, b, count: 1 })
    }
  }
  const boundary = new Map<string, THREE.Vector3>()
  for (const { a, b, count } of edges.values()) {
    if (count === 1 && [a, b].every(p => p.y > 0.18 && Math.abs(p.x) < 0.105 && Math.abs(p.z) < 0.1)) {
      boundary.set(keyOf(a), a); boundary.set(keyOf(b), b)
    }
  }
  const ring = [...boundary.values()]
  if (ring.length < 8) throw new Error('Garment neck opening is missing')
  const center = new THREE.Box3().setFromPoints(ring).getCenter(new THREE.Vector3())
  const angle = (p: THREE.Vector3) => Math.atan2(p.z - center.z, p.x - center.x)
  ring.sort((a, b) => angle(a) - angle(b))
  const pos: number[] = [], uv: number[] = [], indices: number[] = []
  const rows = 10
  const surface = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  const ray = new THREE.Raycaster()
  const surfaceZ = (x: number, y: number) => {
    ray.set(new THREE.Vector3(x, y, 0.4), new THREE.Vector3(0, 0, -1))
    return ray.intersectObject(surface, false)[0]?.point.z ?? -0.1
  }
  for (let row = 0; row < rows; row++) {
    const t = row / (rows - 1)
    for (let j = 0; j <= ring.length; j++) {
      const p = ring[j % ring.length]
      const q = p.clone()
      if (style === 'mock') {
        q.y += t * 0.022
        const ease = 1 + Math.sin(t * Math.PI) * 0.025 - t * 0.035
        q.x = center.x + (p.x - center.x) * ease
        q.z = center.z + (p.z - center.z) * ease
      } else {
        const front = THREE.MathUtils.smoothstep(p.z - center.z, 0, 0.055)
        const rx = (p.x - center.x) / 0.083
        const rz = (p.z - center.z) / 0.067
        const fold = THREE.MathUtils.smoothstep(t, 0.25, 1)
        q.x += fold * (rx * 0.021 + front * 0.039 * (Math.sign(rx) - rx))
        q.z += fold * (rz * 0.025 + front * 0.018)
        q.y += Math.sin(t * Math.PI) * 0.011 - fold * (0.008 + front * 0.042)
        // Lay the fold above the real chest/shoulder, rather than burying
        // it in the garment and leaving isolated visible tips.
        if (p.z >= center.z - 0.02) q.z = Math.max(q.z, surfaceZ(q.x, q.y) + 0.0035)
        else q.y += 0.002
      }
      pos.push(...q.toArray()); uv.push(j / ring.length, t)
    }
  }
  const stride = ring.length + 1
  for (let row = 0; row < rows - 1; row++) {
    for (let j = 0; j < ring.length; j++) {
      const a = row * stride + j, b = a + stride
      // Split a polo at the front to form two separate collar tips.
      const p = ring[j], q = ring[(j + 1) % ring.length]
      if (style === 'polo' && p.z > center.z && q.z > center.z && (p.x - center.x) * (q.x - center.x) <= 0) continue
      indices.push(a, b, a + 1, b, b + 1, a + 1)
    }
  }
  // Fabric has thickness: join a recessed inner face to the outer rim.
  const outerCount = pos.length / 3
  for (let i = 0; i < outerCount; i++) {
    const p = new THREE.Vector3().fromArray(pos, i * 3)
    const inward = new THREE.Vector3(p.x - center.x, 0, p.z - center.z).normalize().multiplyScalar(0.0014)
    if (style === 'mock') p.sub(inward)
    else p.z -= 0.0012
    pos.push(...p.toArray()); uv.push(uv[i * 2], uv[i * 2 + 1])
  }
  const outerIndices = [...indices]
  for (let i = 0; i < outerIndices.length; i += 3) indices.push(outerIndices[i] + outerCount, outerIndices[i + 2] + outerCount, outerIndices[i + 1] + outerCount)
  for (let j = 0; j < ring.length; j++) {
    const a = (rows - 1) * stride + j, b = a + 1
    if (style === 'polo' && ring[j].z > center.z && ring[(j + 1) % ring.length].z > center.z && (ring[j].x - center.x) * (ring[(j + 1) % ring.length].x - center.x) <= 0) continue
    indices.push(a, b, a + outerCount, b, b + outerCount, a + outerCount)
  }
  const colors = Array(pos.length).fill(1) as number[]
  if (style === 'polo') {
    // A short placket follows the front surface and meets the collar split.
    const placketRows = 12, first = pos.length / 3
    for (let row = 0; row < placketRows; row++) {
      const y = THREE.MathUtils.lerp(0.207, 0.132, row / (placketRows - 1))
      for (const x of [-0.007, 0.007]) {
        pos.push(x, y, surfaceZ(x, y) + 0.003)
        uv.push(x < 0 ? 0 : 1, row / (placketRows - 1)); colors.push(0.92, 0.92, 0.92)
      }
    }
    for (let row = 0; row < placketRows - 1; row++) {
      const a = first + row * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
    for (const y of [0.185, 0.154]) {
      const button = new THREE.SphereGeometry(0.0028, 12, 8)
      button.scale(1, 1, 0.45)
      button.translate(0, y, surfaceZ(0, y) + 0.0042)
      const start = pos.length / 3, bp = button.getAttribute('position'), buv = button.getAttribute('uv')
      for (let i = 0; i < bp.count; i++) {
        pos.push(bp.getX(i), bp.getY(i), bp.getZ(i)); uv.push(buv.getX(i), buv.getY(i)); colors.push(0.4, 0.4, 0.4)
      }
      for (const i of button.index!.array) indices.push(start + i)
      button.dispose()
    }
  }
  ;(surface.material as THREE.Material).dispose()
  const collar = new THREE.BufferGeometry()
  collar.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  collar.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  collar.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  collar.setIndex(indices)
  collar.computeVertexNormals()
  // Smooth the wrap seam without altering the intentional fold.
  const normals = collar.getAttribute('normal')
  for (let row = 0; row < rows; row++) {
    const a = row * stride, b = a + ring.length
    const n = new THREE.Vector3().fromBufferAttribute(normals, a).add(new THREE.Vector3().fromBufferAttribute(normals, b)).normalize()
    normals.setXYZ(a, n.x, n.y, n.z); normals.setXYZ(b, n.x, n.y, n.z)
  }
  return collar
}

