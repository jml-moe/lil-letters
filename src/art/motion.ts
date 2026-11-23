import { type Canvas, type Pt, ctx2d, makeCanvas, sparkle, trace, wobble } from "./brushes"
import { clamp, gauss, lerp, mulberry32, rr, smooth } from "./rng"
import type { Geo } from "./scene"

type Ctx = CanvasRenderingContext2D

/** One loop of the little story, in seconds. */
export const LOOP = 28
/** The stillest, warmest moment: the train waiting at her station. */
export const STILL_T = 12.6

const CARS = 4
const CAR_L = 168
const CAR_H = 50
const GAP = 10

const easeOut = (t: number) => 1 - (1 - t) ** 3
const easeIn = (t: number) => t ** 2.4

const sprites = new Map<string, Canvas>()

/** Soft round light. Each colour is painted once into a small sprite, then reused. */
function glow(c: Ctx, x: number, y: number, rad: number, col: string, a: number) {
  if (a <= 0 || rad <= 0) return
  let sprite = sprites.get(col)
  if (!sprite) {
    sprite = makeCanvas(128, 128)
    const s = ctx2d(sprite)
    const g = s.createRadialGradient(64, 64, 0, 64, 64, 64)
    g.addColorStop(0, col.replace("ALPHA", "1"))
    g.addColorStop(1, col.replace("ALPHA", "0"))
    s.fillStyle = g
    s.fillRect(0, 0, 128, 128)
    sprites.set(col, sprite)
  }
  const prev = c.globalAlpha
  c.globalAlpha = prev * Math.min(1, a)
  c.drawImage(sprite, x - rad, y - rad, rad * 2, rad * 2)
  c.globalAlpha = prev
}

const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

function drawCar(c: Ctx, r: () => number, x: number, y: number, ang: number, s: number, head: boolean, tail: boolean) {
  c.save()
  c.translate(x, y)
  c.rotate(ang)
  c.scale(s, s)
  const L = CAR_L
  const top = -CAR_H - 7
  // Wheels.
  c.fillStyle = "#221a1e"
  for (const wx of [-L * 0.32, -L * 0.2, L * 0.2, L * 0.32]) {
    c.beginPath()
    c.arc(wx, -4, 6.2, 0, 6.3)
    c.fill()
  }
  // Body.
  const nose = head ? 16 : 0
  const body: Pt[] = [
    [-L / 2, top + 5],
    [L / 2 - nose, top + 5],
    [L / 2, top + 24],
    [L / 2, -8],
    [-L / 2, -8],
  ]
  c.fillStyle = "#f6e9d4"
  c.beginPath()
  trace(c, wobble(body, r, 1.1, 22))
  c.fill()
  // Roof and stripe.
  c.fillStyle = "#3f4c68"
  c.beginPath()
  trace(c, wobble(rect(-L / 2 + 3, top, L - 8 - nose, 9), r, 0.9, 20))
  c.fill()
  c.fillStyle = "#58b8b0"
  c.beginPath()
  trace(c, wobble(rect(-L / 2, -22, L, 6.5), r, 0.8, 22))
  c.fill()
  c.fillStyle = "#f0905e"
  c.beginPath()
  trace(c, wobble(rect(-L / 2, -14, L, 3.2), r, 0.6, 22))
  c.fill()
  // Crayon hatching so the flat fill reads as drawn.
  c.lineCap = "round"
  for (let i = 0; i < 16; i++) {
    const hx = rr(r, -L / 2 + 6, L / 2 - 20)
    const hy = rr(r, top + 12, -12)
    c.strokeStyle = `rgba(200,170,150,${rr(r, 0.12, 0.3)})`
    c.lineWidth = rr(r, 1.5, 3.5)
    c.beginPath()
    c.moveTo(hx, hy)
    c.lineTo(hx + rr(r, 8, 22), hy + rr(r, -2, 2))
    c.stroke()
  }
  // Windows.
  const n = 5
  const ww = (L - 44 - nose) / n
  for (let i = 0; i < n; i++) {
    const wx = -L / 2 + 16 + i * ww
    c.fillStyle = i % 2 ? "#ffd67a" : "#ffe6a0"
    c.beginPath()
    trace(c, wobble(rect(wx, top + 15, ww - 9, 17), r, 0.7, 12))
    c.fill()
  }
  // Doors.
  c.strokeStyle = "rgba(42,36,48,0.5)"
  c.lineWidth = 1.3
  for (const dx of [-L / 2 + 9, L / 2 - 14 - nose]) {
    c.beginPath()
    c.moveTo(dx + gauss(r) * 0.4, top + 12)
    c.lineTo(dx + gauss(r) * 0.4, -9)
    c.stroke()
  }
  // Outline, twice, never quite the same.
  c.strokeStyle = "rgba(42,36,48,0.78)"
  for (let p = 0; p < 2; p++) {
    c.lineWidth = rr(r, 1.2, 2)
    c.beginPath()
    trace(c, wobble(body, r, 1.3, 20))
    c.stroke()
  }
  if (head) {
    c.fillStyle = "#fff6d8"
    c.beginPath()
    c.arc(L / 2 - 3, -15, 3.6, 0, 6.3)
    c.fill()
  }
  if (tail) {
    c.fillStyle = "#ff6f7d"
    c.beginPath()
    c.arc(-L / 2 + 3, -15, 3, 0, 6.3)
    c.fill()
  }
  c.restore()
}

