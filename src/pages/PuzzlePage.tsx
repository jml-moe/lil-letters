import { useEffect, useLayoutEffect, useRef, useState } from 'react'

type Sign = -1 | 0 | 1

type Piece = {
  fill: string
  shade: string
  ink: string
  quote: string
  label: string
  /** Where the piece drifts to before it is placed, in units of piece size. */
  driftX: number
  driftY: number
  tilt: number
}

/**
 * The board reflows instead of shrinking: three columns on desktop, two on
 * tablets, a single readable column on phones. Six pieces either way, so the
 * jigsaw stays a complete rectangle at every breakpoint.
 */
function layoutFor(width: number) {
  if (width < 560) return { cols: 1, rows: 6, ratio: 0.5 }
  if (width < 900) return { cols: 2, rows: 3, ratio: 0.64 }
  return { cols: 3, rows: 2, ratio: 0.78 }
}

const PIECES: Piece[] = [
  {
    fill: '#FBD9C1',
    shade: '#F6C7A6',
    ink: '#C3743F',
    quote:
      'Kamu tidak perlu melakukan hal luar biasa untuk jadi istimewa. Kamu sudah cukup, persis seperti ini.',
    label: 'A LITTLE REMINDER',
    driftX: -0.34,
    driftY: -0.26,
    tilt: -6.5,
  },
  {
    fill: '#C6D9F8',
    shade: '#B2C9EF',
    ink: '#5079BE',
    quote:
      'Semoga ada sesuatu yang kecil hari ini yang membuatmu tersenyum selebar itu.',
    label: 'FOR YOUR SMILE',
    driftX: 0.1,
    driftY: -0.36,
    tilt: 4.5,
  },
  {
    fill: '#D2E9B4',
    shade: '#C0DE9C',
    ink: '#75A044',
    quote:
      'Kehadiranmu membuat hari seseorang terasa jauh lebih hangat. Iya, serius.',
    label: 'JUST SO YOU KNOW',
    driftX: 0.33,
    driftY: -0.2,
    tilt: 7,
  },
  {
    fill: '#FBCFE0',
    shade: '#F5BAD1',
    ink: '#CB6089',
    quote:
      'Pelan-pelan juga tidak apa-apa. Kamu tidak sedang terlambat ke mana-mana.',
    label: 'TAKE YOUR TIME',
    driftX: -0.36,
    driftY: 0.24,
    tilt: 5.5,
  },
  {
    fill: '#DDCFFB',
    shade: '#CDBAF6',
    ink: '#8567D3',
    quote:
      'Ada hal-hal baik yang datang ke dunia ini hanya karena kamu ada di dalamnya.',
    label: 'A SMALL TRUTH',
    driftX: -0.04,
    driftY: 0.34,
    tilt: -5,
  },
  {
    fill: '#C2E9DC',
    shade: '#ACDECE',
    ink: '#489B84',
    quote:
      'Semoga hari ini lembut padamu. Kalau tidak, semoga kamu tetap lembut pada dirimu sendiri.',
    label: 'SOFT DAY AHEAD',
    driftX: 0.36,
    driftY: 0.28,
    tilt: -7,
  },
]

const HINT_DEFAULT = 'Klik kepingan yang menyala untuk menyusunnya ♡'
const HINT_WRONG = 'Yang menyala dulu, ya ✨'
const HINT_DONE = 'Selesai. Semoga ada satu yang nyangkut di hatimu ♡'

/**
 * Tabs alternate in a checkerboard so every seam has exactly one knob and one
 * socket, and the four outer sides of the 3x2 rectangle stay perfectly flat.
 */
function edgesFor(row: number, col: number, cols: number, rows: number) {
  const seamV = (r: number, c: number): Sign => ((r + c) % 2 === 0 ? 1 : -1)
  const seamH = (r: number, c: number): Sign => ((r + c) % 2 === 0 ? 1 : -1)
  return {
    top: row === 0 ? 0 : ((-seamH(row - 1, col)) as Sign),
    right: col === cols - 1 ? 0 : seamV(row, col),
    bottom: row === rows - 1 ? 0 : seamH(row, col),
    left: col === 0 ? 0 : ((-seamV(row, col - 1)) as Sign),
  }
}

