/// <reference types="node" />
import { readFileSync } from 'node:fs'
import * as THREE from 'three'
import { describe, expect, it } from 'vitest'
import { buildSleeveParts, transformGarmentGeometry, longSleeveCutX } from './modelVariants'
import { buildCollarGeometry } from './modelCollars'

function garment() {
  const file = readFileSync(new URL('../../public/models/pro-slim.glb', import.meta.url))
  const jsonLength = file.readUInt32LE(12)
  const gltf = JSON.parse(file.subarray(20, 20 + jsonLength).toString())
  const binary = 28 + jsonLength
  const geo = new THREE.BufferGeometry()
  const primitive = gltf.meshes[0].primitives[0]
  for (const [semantic, name, size] of [['POSITION', 'position', 3], ['NORMAL', 'normal', 3], ['TEXCOORD_0', 'uv', 2]] as const) {
    const accessor = gltf.accessors[primitive.attributes[semantic]]
    const view = gltf.bufferViews[accessor.bufferView]
    const offset = binary + view.byteOffset + (accessor.byteOffset ?? 0)
    const values = Array.from({ length: accessor.count * size }, (_, i) => file.readFloatLE(offset + i * 4))
    geo.setAttribute(name, new THREE.Float32BufferAttribute(values, size))
  }
  const accessor = gltf.accessors[primitive.indices]
  const offset = binary + gltf.bufferViews[accessor.bufferView].byteOffset + (accessor.byteOffset ?? 0)
  geo.setIndex(Array.from({ length: accessor.count }, (_, i) => file.readUInt16LE(offset + i * 2)))
  return geo
}

const key = (p: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, i: number) =>
  [p.getX(i), p.getY(i), p.getZ(i)].map(v => Math.round(v * 1e6)).join(',')

function edgeCounts(geometries: THREE.BufferGeometry[]) {
  const edges = new Map<string, number>()
  for (const geo of geometries) {
    const p = geo.getAttribute('position'), index = geo.index
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      const ids = [0, 1, 2].map(j => key(p, index ? index.getX(i + j) : i + j))
      for (let j = 0; j < 3; j++) {
        const a = ids[j], b = ids[(j + 1) % 3]
        if (a === b) continue
        const edge = [a, b].sort().join('|')
        edges.set(edge, (edges.get(edge) ?? 0) + 1)
      }
    }
  }
  return edges
}

describe('Pro Long Sleeve geometry', () => {
  it('joins both extensions and cuffs without introducing open edges', () => {
    const base = garment()

    const parts = buildSleeveParts(base)
    expect(parts).toHaveLength(2)
    // No original short-sleeve shell may remain beyond the shoulder seam.
    const bodyPositions = base.getAttribute('position')
    for (let i = 0; i < bodyPositions.count; i++) {
      expect(Math.abs(bodyPositions.getX(i))).toBeLessThanOrEqual(longSleeveCutX(bodyPositions.getY(i)) + 1e-6)
    }
    const cutEdges = edgeCounts([base])
    const edges = edgeCounts([base, ...parts.flatMap(p => [p.sleeve, p.cuff])])
    const openingEdges = [...cutEdges].filter(([edge, count]) => {
      const ends = edge.split('|').map(p => p.split(',').map(Number))
      const onCut = ends.every(p => Math.abs(Math.abs(p[0] / 1e6) - longSleeveCutX(p[1] / 1e6)) < 0.000002)
      return count === 1 && onCut
    })
    // The original short-sleeve openings must disappear completely, including
    // their medial edges (|x| ~= 0.160), which formerly dangled at the armpit.
    const armpitHoles = [...edges].filter(([edge, count]) => {
      const ends = edge.split('|').map(p => p.split(',').map(n => Number(n) / 1e6))
      return count === 1 && ends.every(p => Math.abs(p[0]) > 0.145 && p[1] > -0.08 && p[1] < 0.04)
    })
    expect(armpitHoles).toEqual([])
    expect(openingEdges.length).toBeGreaterThan(20)
    expect(openingEdges.filter(([edge]) => edges.get(edge) !== 2)).toEqual([])
    for (const part of parts) {
      const cuffEdges = edgeCounts([part.cuff])
      expect([...cuffEdges].filter(([edge, count]) => count === 1 && edges.get(edge) !== 2)).toEqual([])
    }
    for (const part of parts) {
      // Every longitudinal fabric line must descend continuously. A reversal
      // in Y creates the raised underside pocket seen in the original defect.
      const sleevePositions = part.sleeve.getAttribute('position')
      const sleeveUvs = part.sleeve.getAttribute('uv')
      const meridians = new Map<string, { v: number; y: number }[]>()
      for (let i = 0; i < sleevePositions.count; i++) {
        const u = sleeveUvs.getX(i).toFixed(6)
        const line = meridians.get(u) ?? []
        line.push({ v: sleeveUvs.getY(i), y: sleevePositions.getY(i) })
        meridians.set(u, line)
      }
      for (const line of meridians.values()) {
        line.sort((a, b) => a.v - b.v)
        for (let i = 1; i < line.length; i++) expect(line[i].y).toBeLessThanOrEqual(line[i - 1].y + 1e-6)
      }
      for (const geo of [part.sleeve, part.cuff]) {
        expect(Array.from(geo.getAttribute('position').array).every(Number.isFinite)).toBe(true)
      }
      part.cuff.computeBoundingBox()
      expect(part.cuff.boundingBox!.min.y).toBeLessThan(-0.29)
    }
  })

  it('keeps the torso and short-sleeve model intact', () => {
    const base = garment()
    const original = Array.from(base.getAttribute('position').array)
    expect(transformGarmentGeometry(base, 'pro-slim')).toBe(false)
    expect(Array.from(base.getAttribute('position').array)).toEqual(original)
    buildSleeveParts(base)
    const p = base.getAttribute('position')
    const retained = new Set(Array.from({ length: p.count }, (_, i) => key(p, i)))
    const source = garment().getAttribute('position')
    for (let i = 0; i < source.count; i++) {
      if (Math.abs(source.getX(i)) < 0.115 || source.getY(i) < -0.08) expect(retained.has(key(source, i))).toBe(true)
    }
  })
})

