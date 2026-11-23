import { type Canvas, type Pt, type RGB, Painter, crayon, css, ctx2d, getTiles, hex, jit, makeCanvas, mix, pencil, scumble, trace, wobble } from "./brushes"
import { type RNG, clamp, gauss, lerp, mulberry32, pick, rr } from "./rng"

type Ctx = CanvasRenderingContext2D

// ─── Layout: one scene, two compositions ──────────────────────────────────────

export interface Layout {
  W: number
  H: number
  portrait: boolean
  /** Sea horizon. */
  hor: number
  sun: Pt
  trail: { x: number; y: number; R: number }
  moon: { x: number; y: number; r: number }
  rail: [Pt, Pt, Pt, Pt]
  stationU: number
  s0: number
  s1: number
  /** Top of the foreground grass. */
  fg: number
  cloud: { x: number; y: number; s: number }
  townL: { x0: number; x1: number; n: number }
  townR: { x0: number; x1: number; n: number }
  puddle: { x: number; y: number; rx: number; ry: number }
  sprout: { x: number; y: number; s: number }
  font: number
  confetti: number
}

export function makeLayout(portrait: boolean): Layout {
  if (portrait) {
    const W = 1080
    const H = 1350
    return {
      W,
      H,
      portrait,
      hor: 0.5 * H,
      sun: [0.47 * W, 0.5 * H],
      trail: { x: 0.16 * W, y: 0.07 * H, R: 0.72 * W },
      moon: { x: 0.6 * W, y: 0.115 * H, r: 30 },
      rail: [
        [-140, 0.842 * H],
        [0.46 * W, 0.812 * H],
        [0.6 * W, 0.628 * H],
        [W + 120, 0.6 * H],
      ],
      stationU: 0.3,
      s0: 1.32,
      s1: 0.5,
      fg: 0.895 * H,
      cloud: { x: 0.8 * W, y: 0.37 * H, s: 0.78 },
      townL: { x0: -0.03 * W, x1: 0.64 * W, n: 10 },
      townR: { x0: 0.66 * W, x1: 1.02 * W, n: 10 },
      puddle: { x: 0.69 * W, y: 0.95 * H, rx: 150, ry: 24 },
      sprout: { x: 0.31 * W, y: 0.945 * H, s: 1.55 },
      font: 40,
      confetti: 44,
    }
  }
  const W = 1920
  const H = 1080
  return {
    W,
    H,
    portrait,
    hor: 0.6 * H,
    sun: [0.555 * W, 0.6 * H],
    trail: { x: 0.13 * W, y: 0.09 * H, R: 0.43 * W },
    moon: { x: 0.3 * W, y: 0.14 * H, r: 32 },
    rail: [
      [-140, 0.8 * H],
      [0.3 * W, 0.785 * H],
      [0.62 * W, 0.7 * H],
      [W + 140, 0.708 * H],
    ],
    stationU: 0.34,
    s0: 1.02,
    s1: 0.68,
    fg: 0.865 * H,
    cloud: { x: 0.79 * W, y: 0.44 * H, s: 1 },
    townL: { x0: 0.015 * W, x1: 0.47 * W, n: 12 },
    townR: { x0: 0.69 * W, x1: 1.0 * W, n: 13 },
    puddle: { x: 0.71 * W, y: 0.93 * H, rx: 170, ry: 27 },
    sprout: { x: 0.565 * W, y: 0.925 * H, s: 1.35 },
    font: 34,
    confetti: 72,
  }
}

// ─── Geometry (fixed seed, shared by every boil frame and by the motion layer) ─

export interface Win {
  x: number
  y: number
  w: number
  h: number
  lit: boolean
}
export interface House {
  x: number
  y: number
  w: number
  h: number
  roof: number
  hip: boolean
  wall: RGB
  roofCol: RGB
  row: number
  wins: Win[]
}
export interface RailPt {
  x: number
  y: number
  d: number
  u: number
}
export interface Annot {
  text: string
  x: number
  y: number
  rot: number
  arrow: Pt[]
}

export interface Geo {
  L: Layout
  lut: RailPt[]
  total: number
  at: (d: number) => { x: number; y: number; ang: number; u: number }
  yAt: (x: number) => number
  dOfU: (u: number) => number
  houses: House[]
  litWins: Win[]
  trees: { x: number; y: number; r: number }[]
  poles: { x: number; y: number; h: number }[]
  station: { x: number; y: number; ang: number; s: number; d: number }
  lamp: Pt
  star: Pt
  cloudPuffs: { x: number; y: number; r: number }[]
  smallClouds: { x: number; y: number; r: number }[]
  dots: { x: number; y: number; a: number; s: number }[]
  twinkles: { x: number; y: number; s: number; ph: number }[]
  trails: { r: number; a0: number; len: number; a: number; w: number }[]
  confetti: { x: number; y: number; vx: number; vy: number; ph: number; s: number; col: string; spin: number }[]
  flowers: { x: number; y: number; s: number; col: RGB }[]
  annots: Annot[]
}

const WALLS = ["#e2a77f", "#eec29a", "#d18e6c", "#f1d1a6", "#c98a74", "#e8b48c"].map(hex)
const ROOFS = ["#a4473a", "#c05b3c", "#3f4c68", "#8a3d36", "#5b4a5a"].map(hex)
const CONFETTI = ["#ffe08a", "#ff9fc4", "#9fe6d4", "#ffd0b0", "#fff3dc", "#ffb38a", "#a8e6a1"]

function bez(p: [Pt, Pt, Pt, Pt], t: number): Pt {
  const m = 1 - t
  const a = m * m * m
  const b = 3 * m * m * t
  const c = 3 * m * t * t
  const d = t * t * t
  return [a * p[0][0] + b * p[1][0] + c * p[2][0] + d * p[3][0], a * p[0][1] + b * p[1][1] + c * p[2][1] + d * p[3][1]]
}

