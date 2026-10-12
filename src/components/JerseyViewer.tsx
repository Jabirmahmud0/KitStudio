/**
 * KitStudio viewer — one optimized pipeline shared by the landing
 * hero and the studio (PRD §6.6). DPR clamp [1, 1.75], ACES tone
 * mapping, one warm key light, eased camera moves (never cuts,
 * unless the user prefers reduced motion), WebGL fallback with
 * static front/back renders.
 */
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { damp, dampAngle } from 'maath/easing'
import JerseyModel from './JerseyModel'
import { registerCapturer } from '../lib/snapshot'
import { flatDataUrl } from '../lib/texture'
import type { CameraView } from '../lib/store'
import type { SharedDesignV1 } from '../lib/types'

export type ViewerBackground = 'ink' | 'spotlight' | 'paper'
export const BG_HEX: Record<ViewerBackground, string> = {
  ink: '#101010',
  spotlight: '#29241d',
  paper: '#f4f1ea',
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(c.getContext('webgl2') || c.getContext('webgl'))
  } catch {
    return false
  }
}

/* ------------------------------------------------------------------ */
/* Camera rig — eased front/back moves with a goTo() promise API      */
/* ------------------------------------------------------------------ */

interface RigHandle {
  goTo: (view: CameraView) => Promise<void>
}

function CameraRig({
  view,
  rigRef,
}: {
  view: CameraView
  rigRef: React.MutableRefObject<RigHandle | null>
}) {
  const { camera, controls } = useThree((s) => ({
    camera: s.camera,
    controls: s.controls as unknown as { target: THREE.Vector3; update: () => void } | null,
  }))
  /** maath damp/dampAngle operate on an object property. */
  const rig = useRef({
    theta: Math.atan2(camera.position.x, camera.position.z),
    y: camera.position.y,
  })
  const targetTheta = useRef(rig.current.theta)
  const animating = useRef(false)
  const resolver = useRef<(() => void) | null>(null)
  const lastView = useRef(view)

  useEffect(() => {
    rigRef.current = {
      goTo: (v: CameraView) =>
        new Promise<void>((resolve) => {
          targetTheta.current = v === 'back' ? Math.PI : 0
          // pick the shortest way around
          while (targetTheta.current - rig.current.theta > Math.PI)
            targetTheta.current -= Math.PI * 2
          while (targetTheta.current - rig.current.theta < -Math.PI)
            targetTheta.current += Math.PI * 2
          if (prefersReducedMotion()) {
            rig.current.theta = targetTheta.current
            resolver.current?.()
            resolver.current = null
            resolve()
            return
          }
          resolver.current?.()
          resolver.current = resolve
          animating.current = true
          // Safety: resolve the promise even if convergence stalls,
          // but NEVER stop the animation itself mid-flight.
          setTimeout(() => {
            if (resolver.current === resolve) {
              resolver.current = null
              resolve()
            }
          }, 4000)
        }),
    }
  }, [rigRef])

  useEffect(() => {
    if (view !== lastView.current) {
      lastView.current = view
      void rigRef.current?.goTo(view)
    }
  }, [view, rigRef])

  useFrame((_, delta) => {
    if (!animating.current) {
      rig.current.theta = Math.atan2(camera.position.x, camera.position.z)
      rig.current.y = camera.position.y
      return
    }
    const d = Math.min(delta, 0.1)
    // maath easing — smooth, never a cut (PRD §4.3, §6.6)
    dampAngle(rig.current, 'theta', targetTheta.current, 0.32, d)
    damp(rig.current, 'y', 0.15, 0.32, d)
    const radius = Math.hypot(camera.position.x, camera.position.z) || 4.4
    camera.position.x = radius * Math.sin(rig.current.theta)
    camera.position.z = radius * Math.cos(rig.current.theta)
    camera.position.y = rig.current.y
    camera.lookAt(0, 0, 0)
    if (controls) (controls as unknown as { enabled: boolean }).enabled = false
    if (Math.abs(rig.current.theta - targetTheta.current) < 0.005) {
      rig.current.theta = targetTheta.current
      camera.position.x = radius * Math.sin(rig.current.theta)
      camera.position.z = radius * Math.cos(rig.current.theta)
      animating.current = false
      if (controls) (controls as unknown as { enabled: boolean }).enabled = true
      controls?.update()
      resolver.current?.()
      resolver.current = null
    }
  })
  return null
}

