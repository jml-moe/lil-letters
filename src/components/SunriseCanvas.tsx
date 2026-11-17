import { useEffect, useRef, useState } from "react"
import { getTiles } from "../art/brushes"
import { LOOP, STILL_T, drawMotion } from "../art/motion"
import { bakeFrame, bakeTop, buildGeo, makeLayout } from "../art/scene"

const PORTRAIT_QUERY = "(max-width: 639px)"
const BOIL_FRAMES = 3
const BOIL_MS = 125

/** Optional `?t=12` after the hash freezes the loop at that second (handy for stills). */
function frozenTime(): number | null {
  const m = /[?&]t=([\d.]+)/.exec(window.location.hash)
  return m ? Number(m[1]) : null
}

/**
 * The drawing: a dawn landscape in crayon, coloured pencil, chalk pastel and gel
 * pen, all generated on a canvas. 16:9 on laptops, 4:5 on phones.
 */
export default function SunriseCanvas() {
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
    if (!canvas) return
    const ctx = canvas.getContext("2d")
    if (!ctx) return

    let cancelled = false
    let raf = 0
    let visible = true
    const timers: number[] = []
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const frozen = frozenTime()
    const layout = makeLayout(portrait)
    canvas.width = layout.W
    canvas.height = layout.H
    setReady(false)

    const frames: HTMLCanvasElement[] = []
    let top: HTMLCanvasElement | null = null
    let clock = 0
    let lastTick = 0
    let lastDraw = 0
    // Phones draw at 24 fps: steadier, and closer to a hand-drawn loop anyway.
    const frameMs = 1000 / (portrait ? 24 : 30)

    const start = async () => {
      // The notes are lettered in Allo, so wait for it before drawing them.
      try {
        await document.fonts.load(`italic 600 ${layout.font}px Allo`)
      } catch {
        // Falls back to the next font in the stack.
      }
      if (cancelled) return
      const geo = buildGeo(layout)
      top = bakeTop(layout, getTiles().grain)

      const paint = (time: number, boil: number) => {
        if (!frames.length || !top) return
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = "source-over"
        ctx.drawImage(frames[boil % frames.length], 0, 0)
        drawMotion(ctx, geo, time, boil)
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

      // Bake the boil frames one layer per tick so the page never freezes.
      const onFirstFrame = () => {
        setReady(true)
        if (still || frozen !== null) {
          paint(frozen ?? STILL_T, 0)
          return
        }
        // Open a few seconds in, with the train already on its way.
        clock = 3.5
        lastTick = performance.now()
        raf = requestAnimationFrame(loop)
      }
      const bakeNext = (i: number) => {
        const steps = bakeFrame(geo, 101 + i * 977)
        const step = () => {
          if (cancelled) return
          const next = steps.next()
          if (!next.done) {
            timers.push(window.setTimeout(step, i === 0 ? 0 : 110))
            return
          }
          frames.push(next.value)
          if (i === 0) onFirstFrame()
          const wanted = still || frozen !== null ? 1 : BOIL_FRAMES
          if (i + 1 < wanted) timers.push(window.setTimeout(() => bakeNext(i + 1), 80))
        }
        step()
      }
      timers.push(window.setTimeout(() => bakeNext(0), 30))
    }
    start()

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
    })
    io.observe(canvas)

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      timers.forEach((id) => window.clearTimeout(id))
      io.disconnect()
    }
  }, [portrait])

  return (
    <div
      className="sunrise-frame relative mx-auto overflow-hidden rounded-[6px] bg-[#f3ead8] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_40px_-18px_rgba(43,35,80,0.45),0_2px_6px_rgba(43,35,80,0.18)]"
      data-layout={portrait ? "portrait" : "landscape"}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Lukisan krayon: fajar di atas dua kota kecil bertetangga, kereta berhenti di sebuah stasiun, satu bintang perak di langit ungu."
        className="block h-full w-full transition-opacity duration-700"
        style={{ opacity: ready ? 1 : 0 }}
      />
      <span className="sr-only">Satu putaran cerita berlangsung {LOOP} detik.</span>
    </div>
  )
}