export function buildGeo(L: Layout): Geo {
  const r = mulberry32(20260807)
  const { W, H } = L
  const sAt = (u: number) => lerp(L.s0, L.s1, u)

  // Rail lookup table.
  const lut: RailPt[] = []
  const N = 260
  let acc = 0
  let prev = bez(L.rail, 0)
  for (let i = 0; i <= N; i++) {
    const p = bez(L.rail, i / N)
    acc += Math.hypot(p[0] - prev[0], p[1] - prev[1])
    lut.push({ x: p[0], y: p[1], d: acc, u: i / N })
    prev = p
  }
  const total = acc
  const at = (d: number) => {
    const a0 = lut[0]
    const a1 = lut[1]
    const z0 = lut[N - 1]
    const z1 = lut[N]
    if (d <= 0) {
      const k = d / a1.d
      return { x: a0.x + (a1.x - a0.x) * k, y: a0.y + (a1.y - a0.y) * k, ang: Math.atan2(a1.y - a0.y, a1.x - a0.x), u: 0 }
    }
    if (d >= total) {
      const k = (d - total) / (z1.d - z0.d)
      return { x: z1.x + (z1.x - z0.x) * k, y: z1.y + (z1.y - z0.y) * k, ang: Math.atan2(z1.y - z0.y, z1.x - z0.x), u: 1 }
    }
    let lo = 0
    let hi = N
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1
      if (lut[m].d <= d) lo = m
      else hi = m
    }
    const a = lut[lo]
    const b = lut[hi]
    const k = (d - a.d) / (b.d - a.d || 1)
    return { x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), ang: Math.atan2(b.y - a.y, b.x - a.x), u: lerp(a.u, b.u, k) }
  }
  const idxAtX = (x: number) => {
    let i = 0
    while (i < N && lut[i + 1].x < x) i++
    return i
  }
  const yAt = (x: number) => {
    if (x <= lut[0].x) return lut[0].y
    if (x >= lut[N].x) return lut[N].y
    const i = idxAtX(x)
    const a = lut[i]
    const b = lut[i + 1]
    return lerp(a.y, b.y, (x - a.x) / (b.x - a.x || 1))
  }
  const uAtX = (x: number) => lut[idxAtX(clamp(x, lut[0].x, lut[N].x - 1))].u
  const dOfU = (u: number) => lut[Math.round(clamp(u) * N)].d

  // Station.
  const sd = dOfU(L.stationU)
  const sp = at(sd)
  const ss = sAt(L.stationU)
  const station = { x: sp.x, y: sp.y, ang: sp.ang, s: ss, d: sd }
  const loc = (lx: number, ly: number): Pt => [
    sp.x + (lx * Math.cos(sp.ang) - ly * Math.sin(sp.ang)) * ss,
    sp.y + (lx * Math.sin(sp.ang) + ly * Math.cos(sp.ang)) * ss,
  ]
  const lamp = loc(118, -96)

  // Towns.
  const houses: House[] = []
  const trees: Geo["trees"] = []
  const town = (x0: number, x1: number, n: number) => {
    for (let row = 1; row >= 0; row--) {
      for (let i = 0; i < n; i++) {
        const x = lerp(x0, x1, (i + rr(r, 0.05, 0.8)) / n)
        const s = sAt(uAtX(x)) * (row ? 0.8 : 1)
        const w = rr(r, 62, 112) * s
        const h = rr(r, 58, 132) * s * (row ? 1.15 : 1)
        if (Math.abs(x + w / 2 - sp.x) < 150 * ss && !row) continue
        const y = yAt(x + w / 2) - rr(r, 6, 16) * s - row * 30 * s
        const wins: Win[] = []
        const cols = Math.max(1, Math.floor(w / (27 * s)))
        const rows = Math.max(1, Math.floor(h / (33 * s)))
        const cw = w / cols
        const ch = (h - 8 * s) / rows
        for (let a = 0; a < cols; a++)
          for (let b = 0; b < rows; b++) {
            if (r() < 0.18) continue
            wins.push({
              x: x + a * cw + cw * 0.26,
              y: y - h + 9 * s + b * ch + ch * 0.14,
              w: cw * 0.48,
              h: ch * 0.52,
              lit: r() < (row ? 0.42 : 0.58),
            })
          }
        houses.push({
          x,
          y,
          w,
          h,
          roof: rr(r, 20, 42) * s,
          hip: r() < 0.4,
          wall: mix(pick(r, WALLS), hex("#c98f7c"), row ? 0.45 : 0),
          roofCol: mix(pick(r, ROOFS), hex("#8f6a72"), row ? 0.4 : 0),
          row,
          wins,
        })
        if (r() < 0.5) trees.push({ x: x + w + rr(r, -6, 14) * s, y: y - rr(r, 14, 30) * s, r: rr(r, 20, 38) * s })
      }
    }
  }
  town(L.townL.x0, L.townL.x1, L.townL.n)
  town(L.townR.x0, L.townR.x1, L.townR.n)
  houses.sort((a, b) => b.row - a.row || a.x - b.x)
  const litWins = houses.flatMap((h) => h.wins.filter((w) => w.lit))

  // Telegraph poles along the far side of the track.
  const poles: Geo["poles"] = []
  for (let u = 0.03; u < 1; u += L.portrait ? 0.085 : 0.066) {
    if (Math.abs(u - L.stationU) < 0.07) continue
    const p = at(dOfU(u))
    poles.push({ x: p.x, y: p.y - 5 * sAt(u), h: 104 * sAt(u) })
  }

  // Clouds.
  const cloudPuffs: Geo["cloudPuffs"] = []
  const cs = L.cloud.s
  const tiers = 7
  for (let t = 0; t < tiers; t++) {
    const k = t / (tiers - 1)
    const width = lerp(330, 120, k ** 0.8) * cs
    const cy = L.cloud.y - k * 380 * cs
    const count = Math.round(lerp(7, 3, k))
    for (let i = 0; i < count; i++) {
      cloudPuffs.push({
        x: L.cloud.x + rr(r, -width, width) + k * 40 * cs,
        y: cy + rr(r, -26, 26) * cs,
        r: rr(r, 70, 122) * cs * lerp(1, 0.72, k),
      })
    }
  }
  const smallClouds: Geo["smallClouds"] = []
  const bank = (cx: number, cy: number, n: number, sc: number) => {
    for (let i = 0; i < n; i++) smallClouds.push({ x: cx + (i - n / 2) * 62 * sc + rr(r, -14, 14), y: cy + rr(r, -12, 12), r: rr(r, 34, 58) * sc })
  }
  if (L.portrait) {
    bank(0.2 * W, 0.37 * H, 6, 0.9)
    bank(0.42 * W, 0.44 * H, 5, 0.7)
  } else {
    bank(0.2 * W, 0.42 * H, 7, 1)
    bank(0.46 * W, 0.5 * H, 6, 0.75)
    bank(0.06 * W, 0.5 * H, 4, 0.7)
  }

  // Night-side sky.
  const dots: Geo["dots"] = []
  for (let i = 0; i < 190; i++) {
    const x = r() * W
    const y = r() * L.hor * 0.7
    const dark = clamp(1.25 - Math.hypot(x - L.trail.x, y - L.trail.y) / L.trail.R)
    if (r() < dark) dots.push({ x, y, a: rr(r, 0.3, 0.95) * dark, s: rr(r, 1, 2.6) })
  }
  const twinkles: Geo["twinkles"] = []
  for (let i = 0; i < 11; i++) {
    const th = rr(r, -0.1, Math.PI / 2 + 0.1)
    const d = rr(r, 0.15, 0.95) * L.trail.R
    const x = L.trail.x + Math.cos(th) * d
    const y = L.trail.y + Math.sin(th) * d * 0.6
    if (y < L.hor * 0.62 && x < W - 40) twinkles.push({ x, y, s: rr(r, 7, 15), ph: r() * 6.28 })
  }
  const trails: Geo["trails"] = []
  for (let i = 0; i < 74; i++) {
    trails.push({
      r: rr(r, 0.06, 1) * L.trail.R,
      a0: r() * Math.PI * 2,
      len: rr(r, 0.22, 0.85),
      a: rr(r, 0.3, 0.85),
      w: rr(r, 1.6, 3.4),
    })
  }

  const star: Pt = L.portrait ? [0.33 * W, 0.275 * H] : [sp.x + 0.035 * W, 0.3 * H]

  const confetti: Geo["confetti"] = []
  for (let i = 0; i < L.confetti; i++) {
    confetti.push({
      x: r(),
      y: r(),
      vx: rr(r, 10, 30),
      vy: rr(r, 5, 15),
      ph: r() * 6.28,
      s: rr(r, 9, 17) * (L.portrait ? 1.15 : 1),
      col: pick(r, CONFETTI),
      spin: rr(r, -1.2, 1.2),
    })
  }

  const flowers: Geo["flowers"] = []
  const fcols = ["#ff9fc4", "#ffe08a", "#fff3dc", "#ffd0b0"].map(hex)
  for (let i = 0; i < (L.portrait ? 46 : 70); i++) {
    const x = r() * W
    const y = rr(r, L.fg + 26, H - 26)
    if (Math.hypot((x - L.puddle.x) / (L.puddle.rx + 26), (y - L.puddle.y) / (L.puddle.ry + 18)) < 1) continue
    if (Math.hypot(x - L.sprout.x, y - L.sprout.y) < 70) continue
    flowers.push({ x, y, s: rr(r, 3.2, 6.5) * lerp(0.8, 1.4, (y - L.fg) / (H - L.fg)), col: pick(r, fcols) })
  }

  // Handwritten notes.
  const annots: Annot[] = L.portrait
    ? [
        {
          text: "stasiunmu",
          x: lamp[0] + 170,
          y: lamp[1] - 176,
          rot: -0.07,
          arrow: [
            [lamp[0] + 140, lamp[1] - 152],
            [lamp[0] + 100, lamp[1] - 96],
            [lamp[0] + 26, lamp[1] - 34],
          ],
        },
        {
          text: "perak, tentu saja",
          x: star[0] + 250,
          y: star[1] + 62,
          rot: 0.05,
          arrow: [
            [star[0] + 96, star[1] + 52],
            [star[0] + 62, star[1] + 44],
            [star[0] + 34, star[1] + 22],
          ],
        },
        {
          text: "kotaku, ternyata sebelahan",
          x: 0.725 * W,
          y: 0.805 * H,
          rot: -0.035,
          arrow: [
            [0.9 * W, 0.778 * H],
            [0.945 * W, 0.74 * H],
            [0.93 * W, 0.672 * H],
          ],
        },
      ]
    : [
        {
          text: "stasiunmu",
          x: lamp[0] + 128,
          y: lamp[1] - 118,
          rot: -0.07,
          arrow: [
            [lamp[0] + 100, lamp[1] - 100],
            [lamp[0] + 70, lamp[1] - 60],
            [lamp[0] + 22, lamp[1] - 26],
          ],
        },
        {
          text: "perak, tentu saja",
          x: star[0] + 218,
          y: star[1] - 34,
          rot: -0.05,
          arrow: [
            [star[0] + 84, star[1] - 24],
            [star[0] + 56, star[1] - 22],
            [star[0] + 32, star[1] - 10],
          ],
        },
        {
          text: "kotaku, ternyata sebelahan",
          x: 0.815 * W,
          y: 0.535 * H,
          rot: -0.03,
          arrow: [
            [0.87 * W, 0.553 * H],
            [0.885 * W, 0.58 * H],
            [0.87 * W, 0.612 * H],
          ],
        },
      ]

  return {
    L,
    lut,
    total,
    at,
    yAt,
    dOfU,
    houses,
    litWins,
    trees,
    poles,
    station,
    lamp,
    star,
    cloudPuffs,
    smallClouds,
    dots,
    twinkles,
    trails,
    confetti,
    flowers,
    annots,
  }
}