function trainHead(g: Geo, t: number) {
  const trainLen = CARS * (CAR_L + GAP) * g.L.s0
  const start = -60
  const stop = g.station.d + (CARS * (CAR_L + GAP) * g.station.s) / 2 - 20 * g.station.s
  const end = g.total + trainLen + 200
  if (t < 2) return start - trainLen
  if (t < 10.5) return lerp(start - trainLen * 0.2, stop, easeOut((t - 2) / 8.5))
  if (t < 15.5) return stop
  if (t < 25.5) return lerp(stop, end, easeIn((t - 15.5) / 10))
  return end
}

/** Everything that moves. `boil` changes ~8×/s so the hand-drawn jitter is held "on twos". */
export function drawMotion(c: Ctx, g: Geo, time: number, boil: number) {
  const L = g.L
  const { W, H } = L
  const t = ((time % LOOP) + LOOP) % LOOP
  const r = mulberry32(900 + boil * 131)
  const big = L.portrait ? 1.15 : 1

  // ── Sun breathing + shimmer on the sea ──
  c.save()
  c.globalCompositeOperation = "lighter"
  const pulse = 0.5 + 0.5 * Math.sin(time * 0.7)
  glow(c, L.sun[0], L.sun[1], (300 + pulse * 40) * big, "rgba(255,190,130,ALPHA)", 0.1 + pulse * 0.05)
  glow(c, L.sun[0], L.sun[1], 120 * big, "rgba(255,236,180,ALPHA)", 0.16 + pulse * 0.08)
  c.restore()
  c.save()
  c.lineCap = "round"
  for (let i = 0; i < 16; i++) {
    const y = L.hor + 8 + i * 6.5 * big + rr(r, -2, 2)
    const half = rr(r, 8, 34) * (1 + i * 0.06)
    const x = L.sun[0] + gauss(r) * (22 + i * 5)
    c.strokeStyle = `rgba(255,236,196,${rr(r, 0.25, 0.7)})`
    c.lineWidth = rr(r, 1.6, 3.2)
    c.beginPath()
    c.moveTo(x - half, y)
    c.lineTo(x + half, y + gauss(r))
    c.stroke()
  }
  c.restore()

  // ── Star trails turning around the pole ──
  c.save()
  c.lineCap = "round"
  const rot = time * 0.018
  const ceil = L.hor - 0.1 * H
  for (const tr of g.trails) {
    const steps = L.portrait ? 5 : 7
    for (let k = 0; k < steps; k++) {
      const a0 = tr.a0 + rot + (tr.len * k) / steps
      const a1 = tr.a0 + rot + (tr.len * (k + 0.92)) / steps
      const mx = L.trail.x + Math.cos((a0 + a1) / 2) * tr.r
      const my = L.trail.y + Math.sin((a0 + a1) / 2) * tr.r
      if (mx < 0 || mx > W || my < 0 || my > ceil) continue
      const fade = clamp(1 - tr.r / (L.trail.R * 1.02)) ** 0.55 * clamp((ceil - my) / (0.16 * H)) * Math.sin(((k + 0.5) / steps) * Math.PI) ** 0.5
      if (fade < 0.03) continue
      c.strokeStyle = `rgba(255,246,224,${tr.a * fade * rr(r, 0.75, 1)})`
      c.lineWidth = tr.w * big
      c.beginPath()
      c.arc(L.trail.x, L.trail.y, tr.r + gauss(r) * 0.5, a0, a1)
      c.stroke()
    }
  }
  c.restore()

  // ── Twinkles ──
  for (const tw of g.twinkles) {
    const a = 0.35 + 0.65 * Math.abs(Math.sin(time * 0.9 + tw.ph))
    sparkle(c, tw.x, tw.y, tw.s * big * (0.7 + 0.3 * a), "#fff6e0", a * 0.9)
  }

  // ── The silver star ──
  {
    const [sx, sy] = g.star
    const a = 0.5 + 0.5 * Math.sin(time * 1.6)
    c.save()
    c.globalCompositeOperation = "lighter"
    glow(c, sx, sy, (70 + a * 26) * big, "rgba(230,236,255,ALPHA)", 0.22 + a * 0.16)
    c.restore()
    const s = (27 + a * 5) * big
    sparkle(c, sx + gauss(r) * 0.5, sy + gauss(r) * 0.5, s, "#eef1fa", 1, Math.sin(time * 0.5) * 0.12)
    sparkle(c, sx, sy, s * 0.5, "#ffffff", 0.9, Math.PI / 4)
    for (let i = 0; i < 4; i++) {
      const th = time * 0.6 + (i * Math.PI) / 2
      const d = (44 + 6 * Math.sin(time * 2 + i)) * big
      sparkle(c, sx + Math.cos(th) * d, sy + Math.sin(th) * d, 5 * big, "#dfe5ff", 0.4 + 0.5 * Math.abs(Math.sin(time * 1.3 + i)))
    }
  }

  // ── Windows that someone just switched on ──
  c.save()
  c.globalCompositeOperation = "lighter"
  for (let i = 0; i < g.litWins.length; i += 5) {
    const w = g.litWins[i]
    const a = Math.max(0, Math.sin(time * (0.35 + (i % 7) * 0.06) + i * 1.7)) ** 3
    if (a < 0.05) continue
    glow(c, w.x + w.w / 2, w.y + w.h / 2, w.w * 2.4, "rgba(255,206,120,ALPHA)", a * 0.45)
  }
  c.restore()

  // ── Platform lamp: warmer once she has stepped off, and it stays on ──
  const warm = t < 11 ? 0 : t < 13 ? smooth(11, 13, t) : t < 26.4 ? 1 : 1 - smooth(26.4, 28, t)
  {
    const [lx, ly] = g.lamp
    const s = g.station.s
    const flick = 1 + gauss(r) * 0.03
    c.save()
    c.globalCompositeOperation = "lighter"
    glow(c, lx, ly, (70 + warm * 130) * s * flick, "rgba(255,196,110,ALPHA)", 0.3 + warm * 0.42)
    // Pool of light on the platform.
    c.translate(lx, ly + 76 * s)
    c.scale(1, 0.22)
    glow(c, 0, 0, (60 + warm * 80) * s, "rgba(255,214,150,ALPHA)", 0.18 + warm * 0.34)
    c.restore()
    c.fillStyle = "#fff4cf"
    c.beginPath()
    c.arc(lx + gauss(r) * 0.4, ly + gauss(r) * 0.4, (5 + warm * 2.2) * s, 0, 6.3)
    c.fill()
    if (warm > 0.2) sparkle(c, lx, ly, (11 + 5 * Math.sin(time * 2.2)) * s * warm, "#fff6d8", 0.85 * warm)
  }

  // ── The train ──
  {
    const head = trainHead(g, t)
    let d = head
    const cars: { x: number; y: number; ang: number; s: number }[] = []
    for (let i = 0; i < CARS; i++) {
      const pre = g.at(d)
      const s = lerp(L.s0, L.s1, pre.u)
      const centre = g.at(d - (CAR_L / 2) * s)
      cars.push({ x: centre.x, y: centre.y, ang: centre.ang, s: lerp(L.s0, L.s1, centre.u) })
      d -= (CAR_L + GAP) * s
    }
    const onStage = cars.some((k) => k.x > -200 && k.x < W + 200)
    if (onStage) {
      c.save()
      c.globalCompositeOperation = "lighter"
      for (const k of cars) glow(c, k.x, k.y - 30 * k.s, 150 * k.s, "rgba(255,200,120,ALPHA)", 0.2)
      const h = g.at(head + 10)
      glow(c, h.x, h.y - 16 * cars[0].s, 120 * cars[0].s, "rgba(255,240,200,ALPHA)", 0.3)
      c.restore()
      for (let i = CARS - 1; i >= 0; i--) drawCar(c, r, cars[i].x, cars[i].y, cars[i].ang, cars[i].s, i === 0, i === CARS - 1)
    }
  }

  // ── Sprout, swaying ──
  {
    const sp = L.sprout
    const sway = Math.sin(time * 1.25) * 0.09 + Math.sin(time * 2.9) * 0.025
    c.save()
    c.translate(sp.x, sp.y + 4 * sp.s)
    c.scale(sp.s, sp.s)
    c.rotate(sway)
    c.lineCap = "round"
    for (let p = 0; p < 2; p++) {
      c.strokeStyle = p ? "rgba(30,70,60,0.7)" : "#9be0a6"
      c.lineWidth = p ? 1.5 : 5
      c.beginPath()
      c.moveTo(gauss(r) * 0.4, 0)
      c.quadraticCurveTo(5 + gauss(r) * 0.5, -22, 1, -44)
      c.stroke()
    }
    const leaf = (dir: number, len: number, lift: number) => {
      const pts: Pt[] = [
        [1, -44],
        [dir * len * 0.4, -44 - lift - 13],
        [dir * len, -44 - lift],
        [dir * len * 0.5, -44 - lift * 0.2 + 7],
      ]
      c.fillStyle = dir > 0 ? "#a8e6a1" : "#8fd694"
      c.beginPath()
      trace(c, wobble(pts, r, 0.9, 10))
      c.fill()
      c.strokeStyle = "rgba(30,70,60,0.75)"
      c.lineWidth = 1.5
      c.beginPath()
      trace(c, wobble(pts, r, 1, 10))
      c.stroke()
      c.beginPath()
      c.moveTo(1, -44)
      c.lineTo(dir * len * 0.8, -44 - lift * 0.8)
      c.stroke()
    }
    leaf(1, 30, 11 + Math.sin(time * 1.25) * 2)
    leaf(-1, 25, 7 - Math.sin(time * 1.25) * 2)
    c.restore()
    // A drop for the sprout, now and then.
    const dt = (time % 7) / 7
    if (dt < 0.3) {
      const k = dt / 0.3
      c.fillStyle = `rgba(190,236,255,${0.9 * (1 - k * 0.3)})`
      c.beginPath()
      c.ellipse(sp.x + 14 * sp.s, sp.y - (150 - 150 * k * k) * sp.s, 3.2 * sp.s, 5.4 * sp.s, 0, 0, 6.3)
      c.fill()
    }
  }

  // ── Ripples in the puddle ──
  {
    const p = L.puddle
    c.save()
    c.lineWidth = 2
    for (const [off, ox] of [
      [0, -0.3],
      [2.6, 0.35],
    ]) {
      const k = ((time + off) % 5.2) / 5.2
      if (k > 0.75) continue
      const q = k / 0.75
      c.strokeStyle = `rgba(255,246,224,${0.75 * (1 - q)})`
      c.beginPath()
      c.ellipse(p.x + ox * p.rx, p.y + gauss(r) * 0.4, (10 + q * 54) * big, (2.6 + q * 11) * big, 0, 0, 6.3)
      c.stroke()
    }
    c.restore()
  }

  // ── Confetti ──
  c.save()
  c.lineCap = "round"
  const band = L.hor + 0.14 * H
  for (const f of g.confetti) {
    const x = ((((f.x * (W + 80) + f.vx * time) % (W + 80)) + (W + 80)) % (W + 80)) - 40
    const yy = (((f.y * band + f.vy * time) % band) + band) % band
    const y = yy + Math.sin(time * 0.8 + f.ph) * 16
    const edge = Math.min(1, yy / 60, (band - yy) / 90)
    const th = f.ph + time * f.spin
    c.strokeStyle = f.col
    c.globalAlpha = 0.92 * clamp(edge)
    c.lineWidth = f.s * 0.62
    c.beginPath()
    c.moveTo(x - Math.cos(th) * f.s * 0.5, y - Math.sin(th) * f.s * 0.5)
    c.lineTo(x + Math.cos(th) * f.s * 0.5, y + Math.sin(th) * f.s * 0.5)
    c.stroke()
  }
  c.restore()
}
