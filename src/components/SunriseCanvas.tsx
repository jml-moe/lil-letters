import { useEffect, useRef, useState } from "react"
import { type Canvas, ctx2d, makeCanvas } from "../art/brushes"
import { LOOP, STILL_T, drawMotion } from "../art/motion"
import { bakeFrame, bakeTop, buildGeo, drawNotes, makeLayout } from "../art/scene"
import type { BakeRequest, BakeResult } from "../art/bake.worker"

const PORTRAIT_QUERY = "(max-width: 639px)"
const BOIL_SEEDS = [101, 1078, 2055]
const BOIL_MS = 125

/** Optional `?t=12` after the hash freezes the loop at that second (handy for stills). */
function frozenTime(): number | null {
  const m = /[?&]t=([\d.]+)/.exec(window.location.hash)
  return m ? Number(m[1]) : null
}

/**
 * How many canvas pixels per scene unit. Enough for the frame's size on this
 * screen (up to 1.5× density) and no more: every extra pixel costs painting time.
 */
function renderScale(frame: HTMLElement, sceneWidth: number) {
  const density = Math.min(window.devicePixelRatio || 1, 1.5)
  const k = (frame.clientWidth * density) / sceneWidth
  return Math.round(Math.min(1, Math.max(0.45, k)) * 100) / 100
}

const canUseWorker = () => typeof Worker !== "undefined" && typeof OffscreenCanvas !== "undefined"

type Source = Canvas | ImageBitmap

/**
 * The drawing: a sunset landscape in crayon, coloured pencil, chalk pastel and
 * gel pen, generated on a canvas. 16:9 on laptops, 4:5 on phones.
 */
export default function SunriseCanvas() {
  const frameRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [portrait, setPortrait] = useState(() => window.matchMedia(PORTRAIT_QUERY).matches)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia(PORTRAIT_QUERY)
    const onChange = () => setPortrait(mq.matches)
    mq.addEventListener("change", onChange)
    return () => mq.removeEventListener("change", onChange)
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    const frame = frameRef.current
    if (!canvas || !frame) return
    const ctx = canvas.getContext("2d", { desynchronized: true })
    if (!ctx) return

    let cancelled = false
    let raf = 0
    let visible = true
    let worker: Worker | null = null
    const timers: number[] = []
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const frozen = frozenTime()
    const layout = makeLayout(portrait)
    const geo = buildGeo(layout)
    const k = renderScale(frame, layout.W)
    canvas.width = Math.round(layout.W * k)
    canvas.height = Math.round(layout.H * k)
    setReady(false)

    const frames: Source[] = []
    let top: Canvas | null = null
    let clock = 3.5
    let lastTick = 0
    let lastDraw = 0
    // A hand-drawn loop does not need 60 fps; this keeps the work low.
    const frameMs = 1000 / (portrait ? 20 : 24)
    const wanted = still || frozen !== null ? 1 : BOIL_SEEDS.length

    const paint = (time: number, boil: number) => {
      if (!frames.length || !top) return
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = "source-over"
      ctx.drawImage(frames[boil % frames.length], 0, 0)
      ctx.setTransform(k, 0, 0, k, 0, 0)
      drawMotion(ctx, geo, time, boil)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.drawImage(top, 0, 0)
    }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      if (!visible || document.hidden) {
        lastTick = now
        return
      }
      clock += Math.min(100, now - lastTick) / 1000
      lastTick = now
      if (now - lastDraw < frameMs - 2) return
      lastDraw = now
      paint(clock, Math.floor((clock * 1000) / BOIL_MS))
    }

    const begin = () => {
      if (cancelled || !top || !frames.length) return
      setReady(true)
      if (still || frozen !== null) {
        paint(frozen ?? STILL_T, 0)
        return
      }
      lastTick = performance.now()
      raf = requestAnimationFrame(loop)
    }

    /** Paper edge and grain, plus the handwritten notes, which need the web font. */
    const setTop = async (base: Source) => {
      const sheet = makeCanvas(canvas.width, canvas.height)
      const c = ctx2d(sheet)
      try {
        await document.fonts.load(`600 ${layout.font}px Allo`)
      } catch {
        // The notes fall back to the next font in the stack.
      }
      if (cancelled) return
      c.setTransform(k, 0, 0, k, 0, 0)
      drawNotes(c, geo)
      c.setTransform(1, 0, 0, 1, 0, 0)
      c.drawImage(base, 0, 0)
      top = sheet
      begin()
    }

    const addFrame = (source: Source) => {
      frames.push(source)
      if (frames.length === 1) begin()
    }

    if (canUseWorker()) {
      // Paint the static layers in a worker so the page never stalls.
      worker = new Worker(new URL("../art/bake.worker.ts", import.meta.url), { type: "module" })
      worker.onmessage = (event: MessageEvent<BakeResult>) => {
        if (cancelled) return
        if (event.data.kind === "top") setTop(event.data.bitmap)
        else addFrame(event.data.bitmap)
      }
      const request: BakeRequest = { portrait, k, seeds: BOIL_SEEDS.slice(0, wanted) }
      worker.postMessage(request)
    } else {
      // Older browsers: paint on the page, one layer per tick.
      setTop(bakeTop(layout, k))
      const bakeNext = (i: number) => {
        const steps = bakeFrame(geo, BOIL_SEEDS[i], k)
        const step = () => {
          if (cancelled) return
          const next = steps.next()
          if (!next.done) {
            timers.push(window.setTimeout(step, frames.length ? 110 : 0))
            return
          }
          addFrame(next.value)
          if (i + 1 < wanted) timers.push(window.setTimeout(() => bakeNext(i + 1), 80))
        }
        step()
      }
      timers.push(window.setTimeout(() => bakeNext(0), 30))
    }

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      timers.forEach((id) => window.clearTimeout(id))
      worker?.terminate()
      io.disconnect()
      for (const f of frames) if ("close" in f) f.close()
    }
  }, [portrait])

  return (
    <div
      ref={frameRef}
      className="sunrise-frame relative mx-auto overflow-hidden rounded-[6px] bg-[#f3ead8] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_40px_-18px_rgba(60,36,24,0.45),0_2px_6px_rgba(60,36,24,0.18)]"
      data-layout={portrait ? "portrait" : "landscape"}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Lukisan krayon: senja di atas dua kota kecil yang bersebelahan. Sebuah kereta berhenti di stasiun, dan satu bintang perak bersinar di langit."
        className="block h-full w-full transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      />
      <span className="sr-only">Satu putaran animasi berlangsung {LOOP} detik.</span>
    </div>
  )
}