// ─── Colour ───────────────────────────────────────────────────────────────────

const SKY: [number, RGB][] = [
  [0, hex("#16233f")],
  [0.2, hex("#22426a")],
  [0.42, hex("#3f6d8f")],
  [0.62, hex("#c9877a")],
  [0.78, hex("#f0905e")],
  [0.91, hex("#f8b05a")],
  [1, hex("#fdd889")],
]
const NIGHT = hex("#0f1a33")
const WARM = hex("#ffb068")

export function skyColor(L: Layout, x: number, y: number): RGB {
  const t = clamp(y / L.hor)
  let c = SKY[SKY.length - 1][1]
  for (let i = 0; i < SKY.length - 1; i++) {
    if (t <= SKY[i + 1][0]) {
      c = mix(SKY[i][1], SKY[i + 1][1], (t - SKY[i][0]) / (SKY[i + 1][0] - SKY[i][0]))
      break
    }
  }
  const warm = clamp(1 - Math.hypot(x - L.sun[0], (y - L.sun[1]) * 1.25) / (0.62 * L.W)) ** 2
  c = mix(c, WARM, warm * 0.55)
  const night = clamp(1 - Math.hypot(x - L.trail.x, y - L.trail.y) / (L.trail.R * 1.05))
  return mix(c, NIGHT, night * 0.55)
}

