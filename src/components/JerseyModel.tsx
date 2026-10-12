/**
 * KitStudio hero model — "Pro Slim".
 *
 * A sculpted garment GLB (public/models/pro-slim.glb) with real drape
 * and volume, lit like a product shot. The model's baked occlusion
 * map (fabric folds) and tiled weave normal map are kept; the base
 * color is KitStudio's own canvas texture, painted in the model's UV
 * space through the semantic zone adapter (lib/modelZones.ts) — so
 * the PRD §6.3 contract holds: one design config drives every zone,
 * and the model can be swapped without touching the app.
 *
 * Model credit: sculpted t-shirt garment widely distributed as
 * "shirt_baked.glb" in open three.js customizer projects; used here
 * for a non-commercial portfolio build. See README.
 */
import { useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { useGLTF } from '@react-three/drei'
import { computeModelZones } from '../lib/modelZones'
import { buildSleeveParts, transformGarmentGeometry } from '../lib/modelVariants'
import { buildCollarGeometry } from '../lib/modelCollars'
import { LONG_MODEL_ID } from '../lib/presets'
import {
  drawCuffTexture,
  drawCollarTexture,
  drawKitTexture,
  drawSleeveTubeTexture,
  type LogoRender,
} from '../lib/texture'
import { useKitStore } from '../lib/store'
import type { KitDesign, KitPrint } from '../lib/types'

export const MODEL_URL = '/models/pro-slim.glb'

interface Props {
  design: KitDesign
  print: KitPrint
  fontsReady: boolean
}

export default function JerseyModel({ design, print, fontsReady }: Props) {
  const { scene } = useGLTF(MODEL_URL)
  const designKey = JSON.stringify(design)
  const printKey = JSON.stringify(print)

  // Logo is device-local store state (never in the share schema).
  const logo = useKitStore((s) => s.logo)
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (logo?.kind === 'upload' && logo.dataUrl) {
      const img = new Image()
      img.onload = () => setLogoImg(img)
      img.src = logo.dataUrl
    } else {
      setLogoImg(null)
    }
  }, [logo?.kind, logo?.dataUrl])
  const logoRender: LogoRender | null = logo
    ? {
        kind: logo.kind,
        img: logoImg,
        placement: logo.placement,
        scale: logo.scale,
      }
    : null
  const logoKey = JSON.stringify(logo)

  const prepared = useMemo(() => {
    const root = scene.clone(true)
    let mesh: THREE.Mesh | null = null
    root.traverse((o) => {
      if ((o as THREE.Mesh).isMesh && !mesh) mesh = o as THREE.Mesh
    })
    if (!mesh) return null
    const m = mesh as THREE.Mesh
    m.castShadow = false
    m.receiveShadow = false

    // Zones are computed on the BASE geometry: UVs never change, so
    // the masks/print rect stay valid for every fit variant.
    const baseGeometry = m.geometry as THREE.BufferGeometry
    const zones = computeModelZones(baseGeometry)

    // Fit variant (loose / full sleeve) transforms a cloned geometry.
    const geo = (m.geometry as THREE.BufferGeometry).clone()
    if (transformGarmentGeometry(geo, design.modelId)) {
      geo.computeVertexNormals()
    }
    const sleeveParts = design.modelId === LONG_MODEL_ID ? buildSleeveParts(geo) : []
    const collarGeometry = buildCollarGeometry(geo, design.collar)
    m.geometry = geo

    // Normalize: center the garment and scale it to studio framing.
    // Fit by height, but cap by width so the wide full-sleeve
    // silhouette stays in frame; bottom-align every variant to the
    // same floor line so the contact shadow always meets the hem.
    geo.computeBoundingBox()
    const bb = geo.boundingBox!.clone()
    if (collarGeometry) {
      collarGeometry.computeBoundingBox()
      bb.union(collarGeometry.boundingBox!)
    }
    for (const part of sleeveParts) {
      part.sleeve.computeBoundingBox()
      part.cuff.computeBoundingBox()
      bb.union(part.sleeve.boundingBox!)
      bb.union(part.cuff.boundingBox!)
    }
    const size = new THREE.Vector3()
    bb.getSize(size)
    const center = new THREE.Vector3()
    bb.getCenter(center)
    const scale = Math.min(2.9 / size.y, 3.35 / size.x)
    const yOff = -(2.9 - size.y * scale) / 2

    // Keep the GLB's baked AO + weave normal; replace base color with
    // our painted canvas texture (flipY=false per glTF UV convention).
    const srcMat = m.material as THREE.MeshStandardMaterial
    const mat = srcMat.clone()
    mat.color = new THREE.Color('#ffffff')
    mat.side = THREE.DoubleSide
    // The baked maps are strong; soften so fabric reads as fabric,
    // not cracked paint, under studio light.
    if (mat.normalScale) mat.normalScale.set(0.35, 0.35)
    mat.aoMapIntensity = 0.75
    m.material = mat
    // Semantic contract names (see modelVariants header).
    m.name = 'body'
    mat.name = 'mat_body'

    let collarMat: THREE.MeshStandardMaterial | null = null
    if (collarGeometry) {
      collarMat = new THREE.MeshStandardMaterial({ color: '#ffffff', vertexColors: true, side: THREE.DoubleSide, roughness: 0.82 })
      collarMat.name = 'mat_collar'
      const collar = new THREE.Mesh(collarGeometry, collarMat)
      collar.name = `collar_${design.collar}`
      collar.position.copy(m.position)
      collar.quaternion.copy(m.quaternion)
      collar.scale.copy(m.scale)
      ;(m.parent ?? root).add(collar)
    }

    // Pro Long replaces each short sleeve with one shoulder-to-wrist loft.

    let sleeveMats: { right: THREE.MeshStandardMaterial; left: THREE.MeshStandardMaterial } | null =
      null
    let cuffMats: { right: THREE.MeshStandardMaterial; left: THREE.MeshStandardMaterial } | null =
      null
    if (design.modelId === LONG_MODEL_ID) {
      const parent = (m.parent as THREE.Object3D | null) ?? root
      const mkMat = (name: string) => {
        const c = mat.clone()
        c.name = name
        c.aoMap = null
        // The baked atlas normal map describes the old short-sleeve folds.
        // Applying it in tube UV space creates a false seam across the arm.
        c.normalMap = null
        c.needsUpdate = true
        return c
      }
      sleeveMats = { right: mkMat('mat_sleeve'), left: mkMat('mat_sleeve') }
      cuffMats = { right: mkMat('mat_cuff'), left: mkMat('mat_cuff') }
      const sides = ['right', 'left'] as const
      sleeveParts.forEach((part, i) => {
        const side = sides[i]
        const tag = side === 'right' ? 'R' : 'L'
        const sleeve = new THREE.Mesh(part.sleeve, sleeveMats![side])
        sleeve.name = `sleeve_${tag}`
        const cuff = new THREE.Mesh(part.cuff, cuffMats![side])
        cuff.name = `cuff_${tag}`
        for (const piece of [sleeve, cuff]) {
          piece.castShadow = false
          piece.receiveShadow = false
          piece.position.copy(m.position)
          piece.quaternion.copy(m.quaternion)
          piece.scale.copy(m.scale)
          parent.add(piece)
        }
      })
    }

    return { root, zones, scale, center, mat, yOff, sleeveMats, cuffMats, collarMat }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene, design.modelId, design.collar])

  const tex = useMemo(() => {
    if (!prepared) return null
    const makeTex = (canvas: HTMLCanvasElement) => {
      const t = new THREE.CanvasTexture(canvas)
      t.flipY = false
      t.colorSpace = THREE.SRGBColorSpace
      t.anisotropy = 8
      return t
    }
    const map = makeTex(drawKitTexture(design, print, prepared.zones, logoRender))
    const sleeveMapR = prepared.sleeveMats
      ? makeTex(drawSleeveTubeTexture(design, logoRender, 'right'))
      : null
    const sleeveMapL = prepared.sleeveMats
      ? makeTex(drawSleeveTubeTexture(design, logoRender, 'left'))
      : null
    const cuffMap = prepared.cuffMats ? makeTex(drawCuffTexture(design)) : null
    const collarMap = prepared.collarMat ? makeTex(drawCollarTexture(design)) : null
    return { map, sleeveMapR, sleeveMapL, cuffMap, collarMap }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prepared, designKey, printKey, fontsReady, logoKey, logoImg])

  useEffect(() => {
    if (!prepared || !tex) return
    prepared.mat.map = tex.map
    if (prepared.collarMat) prepared.collarMat.map = tex.collarMap
    if (prepared.sleeveMats && tex.sleeveMapR && tex.sleeveMapL) {
      prepared.sleeveMats.right.map = tex.sleeveMapR
      prepared.sleeveMats.left.map = tex.sleeveMapL
    }
    if (prepared.cuffMats && tex.cuffMap) {
      prepared.cuffMats.right.map = tex.cuffMap
      prepared.cuffMats.left.map = tex.cuffMap
    }

    let roughness = design.finish === 'satin' ? 0.42 : 0.82
    let normal = 0.35
    if (design.fabric === 'mesh') {
      roughness += 0.06
      normal = 0.5
    } else if (design.fabric === 'pique') {
      normal = 0.45
    } else if (design.fabric === 'ribbed') {
      roughness -= 0.04
      normal = 0.5
    }
    const mats = [
      prepared.mat,
      prepared.sleeveMats?.right,
      prepared.sleeveMats?.left,
      prepared.cuffMats?.right,
      prepared.cuffMats?.left,
      prepared.collarMat,
    ].filter(Boolean) as THREE.MeshStandardMaterial[]
    for (const mt of mats) {
      mt.roughness = mt === prepared.collarMat ? Math.max(design.collar === 'mock' ? 0.78 : 0.65, roughness) : roughness
      if (mt.normalScale) mt.normalScale.set(normal, normal)
      mt.needsUpdate = true
    }
    return () => {
      tex.map.dispose()
      tex.sleeveMapR?.dispose()
      tex.sleeveMapL?.dispose()
      tex.cuffMap?.dispose()
      tex.collarMap?.dispose()
    }
  }, [prepared, tex, design.finish, design.fabric, design.colors.trim, design.collar])

  if (!prepared) return null
  const { root, scale, center, yOff } = prepared

  return (
    <group scale={scale} position={[0, 0.02 + yOff, 0]}>
      <group position={[-center.x, -center.y, -center.z]}>
        <primitive object={root} />
      </group>
    </group>
  )
}

useGLTF.preload(MODEL_URL)