/** One side of the outline: straight run, mushroom knob (or socket), straight run. */
function side(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  sign: Sign,
  knob: number,
) {
  if (sign === 0) return `L ${bx} ${by}`
  const len = Math.hypot(bx - ax, by - ay)
  const ux = (bx - ax) / len
  const uy = (by - ay) / len
  // Outward normal for a clockwise outline, flipped for sockets.
  const nx = uy * sign
  const ny = -ux * sign
  const at = (t: number, out: number) =>
    `${(ax + ux * len * t + nx * out * knob).toFixed(2)} ${(ay + uy * len * t + ny * out * knob).toFixed(2)}`

  // Wide and shallow, with a slight undercut at the neck — a printed jigsaw
  // tab, not a balloon.
  return [
    `L ${at(0.36, 0)}`,
    `C ${at(0.3, 0.22)} ${at(0.31, 0.62)} ${at(0.5, 0.62)}`,
    `C ${at(0.69, 0.62)} ${at(0.7, 0.22)} ${at(0.64, 0)}`,
    `L ${bx} ${by}`,
  ].join(' ')
}

function outline(
  row: number,
  col: number,
  cols: number,
  rows: number,
  w: number,
  h: number,
  pad: number,
  knob: number,
) {
  const e = edgesFor(row, col, cols, rows)
  const x0 = pad
  const y0 = pad
  const x1 = pad + w
  const y1 = pad + h
  return [
    `M ${x0} ${y0}`,
    side(x0, y0, x1, y0, e.top, knob),
    side(x1, y0, x1, y1, e.right, knob),
    side(x1, y1, x0, y1, e.bottom, knob),
    side(x0, y1, x0, y0, e.left, knob),
    'Z',
  ].join(' ')
}