// ─── Baking one boil frame ────────────────────────────────────────────────────

const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

const INK = hex("#2a2430")

function drawHouse(c: Ctx, r: RNG, h: House) {
  const s = h.w / 90
  const wall = wobble(rect(h.x, h.y - h.h, h.w, h.h + 4), r, 1.6, 16)
  crayon(c, r, wall, [h.wall, mix(h.wall, hex("#8a4f45"), 0.3)], { ang: 1.45, sp: 6, len: [14, 40], w: [3, 7], base: 0.8 })
  // Dawn catches the sun-facing edge.
  c.save()
  c.beginPath()
  trace(c, wall)
  c.clip()
  scumble(c, r, h.x + h.w * 0.94, h.y - h.h * 0.5, h.w * 0.12, h.h * 0.5, [hex("#ffc27e"), hex("#ff9a6a")], 16, { w: [3, 8], a: [0.12, 0.3], rad: [5, 14] })
  c.restore()
  const top = h.y - h.h
  const roof: Pt[] = h.hip
    ? [
        [h.x - 6 * s, top + 3],
        [h.x + h.w * 0.2, top - h.roof],
        [h.x + h.w * 0.8, top - h.roof],
        [h.x + h.w + 6 * s, top + 3],
      ]
    : [
        [h.x - 7 * s, top + 3],
        [h.x + h.w * 0.5, top - h.roof * 1.15],
        [h.x + h.w + 7 * s, top + 3],
      ]
  crayon(c, r, wobble(roof, r, 1.4, 14), [h.roofCol, mix(h.roofCol, INK, 0.35)], { ang: 0.25, sp: 5, len: [12, 34], w: [3, 6], base: 0.85 })
  for (const w of h.wins) {
    const col = w.lit ? pick(r, [hex("#ffd67a"), hex("#ffc27a"), hex("#ffe6a0")]) : hex("#4a3a3c")
    c.globalAlpha = w.lit ? 0.95 : 0.7
    c.fillStyle = css(jit(col, r, 8))
    c.beginPath()
    trace(c, wobble(rect(w.x, w.y, w.w, w.h), r, 0.8, 9))
    c.fill()
  }
  c.globalAlpha = 1
  pencil(c, r, rect(h.x, h.y - h.h, h.w, h.h), INK, 1.5 * Math.max(0.7, s), { a: 0.5, closed: true, jit: 1 })
}

function drawStation(c: Ctx, r: RNG, g: Geo) {
  const st = g.station
  c.save()
  c.translate(st.x, st.y)
  c.rotate(st.ang)
  c.scale(st.s, st.s)
  // Building.
  crayon(c, r, wobble(rect(-96, -84, 150, 66), r, 1.5, 14), [hex("#f2e2c8"), hex("#e3c7a8")], { ang: 1.5, sp: 5, len: [12, 30], w: [3, 6], base: 0.9 })
  for (let i = 0; i < 3; i++) {
    c.fillStyle = css(jit(hex("#ffd67a"), r, 8))
    c.beginPath()
    trace(c, wobble(rect(-82 + i * 46, -68, 26, 30), r, 0.9, 9))
    c.fill()
  }
  pencil(c, r, rect(-96, -84, 150, 66), INK, 1.4, { a: 0.5, closed: true })
  // Canopy roof.
  crayon(
    c,
    r,
    wobble(
      [
        [-116, -82],
        [-98, -106],
        [58, -106],
        [150, -80],
        [150, -72],
        [-116, -72],
      ],
      r,
      1.4,
      14,
    ),
    [hex("#c05b3c"), hex("#9a4433")],
    { ang: 0.1, sp: 5, len: [14, 36], w: [3, 6], base: 0.9 },
  )
  // Sign board.
  crayon(c, r, wobble(rect(-64, -124, 76, 20), r, 1, 10), [hex("#fff3dc")], { sp: 5, len: [10, 24], w: [3, 5], base: 0.95 })
  pencil(c, r, [[-52, -114], [0, -114]], hex("#c05b3c"), 2.2, { a: 0.8 })
  pencil(c, r, [[-50, -104], [-50, -124]], INK, 1.2, { a: 0.5 })
  pencil(c, r, [[-2, -104], [-2, -124]], INK, 1.2, { a: 0.5 })
  // Canopy posts.
  for (const x of [70, 142]) pencil(c, r, [[x, -74], [x, -20]], INK, 1.8, { a: 0.7 })
  // Platform slab.
  crayon(c, r, wobble(rect(-150, -24, 320, 17), r, 1.2, 16), [hex("#e7cdb4"), hex("#cfae95")], { ang: 0.02, sp: 5, len: [16, 46], w: [3, 6], base: 0.9 })
  pencil(c, r, [[-150, -8], [170, -8]], INK, 1.3, { a: 0.55 })
  pencil(c, r, [[-146, -19], [166, -19]], hex("#fff3dc"), 1.4, { a: 0.6 })
  // Bench.
  pencil(c, r, [[84, -34], [108, -34]], INK, 2.2, { a: 0.75 })
  pencil(c, r, [[86, -34], [86, -25]], INK, 1.3, { a: 0.7 })
  pencil(c, r, [[106, -34], [106, -25]], INK, 1.3, { a: 0.7 })
  // Lamp post.
  pencil(c, r, [[118, -24], [118, -92]], INK, 2, { a: 0.8 })
  pencil(c, r, [[110, -92], [126, -92]], INK, 2.4, { a: 0.8 })
  c.restore()
}

