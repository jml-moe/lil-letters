import { type RNG, clamp, gauss, mulberry32, pick, rr, smooth } from "./rng"

export type RGB = [number, number, number]
export type Pt = [number, number]
type Ctx = CanvasRenderingContext2D

export const hex = (h: string): RGB => {
  const n = parseInt(h.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
export const mix = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
]
export const css = (c: RGB, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`
export const jit = (c: RGB, r: RNG, amt = 10): RGB => [
  clamp(c[0] + (r() - 0.5) * 2 * amt, 0, 255),
  clamp(c[1] + (r() - 0.5) * 2 * amt, 0, 255),
  clamp(c[2] + (r() - 0.5) * 2 * amt, 0, 255),
]

/** Break straight edges into short wobbly ones: nothing a hand draws is ruler-straight. */
export function wobble(pts: Pt[], r: RNG, amp: number, step = 18, closed = true): Pt[] {
  const out: Pt[] = []
  const n = pts.length
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const len = Math.hypot(dx, dy) || 1
    const k = Math.max(1, Math.round(len / step))
    for (let j = 0; j < k; j++) {
      const t = j / k
      const d = (r() - 0.5) * 2 * amp
      out.push([a[0] + dx * t + (-dy / len) * d, a[1] + dy * t + (dx / len) * d])
    }
  }
  if (!closed) out.push(pts[n - 1])
  return out
}

/** Smooth curve through points (quadratics through midpoints). */
export function trace(c: Ctx, pts: Pt[], closed = true) {
  const n = pts.length
  if (n < 2) return
  if (closed) {
    c.moveTo((pts[n - 1][0] + pts[0][0]) / 2, (pts[n - 1][1] + pts[0][1]) / 2)
    for (let i = 0; i < n; i++) {
      const p = pts[i]
      const q = pts[(i + 1) % n]
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    }
    c.closePath()
  } else {
    c.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < n - 1; i++) {
      const p = pts[i]
      const q = pts[i + 1]
      c.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2)
    }
    c.lineTo(pts[n - 1][0], pts[n - 1][1])
  }
}

export interface CrayonOpts {
  ang?: number
  angJit?: number
  sp?: number
  len?: [number, number]
  w?: [number, number]
  base?: number
  a?: [number, number]
  jit?: number
  /** Optional per-position colour, for gradients. */
  colorAt?: (x: number, y: number) => RGB
}

/** Wax crayon: a thin base coat, then lots of short overlapping strokes clipped to the shape. */
export function crayon(c: Ctx, r: RNG, shape: Pt[], cols: RGB[], o: CrayonOpts = {}) {
  const { ang = 0.12, angJit = 0.2, sp = 9, len = [28, 86], w = [4, 11], base = 0.62, a = [0.2, 0.55] } = o
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of shape) {
    x0 = Math.min(x0, p[0])
    y0 = Math.min(y0, p[1])
    x1 = Math.max(x1, p[0])
    y1 = Math.max(y1, p[1])
  }
  c.save()
  c.beginPath()
  trace(c, shape, true)
  c.clip()
  if (base > 0 && !o.colorAt) {
    c.globalAlpha = base
    c.fillStyle = css(cols[0])
    c.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4)
  }
  c.lineCap = "round"
  const count = Math.max(14, Math.round(((x1 - x0) * (y1 - y0)) / (sp * sp)))
  for (let i = 0; i < count; i++) {
    const x = rr(r, x0, x1)
    const y = rr(r, y0, y1)
    const th = ang + gauss(r) * angJit
    const l = rr(r, len[0], len[1]) / 2
    const col = o.colorAt ? o.colorAt(x, y) : pick(r, cols)
    c.strokeStyle = css(jit(col, r, o.jit ?? 9))
    c.globalAlpha = rr(r, a[0], a[1])
    c.lineWidth = rr(r, w[0], w[1])
    c.beginPath()
    c.moveTo(x - Math.cos(th) * l, y - Math.sin(th) * l)
    c.lineTo(x + Math.cos(th) * l, y + Math.sin(th) * l)
    c.stroke()
  }
  c.restore()
}

/** Coloured pencil: a few passes that never quite retrace each other. */
export function pencil(
  c: Ctx,
  r: RNG,
  pts: Pt[],
  col: RGB,
  w = 2,
  o: { passes?: number; jit?: number; a?: number; closed?: boolean } = {},
) {
  const { passes = 2, jit: j = 1.1, a = 0.8, closed = false } = o
  c.save()
  c.lineCap = "round"
  c.lineJoin = "round"
  c.strokeStyle = css(col)
  for (let p = 0; p < passes; p++) {
    const line = wobble(pts, r, j, 11, closed)
    if (closed) line.push(line[0])
    for (let i = 0; i < line.length - 1; i += 3) {
      c.globalAlpha = a * rr(r, 0.55, 1)
      c.lineWidth = w * rr(r, 0.6, 1.25)
      c.beginPath()
      c.moveTo(line[i][0], line[i][1])
      for (let k = 1; k <= 3 && i + k < line.length; k++) c.lineTo(line[i + k][0], line[i + k][1])
      c.stroke()
    }
  }
  c.restore()
}

/** Chalk pastel: short curved dabs piled on top of each other. */
export function scumble(
  c: Ctx,
  r: RNG,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  cols: RGB[],
  n: number,
  o: { w?: [number, number]; a?: [number, number]; rad?: [number, number] } = {},
) {
  const { w = [8, 24], a = [0.1, 0.3], rad = [8, 30] } = o
  c.save()
  c.lineCap = "round"
  for (let i = 0; i < n; i++) {
    const th = r() * Math.PI * 2
    const d = Math.sqrt(r())
    const x = cx + Math.cos(th) * d * rx
    const y = cy + Math.sin(th) * d * ry
    const a0 = r() * Math.PI * 2
    c.strokeStyle = css(jit(pick(r, cols), r, 8))
    c.globalAlpha = rr(r, a[0], a[1])
    c.lineWidth = rr(r, w[0], w[1])
    c.beginPath()
    c.arc(x, y, rr(r, rad[0], rad[1]), a0, a0 + rr(r, 0.5, 1.5))
    c.stroke()
  }
  c.restore()
}

/** Four-point gel-pen sparkle. */
export function sparkle(c: Ctx, x: number, y: number, s: number, col: string, alpha = 1, rot = 0) {
  c.save()
  c.translate(x, y)
  c.rotate(rot)
  c.globalAlpha = alpha
  c.fillStyle = col
  c.beginPath()
  const k = s * 0.16
  c.moveTo(0, -s)
  c.quadraticCurveTo(k, -k, s, 0)
  c.quadraticCurveTo(k, k, 0, s)
  c.quadraticCurveTo(-k, k, -s, 0)
  c.quadraticCurveTo(-k, -k, 0, -s)
  c.fill()
  c.restore()
}

// ─── Paper tooth ──────────────────────────────────────────────────────────────

function makeTile(size: number, fill: (x: number, y: number, out: Uint8ClampedArray, i: number) => void) {
  const cv = document.createElement("canvas")
  cv.width = cv.height = size
  const c = cv.getContext("2d")!
  const img = c.createImageData(size, size)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) fill(x, y, img.data, (y * size + x) * 4)
  c.putImageData(img, 0, 0)
  return cv
}

/** Tileable value noise on a wrapped lattice. */
function lattice(r: RNG, gx: number, gy: number) {
  const g = new Float32Array(gx * gy)
  for (let i = 0; i < g.length; i++) g[i] = r()
  return (u: number, v: number) => {
    const x0 = Math.floor(u)
    const y0 = Math.floor(v)
    const fx = u - x0
    const fy = v - y0
    const at = (x: number, y: number) => g[(((y % gy) + gy) % gy) * gx + (((x % gx) + gx) % gx)]
    const a = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * fx
    const b = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * fx
    return a + (b - a) * fy
  }
}

export interface Tiles {
  streak: HTMLCanvasElement
  fine: HTMLCanvasElement
  grain: HTMLCanvasElement
}

let cached: Tiles | null = null

/** Erase-masks that let the paper show through, plus a speckle overlay. */
export function getTiles(): Tiles {
  if (cached) return cached
  const S = 700
  const r = mulberry32(77)
  const long = lattice(r, 10, 200)
  const mid = lattice(r, 28, 100)
  const dots = lattice(r, 140, 140)
  const streak = makeTile(S, (x, y, d, i) => {
    const a = smooth(0.6, 0.82, long(x / 70, y / 3.5)) * 0.85
    const b = smooth(0.66, 0.9, mid(x / 25, y / 7)) * 0.6
    const s = r() < 0.075 ? rr(r, 0.3, 1) : 0
    d[i + 3] = Math.max(a, b, s) * 255
  })
  const fine = makeTile(S, (x, y, d, i) => {
    const m = dots(x / 5, y / 5)
    const s = r() < 0.05 + m * 0.16 ? rr(r, 0.25, 0.85) : 0
    d[i + 3] = s * 255
  })
  const grain = makeTile(S, (_x, _y, d, i) => {
    const v = r()
    if (v < 0.045) {
      d[i] = 255
      d[i + 1] = 244
      d[i + 2] = 222
      d[i + 3] = rr(r, 14, 70)
    } else if (v < 0.09) {
      d[i] = 34
      d[i + 1] = 22
      d[i + 2] = 66
      d[i + 3] = rr(r, 10, 46)
    }
  })
  cached = { streak, fine, grain }
  return cached
}

/**
 * Draws each element on a scratch sheet, knocks the paper tooth out of it, then
 * lays it on the painting — so every layer keeps its own dry-media grain.
 */
export class Painter {
  cv: HTMLCanvasElement
  c: Ctx
  private scr: HTMLCanvasElement
  private s: Ctx
  private pat: Record<"streak" | "fine", CanvasPattern>

  constructor(
    public W: number,
    public H: number,
    public r: RNG,
  ) {
    const tiles = getTiles()
    this.cv = document.createElement("canvas")
    this.cv.width = W
    this.cv.height = H
    this.c = this.cv.getContext("2d")!
    this.scr = document.createElement("canvas")
    this.scr.width = W
    this.scr.height = H
    this.s = this.scr.getContext("2d")!
    this.pat = {
      streak: this.s.createPattern(tiles.streak, "repeat")!,
      fine: this.s.createPattern(tiles.fine, "repeat")!,
    }
  }

  layer(draw: (c: Ctx) => void, tooth: "streak" | "fine" | "none" = "streak", amt = 1) {
    const { s, W, H } = this
    s.setTransform(1, 0, 0, 1, 0, 0)
    s.globalAlpha = 1
    s.globalCompositeOperation = "source-over"
    s.clearRect(0, 0, W, H)
    s.save()
    draw(s)
    s.restore()
    if (tooth !== "none" && amt > 0) {
      s.save()
      s.globalCompositeOperation = "destination-out"
      s.globalAlpha = amt
      s.fillStyle = this.pat[tooth]
      const ox = Math.floor(this.r() * 700)
      const oy = Math.floor(this.r() * 700)
      s.translate(-ox, -oy)
      s.fillRect(0, 0, W + 700, H + 700)
      s.restore()
    }
    this.c.drawImage(this.scr, 0, 0)
  }
}
