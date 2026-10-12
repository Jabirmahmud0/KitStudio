/**
 * Snapshot registry — the active studio viewer registers a capture
 * function that swings the camera to a side, renders, and returns a
 * PNG data URL. Falls back to the 2D panel render when no WebGL
 * viewer is mounted (PRD §7.4 snapshot handling).
 */
import { flatDataUrl } from './texture'
import type { CameraView } from './store'
import type { SharedDesignV1 } from './types'

type Capturer = (view: CameraView) => Promise<string>

let capturer: Capturer | null = null

export function registerCapturer(fn: Capturer | null) {
  capturer = fn
}

export async function captureView(
  state: SharedDesignV1,
  view: CameraView,
): Promise<string> {
  if (capturer) {
    try {
      return await capturer(view)
    } catch {
      /* fall through to 2D render */
    }
  }
  return flatDataUrl(view, state.design, state.print)
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

export async function downloadSnapshot(
  state: SharedDesignV1,
  which: 'front' | 'back' | 'both',
) {
  const slug =
    state.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || 'kit'
  if (which === 'both') {
    const front = await captureView(state, 'front')
    const back = await captureView(state, 'back')
    // Compose a single side-by-side PNG.
    const imgF = await loadImage(front)
    const imgB = await loadImage(back)
    const canvas = document.createElement('canvas')
    canvas.width = imgF.width + imgB.width
    canvas.height = Math.max(imgF.height, imgB.height)
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#101010'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(imgF, 0, 0)
    ctx.drawImage(imgB, imgF.width, 0)
    downloadDataUrl(canvas.toDataURL('image/png'), `${slug}-front-back.png`)
    return
  }
  const url = await captureView(state, which)
  downloadDataUrl(url, `${slug}-${which}.png`)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