/** Paints one boil frame layer by layer, yielding between layers so the page stays responsive. */
export function* bakeFrame(g: Geo, seed: number, k = 1): Generator<void, Canvas> {
  const L = g.L
  const { W, H } = L
  const r = mulberry32(seed)
  const P = new Painter(W, H, r, k)
  const big = L.portrait ? 1.1 : 1

  P.c.fillStyle = "#f3ead8"
  P.c.fillRect(0, 0, W, H)

  // Sky: a thin wash first so the crayon gaps show sky, not bare paper.
  {
    const grad = P.c.createLinearGradient(0, 0, 0, L.hor)
    for (const [t, col] of SKY) grad.addColorStop(t, css(mix(col, hex("#f3ead8"), 0.2)))
    P.c.globalAlpha = 0.86
    P.c.fillStyle = grad
    P.c.fillRect(0, 0, W, L.hor + 30)
    P.c.globalAlpha = 1
  }
  P.layer(
    (c) => {
      crayon(c, r, wobble(rect(-20, -20, W + 40, L.hor + 50), r, 0, 80), [], {
        ang: -0.05,
        angJit: 0.09,
        sp: 10.5,
        len: [70, 210],
        w: [7, 18],
        a: [0.3, 0.62],
        jit: 7,
        colorAt: (x, y) => skyColor(L, x, y),
      })
    },
    "streak",
    0.62,
  )
  yield

  // Static star dust + moon.
  P.layer(
    (c) => {
      for (const d of g.dots) {
        c.globalAlpha = d.a
        c.fillStyle = "#fff6e0"
        c.beginPath()
        c.arc(d.x + gauss(r) * 0.5, d.y + gauss(r) * 0.5, d.s, 0, 6.3)
        c.fill()
      }
      c.globalAlpha = 1
      const m = L.moon
      c.fillStyle = "#fff0cf"
      c.beginPath()
      trace(c, wobble(circle(m.x, m.y, m.r, 18), r, 1.1, 12))
      c.fill()
      c.globalCompositeOperation = "destination-out"
      c.beginPath()
      c.arc(m.x + m.r * 0.46, m.y - m.r * 0.22, m.r * 0.92, 0, 6.3)
      c.fill()
    },
    "fine",
    0.22,
  )
  yield

  // Clouds, lit from the sun side.
  P.layer(
    (c) => {
      const shade = ["#4b5f86", "#5e7096", "#7a7f9e"].map(hex)
      const midc = ["#c98a86", "#dd9a84"].map(hex)
      const lit = ["#ff9d6c", "#ffb878", "#ffd99a"].map(hex)
      const puff = (p: { x: number; y: number; r: number }, k: number) => {
        const dx = L.sun[0] - p.x
        const dy = L.sun[1] - p.y
        const dl = Math.hypot(dx, dy) || 1
        scumble(c, r, p.x, p.y, p.r, p.r * 0.82, shade, 60 * k, { w: [18, 42], a: [0.2, 0.4], rad: [12, 40] })
        scumble(c, r, p.x - p.r * 0.1, p.y - p.r * 0.25, p.r * 0.75, p.r * 0.6, midc, 30 * k, { w: [14, 32], a: [0.14, 0.28], rad: [12, 34] })
        scumble(c, r, p.x + (dx / dl) * p.r * 0.55, p.y + (dy / dl) * p.r * 0.5, p.r * 0.5, p.r * 0.44, lit, 34 * k, {
          w: [10, 24],
          a: [0.16, 0.34],
          rad: [10, 28],
        })
      }
      for (const p of g.smallClouds) puff(p, 0.55)
      for (const p of g.cloudPuffs) puff(p, 1)
    },
    "fine",
    0.6,
  )
  yield

  // Sun.
  P.layer(
    (c) => {
      const [sx, sy] = L.sun
      scumble(c, r, sx, sy, 250 * big, 150 * big, [hex("#ffc278"), hex("#ffa860"), hex("#ffe09a")], 170, { w: [14, 34], a: [0.06, 0.16], rad: [14, 44] })
      crayon(c, r, wobble(circle(sx, sy, 64 * big, 22), r, 1.6, 12), [hex("#fff0b0"), hex("#ffd979"), hex("#ffbf5e")], {
        ang: 0.5,
        sp: 5,
        len: [18, 50],
        w: [4, 9],
        base: 0.95,
      })
    },
    "fine",
    0.4,
  )
  yield

  // Far hills.
  const hor = L.hor
  const nx = (v: number) => v * W
  P.layer((c) => {
    const far: Pt[] = [
      [nx(-0.05), hor + 20],
      [nx(-0.05), hor - 0.09 * H],
      [nx(0.06), hor - 0.14 * H],
      [nx(0.13), hor - 0.1 * H],
      [nx(0.2), hor - 0.155 * H],
      [nx(0.29), hor - 0.09 * H],
      [nx(0.36), hor - 0.06 * H],
      [nx(0.43), hor - 0.012 * H],
      [nx(0.45), hor + 20],
    ]
    crayon(c, r, wobble(far, r, 3, 26), [hex("#8d8ea6"), hex("#a38f99"), hex("#7c8298")], { ang: 0.5, sp: 8, len: [24, 70], w: [5, 11], base: 0.75 })
    const near: Pt[] = [
      [nx(-0.05), hor + 20],
      [nx(-0.05), hor - 0.05 * H],
      [nx(0.05), hor - 0.075 * H],
      [nx(0.14), hor - 0.045 * H],
      [nx(0.24), hor - 0.07 * H],
      [nx(0.33), hor - 0.02 * H],
      [nx(0.38), hor + 20],
    ]
    crayon(c, r, wobble(near, r, 3, 26), [hex("#5a6380"), hex("#4b5370")], { ang: 0.4, sp: 8, len: [24, 70], w: [5, 11], base: 0.8 })
  })
  yield

  // Sea.
  P.c.fillStyle = css(hex("#2f4f6e"), 0.9)
  P.c.fillRect(0, hor - 1, W, H - hor + 1)
  P.layer(
    (c) => {
      const deep = hex("#1d3654")
      const top = hex("#5a7d98")
      const glow = hex("#ffb56e")
      crayon(c, r, wobble(rect(-20, hor - 2, W + 40, H - hor + 20), r, 0, 80), [], {
        ang: 0,
        angJit: 0.04,
        sp: 9,
        len: [50, 160],
        w: [5, 11],
        a: [0.35, 0.7],
        colorAt: (x, y) => {
          const t = clamp((y - hor) / (0.2 * H))
          const base = mix(top, deep, t ** 0.7)
          const col = clamp(1 - Math.abs(x - L.sun[0]) / (150 + (y - hor) * 1.6)) * (1 - t * 0.6)
          return mix(base, glow, col * 0.75)
        },
      })
    },
    "streak",
    0.5,
  )
  yield

  // Headland behind the far town.
  P.layer((c) => {
    const head: Pt[] = [
      [nx(0.63), hor + 30],
      [nx(0.67), hor - 0.012 * H],
      [nx(0.74), hor - 0.05 * H],
      [nx(0.82), hor - 0.075 * H],
      [nx(0.9), hor - 0.055 * H],
      [nx(0.97), hor - 0.085 * H],
      [nx(1.05), hor - 0.07 * H],
      [nx(1.05), hor + 0.2 * H],
      [nx(0.63), hor + 0.2 * H],
    ]
    crayon(c, r, wobble(head, r, 3, 26), [hex("#4a4f6a"), hex("#5a5a72"), hex("#3e4560")], { ang: 0.35, sp: 8, len: [24, 70], w: [5, 11], base: 0.82 })
  })
  yield

  // Shore the near town stands on.
  P.layer((c) => {
    const sAt = (u: number) => lerp(L.s0, L.s1, u)
    const x1 = L.townL.x1 + 0.05 * W
    const shore: Pt[] = []
    for (let x = -60; x <= x1; x += 40) {
      const k = clamp((x1 - x) / (0.16 * W))
      const u = clamp((x + 140) / (W + 280))
      shore.push([x, g.yAt(x) - (58 + 22 * Math.sin(x / 90)) * sAt(u) * k ** 0.6])
    }
    shore.push([x1, g.yAt(x1) + 30], [-60, g.yAt(-60) + 30])
    crayon(c, r, wobble(shore, r, 2.5, 26), [hex("#55505e"), hex("#3f5f6a"), hex("#4d4a5c")], { ang: 0.2, sp: 7, len: [20, 60], w: [4, 10], base: 0.85 })
  })
  yield

  // Trees and houses.
  P.layer(
    (c) => {
      const greens = ["#2f5a5c", "#3b7068", "#27484f"].map(hex)
      for (const t of g.trees) {
        scumble(c, r, t.x, t.y, t.r, t.r * 0.9, greens, 34, { w: [6, 14], a: [0.35, 0.7], rad: [5, 14] })
        scumble(c, r, t.x + t.r * 0.3, t.y - t.r * 0.3, t.r * 0.5, t.r * 0.45, [hex("#7cc5a0"), hex("#ffc6a0")], 9, { w: [4, 8], a: [0.2, 0.4], rad: [4, 10] })
      }
      for (const h of g.houses) drawHouse(c, r, h)
    },
    "fine",
    0.55,
  )
  yield

  // Land under the rail.
  const land: Pt[] = g.lut.filter((_, i) => i % 6 === 0).map((p) => [p.x, p.y + 3] as Pt)
  land.push([W + 200, H + 60], [-200, H + 60])
  P.layer((c) => {
    const a = hex("#5a4a52")
    const b = hex("#35596a")
    const d = hex("#2a4a58")
    crayon(c, r, land, [], {
      ang: 0.1,
      sp: 9,
      len: [34, 100],
      w: [5, 12],
      a: [0.4, 0.75],
      colorAt: (x, y) => {
        const t = clamp((y - g.yAt(x)) / (0.16 * H))
        return t < 0.4 ? mix(a, b, t / 0.4) : mix(b, d, (t - 0.4) / 0.6)
      },
    })
  })
  yield
  // Furrows that follow the track, and the first light lying across the field.
  P.layer(
    (c) => {
      const sAt = (u: number) => lerp(L.s0, L.s1, u)
      const pts = g.lut.filter((_, i) => i % 8 === 0)
      const depth = L.fg - 10
      for (let k = 1; k <= 7; k++) {
        const line: Pt[] = []
        for (const p of pts) {
          const y = p.y + (14 + k * k * 3.1) * sAt(p.u) * (L.portrait ? 1.5 : 1)
          if (y < depth && p.x > -40 && p.x < W + 40) line.push([p.x, y])
        }
        if (line.length > 3) pencil(c, r, line, pick(r, [hex("#6fae9c"), hex("#c98f6c"), hex("#5a8f8a")]), 2.2, { a: 0.32, passes: 1, jit: 1.6 })
      }
      const sx = L.sun[0]
      const y0 = g.yAt(sx) + 26
      c.lineCap = "round"
      for (let i = 0; i < 150; i++) {
        const y = rr(r, y0, L.fg - 6)
        const spread = 40 + (y - y0) * 1.9
        const x = sx + gauss(r) * spread
        const half = rr(r, 14, 60)
        c.strokeStyle = css(jit(pick(r, [hex("#ffb06a"), hex("#f0905e"), hex("#ffd59a")]), r, 8), rr(r, 0.07, 0.24))
        c.lineWidth = rr(r, 3, 8)
        c.beginPath()
        c.moveTo(x - half, y + gauss(r) * 1.5)
        c.lineTo(x + half, y + gauss(r) * 1.5)
        c.stroke()
      }
    },
    "fine",
    0.5,
  )
  yield

  // Embankment, sleepers, rails, poles, wires, station.
  P.layer(
    (c) => {
      const sAt = (u: number) => lerp(L.s0, L.s1, u)
      const bed: Pt[] = []
      const pts = g.lut.filter((_, i) => i % 4 === 0)
      for (const p of pts) bed.push([p.x, p.y - 5 * sAt(p.u)])
      for (let i = pts.length - 1; i >= 0; i--) bed.push([pts[i].x, pts[i].y + 15 * sAt(pts[i].u)])
      crayon(c, r, bed, [hex("#3d3238"), hex("#4e3e40"), hex("#30282e")], { ang: 0.05, sp: 5, len: [14, 44], w: [3, 7], base: 0.85 })
      for (let d = 0; d < g.total; d += 15) {
        const p = g.at(d)
        const s = sAt(p.u)
        const nx2 = -Math.sin(p.ang)
        const ny2 = Math.cos(p.ang)
        c.strokeStyle = css(hex("#221a1e"), rr(r, 0.5, 0.85))
        c.lineWidth = rr(r, 2, 3.4) * s
        c.beginPath()
        c.moveTo(p.x - nx2 * 3 * s + gauss(r), p.y - ny2 * 3 * s)
        c.lineTo(p.x + nx2 * 9 * s + gauss(r), p.y + ny2 * 9 * s)
        c.stroke()
      }
      const railLine = (off: number) => pts.map((p) => [p.x, p.y + off * sAt(p.u)] as Pt)
      pencil(c, r, railLine(-1.5), hex("#f4dcc0"), 1.7 * big, { a: 0.85, jit: 0.6 })
      pencil(c, r, railLine(6.5), hex("#f4dcc0"), 2 * big, { a: 0.85, jit: 0.6 })

      for (const p of g.poles) {
        const k = p.h / 104
        pencil(c, r, [[p.x, p.y], [p.x + 1.5 * k, p.y - p.h]], INK, 2.6 * k, { a: 0.85, jit: 0.7 })
        pencil(c, r, [[p.x - 15 * k, p.y - p.h * 0.9], [p.x + 15 * k, p.y - p.h * 0.9]], INK, 2.2 * k, { a: 0.8, jit: 0.5 })
        pencil(c, r, [[p.x - 10 * k, p.y - p.h * 0.78], [p.x + 10 * k, p.y - p.h * 0.78]], INK, 1.8 * k, { a: 0.8, jit: 0.5 })
      }
      for (let i = 0; i < g.poles.length - 1; i++) {
        const a = g.poles[i]
        const b = g.poles[i + 1]
        for (const [off, sag] of [
          [-13, 0.1],
          [12, 0.14],
        ]) {
          const ka = a.h / 104
          const kb = b.h / 104
          const ax = a.x + off * ka
          const ay = a.y - a.h * 0.9
          const bx = b.x + off * kb
          const by = b.y - b.h * 0.9
          const wire: Pt[] = []
          for (let t = 0; t <= 1.001; t += 0.1) wire.push([lerp(ax, bx, t), lerp(ay, by, t) + Math.sin(t * Math.PI) * sag * (a.h + b.h) * 0.5])
          pencil(c, r, wire, INK, 1.1, { a: 0.55, passes: 1, jit: 0.5 })
        }
      }
      drawStation(c, r, g)
    },
    "fine",
    0.45,
  )
  yield

  // Foreground meadow.
  const fgTop: Pt[] = []
  for (let x = -40; x <= W + 40; x += 60) fgTop.push([x, L.fg + Math.sin(x / 210) * 13 + Math.sin(x / 67) * 5])
  const fgShape: Pt[] = [...fgTop, [W + 60, H + 60], [-60, H + 60]]
  P.layer((c) => {
    crayon(c, r, wobble(fgShape, r, 3, 30), [hex("#285656"), hex("#34716a"), hex("#214652"), hex("#3d8272")], {
      ang: -1.25,
      angJit: 0.3,
      sp: 7,
      len: [22, 70],
      w: [4, 10],
      base: 0.9,
      a: [0.3, 0.7],
    })
    // Blades along the ridge and scattered highlights.
    c.lineCap = "round"
    for (let i = 0; i < (L.portrait ? 520 : 820); i++) {
      const x = r() * W
      const onRidge = r() < 0.45
      const y = onRidge ? L.fg + Math.sin(x / 210) * 13 + rr(r, -2, 14) : rr(r, L.fg + 10, H)
      const l = rr(r, 12, 34) * big
      const th = -Math.PI / 2 + gauss(r) * 0.4
      c.strokeStyle = css(jit(pick(r, [hex("#8fd9b6"), hex("#5fae96"), hex("#ffc07a"), hex("#3d8272")]), r, 8), rr(r, 0.3, 0.8))
      c.lineWidth = rr(r, 1.4, 3)
      c.beginPath()
      c.moveTo(x, y)
      c.quadraticCurveTo(x + Math.cos(th) * l * 0.5 + gauss(r) * 3, y + Math.sin(th) * l * 0.5, x + Math.cos(th) * l, y + Math.sin(th) * l)
      c.stroke()
    }
  })
  yield

  // Puddle that holds a piece of the sky; flowers; the little mound for the sprout.
  P.layer(
    (c) => {
      const p = L.puddle
      const shape = wobble(ellipse(p.x, p.y, p.rx, p.ry, 26), r, 2.4, 18)
      crayon(c, r, shape, [hex("#3f6d8f"), hex("#f0905e"), hex("#f8b05a"), hex("#c9877a")], { ang: 0, angJit: 0.06, sp: 5, len: [30, 90], w: [3, 7], base: 0.9 })
      pencil(c, r, ellipse(p.x, p.y, p.rx, p.ry, 26), hex("#1d3a44"), 1.8, { a: 0.5, closed: true })
      pencil(c, r, [[p.x - p.rx * 0.5, p.y - p.ry * 0.25], [p.x - p.rx * 0.1, p.y - p.ry * 0.3]], hex("#fff6e0"), 2.2, { a: 0.8 })
      pencil(c, r, [[p.x + p.rx * 0.2, p.y + p.ry * 0.3], [p.x + p.rx * 0.45, p.y + p.ry * 0.25]], hex("#fff6e0"), 1.8, { a: 0.6 })
      for (const f of g.flowers) {
        for (let k = 0; k < 5; k++) {
          const th = (k / 5) * 6.28 + r()
          c.fillStyle = css(jit(f.col, r, 10), rr(r, 0.7, 0.95))
          c.beginPath()
          c.arc(f.x + Math.cos(th) * f.s * 0.8, f.y + Math.sin(th) * f.s * 0.8, f.s * 0.62, 0, 6.3)
          c.fill()
        }
        c.fillStyle = css(hex("#ffb347"), 0.9)
        c.beginPath()
        c.arc(f.x, f.y, f.s * 0.45, 0, 6.3)
        c.fill()
      }
      const sp = L.sprout
      crayon(c, r, wobble(ellipse(sp.x, sp.y + 7 * sp.s, 36 * sp.s, 11 * sp.s, 14), r, 1.5, 12), [hex("#5a3a30"), hex("#6e4636"), hex("#45302a")], {
        ang: 0.1,
        sp: 4,
        len: [10, 26],
        w: [3, 6],
        base: 0.9,
      })
    },
    "fine",
    0.5,
  )
  yield

  return P.done()
}


