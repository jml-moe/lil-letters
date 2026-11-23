/// <reference lib="webworker" />
import { bakeFrame, bakeTop, buildGeo, makeLayout } from "./scene"

/**
 * Paints the slow, static parts of the drawing off the main thread, so the page
 * keeps scrolling while the crayon strokes are laid down.
 */
export interface BakeRequest {
  portrait: boolean
  k: number
  seeds: number[]
}
export type BakeResult = { kind: "top" | "frame"; bitmap: ImageBitmap }

const post = (msg: BakeResult) => (self as unknown as Worker).postMessage(msg, [msg.bitmap])

self.onmessage = (event: MessageEvent<BakeRequest>) => {
  const { portrait, k, seeds } = event.data
  const geo = buildGeo(makeLayout(portrait))
  const toBitmap = (cv: unknown) => (cv as OffscreenCanvas).transferToImageBitmap()
  post({ kind: "top", bitmap: toBitmap(bakeTop(geo.L, k)) })
  for (const seed of seeds) {
    const steps = bakeFrame(geo, seed, k)
    let next = steps.next()
    while (!next.done) next = steps.next()
    post({ kind: "frame", bitmap: toBitmap(next.value) })
  }
}