export default function PuzzlePage() {
  const stageRef = useRef<HTMLDivElement>(null)
  const [boardW, setBoardW] = useState(1020)
  const [placed, setPlaced] = useState(0)
  const [hint, setHint] = useState(HINT_DEFAULT)
  const [shaking, setShaking] = useState<number | null>(null)
  const [round, setRound] = useState(0)

  useLayoutEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => setBoardW(Math.min(el.clientWidth, 1020))
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (shaking === null) return
    const id = window.setTimeout(() => setShaking(null), 300)
    return () => window.clearTimeout(id)
  }, [shaking])

  // Surface scrollbars only while the page is actually moving.
  useEffect(() => {
    let id = 0
    const onScroll = () => {
      document.documentElement.classList.add('is-scrolling')
      window.clearTimeout(id)
      id = window.setTimeout(
        () => document.documentElement.classList.remove('is-scrolling'),
        700,
      )
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(id)
    }
  }, [])

  const { cols, rows, ratio } = layoutFor(boardW)
  const pw = boardW / cols
  const ph = pw * ratio
  // A full-width piece has nowhere to drift sideways, so scatter vertically.
  const driftScaleX = cols === 1 ? 0 : 1
  const driftScaleY = rows > 2 ? 0.45 : 1
  const tiltScale = cols === 1 ? 0.35 : 1
  const knob = Math.min(pw, ph) * 0.16
  const pad = knob * 1.25
  // Extrusion depth: the piece reads as a physical slab lit from above.
  const depth = Math.max(3, ph * 0.016)
  const done = placed === PIECES.length
  const scale = Math.min(pw / 340, 1.05)

  const handleClick = (index: number) => {
    if (index < placed) return
    if (index === placed) {
      setPlaced(index + 1)
      setHint(index + 1 === PIECES.length ? HINT_DONE : HINT_DEFAULT)
    } else {
      setShaking(index)
      setHint(HINT_WRONG)
    }
  }

  const restart = () => {
    setPlaced(0)
    setHint(HINT_DEFAULT)
    setRound((r) => r + 1)
  }

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-white px-4 pb-20 pt-24 sm:px-6 sm:pb-28 sm:pt-28">
      <header className="mx-auto max-w-2xl text-center">
        <p className="mono text-[11px] tracking-[0.22em] text-[#9a9aa4]">
          FOR SOMEONE SPECIAL
        </p>
        <h1 className="mt-4 text-[clamp(1.9rem,6vw,3.1rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[#16161a]">
          A little quote for you.
        </h1>
        <p
          key={hint}
          className="mt-4 text-[13px] text-[#8b8b95] transition-opacity duration-500 sm:text-sm"
        >
          {hint}
        </p>
      </header>

      <section
        ref={stageRef}
        className="mx-auto mt-10 w-full max-w-[1020px] sm:mt-20"
      >
        <div
          className="relative mx-auto"
          style={{ width: boardW, height: ph * rows }}
        >
          {/* Faint outline of where every piece belongs. */}
          <div
            className="ghost-layer absolute inset-0"
            style={{ opacity: done ? 0 : 1 }}
            aria-hidden
          >
            {PIECES.map((_, i) => {
              const row = Math.floor(i / cols)
              const col = i % cols
              const path = outline(row, col, cols, rows, pw, ph, pad, knob)
              return (
                <div
                  key={`ghost-${i}`}
                  className="absolute"
                  style={{
                    left: col * pw - pad,
                    top: row * ph - pad,
                    width: pw + pad * 2,
                    height: ph + pad * 2,
                  }}
                >
                  <div
                    className="absolute inset-0"
                    style={{ background: '#d6d6dc', clipPath: `path('${path}')` }}
                  />
                  <div
                    className="absolute inset-0"
                    style={{
                      background: '#ffffff',
                      clipPath: `path('${path}')`,
                      transform: 'scale(0.9975)',
                    }}
                  />
                </div>
              )
            })}
          </div>

          {PIECES.map((p, i) => {
            const row = Math.floor(i / cols)
            const col = i % cols
            const path = outline(row, col, cols, rows, pw, ph, pad, knob)
            const e = edgesFor(row, col, cols, rows)
            // A socket bites into the piece's own body, so text has to clear it.
            const sideIns = cols === 1 ? pw * 0.07 : pw * 0.1
            const leftIns = sideIns + (e.left === -1 ? knob : 0)
            const rightIns = sideIns + (e.right === -1 ? knob : 0)
            const topIns = ph * 0.13 + (e.top === -1 ? knob * 0.35 : 0)
            const isPlaced = i < placed
            const isActive = i === placed
            const rest = isPlaced
              ? 'translate(0px, 0px) rotate(0deg)'
              : `translate(${(p.driftX * pw * driftScaleX).toFixed(1)}px, ${(p.driftY * ph * driftScaleY).toFixed(1)}px) rotate(${(p.tilt * tiltScale).toFixed(1)}deg)`

            return (
              <div
                key={`${round}-${i}`}
                role="button"
                tabIndex={isPlaced ? -1 : 0}
                aria-label={`Kepingan ${i + 1}`}
                onClick={() => handleClick(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleClick(i)
                  }
                }}
                className={[
                  'piece outline-none',
                  isPlaced ? '' : 'is-loose',
                  isActive ? 'is-active' : '',
                  shaking === i ? 'is-shaking' : '',
                ].join(' ')}
                style={
                  {
                    left: col * pw - pad,
                    top: row * ph - pad,
                    width: pw + pad * 2,
                    height: ph + pad * 2,
                    zIndex: isPlaced ? 10 + i : 30 + i,
                    '--rest': rest,
                    '--glow': `${p.ink}66`,
                  } as React.CSSProperties
                }
              >
                {/* Soft halo, cast shadow, colored lip, then the face on top. */}
                <div
                  className="piece-glow"
                  style={{
                    background: p.ink,
                    clipPath: `path('${path}')`,
                    filter: `blur(${Math.round(depth * 2.4)}px)`,
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: 'rgba(24, 24, 32, 0.13)',
                    clipPath: `path('${path}')`,
                    transform: `translateY(${(depth * 1.7).toFixed(1)}px)`,
                    filter: `blur(${(depth * 0.8).toFixed(1)}px)`,
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: `color-mix(in srgb, ${p.ink} 78%, ${p.fill})`,
                    clipPath: `path('${path}')`,
                    transform: `translateY(${depth.toFixed(1)}px)`,
                  }}
                />
                <div
                  className="absolute inset-0"
                  style={{
                    background: p.fill,
                    clipPath: `path('${path}')`,
                  }}
                />
                <div
                  className={`quote-body absolute ${isPlaced ? 'is-visible' : ''}`}
                  style={{
                    left: pad + leftIns,
                    top: pad + topIns,
                    width: pw - leftIns - rightIns,
                  }}
                >
                  <span
                    className="block font-bold leading-none"
                    style={{ color: p.ink, fontSize: 28 * scale, opacity: 0.75 }}
                  >
                    &ldquo;
                  </span>
                  <p
                    className="text-[#2a2a33]"
                    style={{
                      marginTop: 6 * scale,
                      fontSize: Math.max(11.5, 14.5 * scale),
                      lineHeight: 1.52,
                    }}
                  >
                    {p.quote}
                  </p>
                  <p
                    className="mono tracking-[0.16em]"
                    style={{
                      color: p.ink,
                      marginTop: 14 * scale,
                      fontSize: Math.max(8.5, 10 * scale),
                    }}
                  >
                    {p.label}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="mt-10 flex h-12 items-center justify-center sm:mt-16">
        <button
          type="button"
          onClick={restart}
          className="replay mono rounded-full border border-[#e6e6ec] px-6 py-3 text-[11px] tracking-[0.16em] text-[#5c5c66] hover:border-[#d0d0da] hover:bg-[#fafafc]"
          style={{
            opacity: done ? 1 : 0,
            transform: done ? 'none' : 'translateY(8px)',
            pointerEvents: done ? 'auto' : 'none',
          }}
        >
          main lagi ↻
        </button>
      </div>

    </main>
  )
}