/**
 * The handwritten notes. They are lettered on the page (not in the worker)
 * because they need the Allo web font.
 */
export function drawNotes(c: Ctx, g: Geo) {
  const L = g.L
  const r = mulberry32(31)
  const big = L.portrait ? 1.1 : 1
      c.font = `600 ${L.font}px Allo, "Patrick Hand", sans-serif`
      c.textAlign = "center"
      c.textBaseline = "middle"
      for (const a of g.annots) {
        c.save()
        c.translate(a.x + gauss(r) * 0.8, a.y + gauss(r) * 0.8)
        c.rotate(a.rot + gauss(r) * 0.006)
        c.fillStyle = "rgba(40,22,18,0.4)"
        c.fillText(a.text, 2, 2.5)
        c.fillStyle = "#fff3dc"
        c.fillText(a.text, 0, 0)
        c.restore()
        const cream = hex("#fff3dc")
        const curve: Pt[] = []
        for (let t = 0; t <= 1.001; t += 0.125) {
          const m = 1 - t
          curve.push([
            m * m * a.arrow[0][0] + 2 * m * t * a.arrow[1][0] + t * t * a.arrow[2][0],
            m * m * a.arrow[0][1] + 2 * m * t * a.arrow[1][1] + t * t * a.arrow[2][1],
          ])
        }
        pencil(c, r, curve, cream, 2.6 * big, { a: 0.95, jit: 0.8 })
        const tip = a.arrow[2]
        const th = Math.atan2(tip[1] - a.arrow[1][1], tip[0] - a.arrow[1][0])
        const hl = 15 * big
        for (const d of [-0.5, 0.5])
          pencil(c, r, [[tip[0] - Math.cos(th + d) * hl, tip[1] - Math.sin(th + d) * hl], tip], cream, 2.6 * big, { a: 0.95, jit: 0.5 })
      }
}