/* ------------------------------------------------------------------ */
/* Snapshot bridge                                                    */
/* ------------------------------------------------------------------ */

function SnapshotBridge({
  rigRef,
  register,
}: {
  rigRef: React.MutableRefObject<RigHandle | null>
  register: boolean
}) {
  const { gl, scene, camera } = useThree()
  useEffect(() => {
    if (!register) return
    registerCapturer(async (view) => {
      await rigRef.current?.goTo(view)
      gl.render(scene, camera)
      return gl.domElement.toDataURL('image/png')
    })
    return () => registerCapturer(null)
  }, [gl, scene, camera, rigRef, register])
  return null
}

/* ------------------------------------------------------------------ */
/* Viewer                                                             */
/* ------------------------------------------------------------------ */

export interface JerseyViewerProps {
  state: SharedDesignV1
  view: CameraView
  autoRotate?: boolean
  controlsEnabled?: boolean
  background?: ViewerBackground
  registerSnapshot?: boolean
  className?: string
}

export default function JerseyViewer({
  state,
  view,
  autoRotate = false,
  controlsEnabled = true,
  background = 'ink',
  registerSnapshot = false,
  className = '',
}: JerseyViewerProps) {
  const [ready, setReady] = useState(false)
  const [fontsReady, setFontsReady] = useState(false)
  const rigRef = useRef<RigHandle | null>(null)
  const supported = useMemo(webglAvailable, [])
  const reducedMotion = useMemo(prefersReducedMotion, [])

  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && setFontsReady(true))
    return () => {
      live = false
    }
  }, [])

  if (!supported) {
    // PRD §6.6 / §7.4 — static renders, clear message, flow continues.
    return (
      <div
        className={`relative flex flex-col items-center justify-center gap-3 bg-[#1b1b1b] p-6 ${className}`}
        role="img"
        aria-label={`Static ${view} view of the jersey. ${state.design.pattern} pattern.`}
      >
        <img
          src={flatDataUrl(view, state.design, state.print)}
          alt={`${view === 'front' ? 'Front' : 'Back'} of the designed jersey`}
          className="max-h-[70%] w-auto rounded-lg shadow-2xl"
        />
        <p className="max-w-sm text-center text-sm text-[#8a8578]">
          3D preview is unavailable on this device (WebGL not supported).
          You are seeing a static render — every design control still works.
        </p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <Canvas
        key={state.design.modelId}
        dpr={[1, 1.75]}
        camera={{
          position: [0, 0.15, state.design.modelId === 'pro-long' ? 5.9 : 4.9],
          fov: 38,
        }}
        gl={{ preserveDrawingBuffer: true, antialias: true }}
        onCreated={() => setReady(true)}
        aria-label="3D jersey preview. Drag to orbit."
      >
        <color attach="background" args={[BG_HEX[background]]} />
        <ambientLight intensity={0.55} color="#fff4e0" />
        <directionalLight
          position={[3.5, 4, 5]}
          intensity={1.7}
          color="#fff1dc"
        />
        <directionalLight
          position={[-4, 2, -3.5]}
          intensity={0.65}
          color="#ffe3c2"
        />
        <Suspense fallback={null}>
          <JerseyModel
            design={state.design}
            print={state.print}
            fontsReady={fontsReady}
          />
        </Suspense>
        <ContactShadows
          position={[0, -1.52, 0]}
          opacity={0.55}
          scale={7}
          blur={2.6}
          far={2.6}
          color="#000000"
        />
        <OrbitControls
          makeDefault
          enablePan={false}
          enableZoom={controlsEnabled}
          enableRotate={controlsEnabled}
          autoRotate={autoRotate && !reducedMotion}
          autoRotateSpeed={1.4}
          minDistance={2.6}
          maxDistance={7}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI - 0.6}
        />
        <CameraRig view={view} rigRef={rigRef} />
        <SnapshotBridge rigRef={rigRef} register={registerSnapshot} />
      </Canvas>

      {!ready && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3"
          style={{ background: BG_HEX[background] }}
          aria-hidden="true"
        >
          <div className="h-40 w-32 animate-pulse rounded-2xl bg-[#242424]" />
          <p className="font-mono text-xs tracking-widest text-[#8a8578] uppercase">
            Loading model…
          </p>
        </div>
      )}
      <span aria-live="polite" className="sr-only">
        {view === 'back' ? 'Viewing back of jersey.' : 'Viewing front of jersey.'}
      </span>
    </div>
  )
}