describe('physical collar styles', () => {
  it('changes the V neckline geometry while preserving the back neck and lower body', () => {
    const geo = garment()
    const before = geo.getAttribute('position').clone()
    expect(buildCollarGeometry(geo, 'vneck')).toBeNull()
    const after = geo.getAttribute('position')
    let deepestChange = 0
    for (let i = 0; i < after.count; i++) {
      deepestChange = Math.max(deepestChange, before.getY(i) - after.getY(i))
      if (before.getY(i) <= 0.12 || before.getZ(i) <= -0.015) {
        expect(after.getY(i)).toBe(before.getY(i))
      }
      expect(after.getX(i)).toBe(before.getX(i))
      expect(after.getZ(i)).toBe(before.getZ(i))
    }
    expect(deepestChange).toBeGreaterThan(0.065)
  })

  it.each(['pro-slim', 'heritage-loose', 'pro-long'])('builds attached collar fabric for %s', (model) => {
      for (const style of ['mock', 'polo'] as const) {
        const geo = garment()
        transformGarmentGeometry(geo, model)
        if (model === 'pro-long') buildSleeveParts(geo)
        const collar = buildCollarGeometry(geo, style)!
        expect(collar).not.toBeNull()
        expect(collar.index!.count).toBeGreaterThan(100)
        expect(Array.from(collar.getAttribute('position').array).every(Number.isFinite)).toBe(true)
        collar.computeBoundingBox()
        if (style === 'mock') {
          expect(collar.boundingBox!.max.y).toBeGreaterThan(0.27)
          expect(collar.boundingBox!.max.y).toBeLessThan(0.28)
        }
        else {
          expect(collar.boundingBox!.max.z).toBeGreaterThan(0.10)
          expect(collar.boundingBox!.min.y).toBeLessThan(0.17)
          const shirt = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
          const ray = new THREE.Raycaster()
          const p = collar.getAttribute('position')
          let checked = 0
          for (let i = 0; i < p.count; i++) {
            if (p.getZ(i) <= 0 || p.getY(i) > 0.24) continue
            ray.set(new THREE.Vector3(p.getX(i), p.getY(i), 0.4), new THREE.Vector3(0, 0, -1))
            const hit = ray.intersectObject(shirt, false)[0]
            if (!hit) continue
            expect(p.getZ(i)).toBeGreaterThanOrEqual(hit.point.z - 0.0001)
            checked++
          }
          expect(checked).toBeGreaterThan(100)
          expect(Array.from(collar.getAttribute('color').array).some(v => v < 0.5)).toBe(true)
          ;(shirt.material as THREE.Material).dispose()
        }
      }
  })

  it('keeps the original crew neck untouched', () => {
    const geo = garment(), before = Array.from(geo.getAttribute('position').array)
    expect(buildCollarGeometry(geo, 'crew')).toBeNull()
    expect(Array.from(geo.getAttribute('position').array)).toEqual(before)
  })
})