function circle(x: number, y: number, rad: number, n: number): Pt[] {
  return ellipse(x, y, rad, rad, n)
}
function ellipse(x: number, y: number, rx: number, ry: number, n: number): Pt[] {
  const out: Pt[] = []
  for (let i = 0; i < n; i++) out.push([x + Math.cos((i / n) * 6.2832) * rx, y + Math.sin((i / n) * 6.2832) * ry])
  return out
}

/** Paper margin with a ragged edge plus speckle, drawn over everything each frame. */
export function bakeTop(L: Layout, k = 1): Canvas {
  const { W, H } = L
  const r = mulberry32(5)
  const pw = Math.round(W * k)
  const ph = Math.round(H * k)
  const cv = makeCanvas(pw, ph)
  const c = ctx2d(cv)
  c.fillStyle = c.createPattern(getTiles().grain, "repeat")!
  c.fillRect(0, 0, pw, ph)

  const paper = makeCanvas(pw, ph)
  const p = ctx2d(paper)
  p.setTransform(k, 0, 0, k, 0, 0)
  p.fillStyle = "#f3ead8"
  p.fillRect(0, 0, W, H)
  p.globalCompositeOperation = "destination-out"
  const m = L.portrait ? 26 : 30
  p.beginPath()
  trace(p, wobble(rect(m, m, W - m * 2, H - m * 2), r, 7, 15))
  p.fill()
  // Crayon strokes that overshoot the edge.
  p.lineCap = "round"
  for (let i = 0; i < 520; i++) {
    const side = Math.floor(r() * 4)
    const t = r()
    const len = rr(r, 14, 46)
    p.lineWidth = rr(r, 4, 10)
    p.globalAlpha = rr(r, 0.5, 1)
    p.beginPath()
    if (side === 0) {
      const y = m + t * (H - 2 * m)
      p.moveTo(m + 8, y)
      p.lineTo(m - len * 0.55, y + gauss(r) * 3)
    } else if (side === 1) {
      const y = m + t * (H - 2 * m)
      p.moveTo(W - m - 8, y)
      p.lineTo(W - m + len * 0.55, y + gauss(r) * 3)
    } else if (side === 2) {
      const x = m + t * (W - 2 * m)
      p.moveTo(x, m + 6)
      p.lineTo(x + len, m - rr(r, 0, 9))
    } else {
      const x = m + t * (W - 2 * m)
      p.moveTo(x, H - m - 6)
      p.lineTo(x + len, H - m + rr(r, 0, 9))
    }
    p.stroke()
  }
  c.drawImage(paper, 0, 0)
  paper.width = paper.height = 1
  return cv
}
