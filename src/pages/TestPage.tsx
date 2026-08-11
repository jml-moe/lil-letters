import { useCallback, useEffect, useRef, useState } from 'react'
import paperBallUrl from '../imports/paper-ball.svg'
import paperCrumpleUrl from '../imports/paper-crumple.mp3'

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Note {
  id: number
  body: string
  label: string
}

interface BinBall {
  id: string
  svgSize: number
  offsetX: number
}

interface FlyingBall {
  id: string
  flyingSize: number
  fromX: number
  fromY: number
  toX: number
  toY: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const BIN_W = 164
const BIN_H = 246 // ~2:3 aspect (200:300 viewBox)

// ─── Data ─────────────────────────────────────────────────────────────────────

let _nextId = 1

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBallSizes(note: Note): { svgSize: number; flyingSize: number } {
  const len = note.body.length
  // svgSize: diameter in the SVG viewBox (0 0 200 300) coordinate space
  const svgSize = len < 70 ? 32 : len < 160 ? 44 : len < 280 ? 56 : 68
  // flyingSize: CSS px when airborne — noticeably larger for readability
  const flyingSize = Math.round(svgSize * (BIN_W / 200) * 1.7)
  return { svgSize, flyingSize }
}

// Stacks balls two-per-row inside the SVG cavity
function ballSvgPos(index: number, svgSize: number, offsetX: number): { x: number; y: number } {
  const row = Math.floor(index / 2)
  const col = index % 2
  // Cavity is ~x 22-178 at top, ~38-162 at bottom; center at x=100
  const cx = (col === 0 ? 76 : 124) + offsetX * 0.45
  // Cavity bottom at y≈222 in the 0-300 viewBox
  const cy = 218 - row * svgSize * 0.74
  return { x: cx - svgSize / 2, y: cy - svgSize / 2 }
}

function makeNoteLabel() {
  return new Intl.DateTimeFormat('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date())
}

function createBlankNote(): Note {
  return {
    id: _nextId++,
    body: '',
    label: makeNoteLabel(),
  }
}

// ─── Basket SVG (inline so balls render between back and front layers) ─────────

function BasketSvg({ balls }: { balls: BinBall[] }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 200 300"
      width={BIN_W}
      height={BIN_H}
      style={{ display: 'block' }}
    >
      <defs>
        <pattern id="tp-mesh-back" width="12" height="17" patternUnits="userSpaceOnUse" patternTransform="translate(6 0)">
          <path d="M0 0 L12 17 M12 0 L0 17" stroke="#6b6f78" strokeWidth=".6" fill="none" />
        </pattern>
        <linearGradient id="tp-cavity" gradientUnits="userSpaceOnUse" x1="100" y1="30" x2="100" y2="222">
          <stop offset="0%" stopColor="rgba(38,41,48,.3)" />
          <stop offset="62%" stopColor="rgba(24,27,33,.46)" />
          <stop offset="100%" stopColor="rgba(10,12,16,.62)" />
        </linearGradient>
        <pattern id="tp-mesh-front" width="12" height="17" patternUnits="userSpaceOnUse">
          <path d="M0 0 L12 17 M12 0 L0 17" stroke="#e8ebf0" strokeWidth=".75" fill="none" />
        </pattern>
        <linearGradient id="tp-mesh-shade" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(0,0,0,.36)" />
          <stop offset="18%" stopColor="rgba(0,0,0,0)" />
          <stop offset="50%" stopColor="rgba(255,255,255,.06)" />
          <stop offset="82%" stopColor="rgba(0,0,0,0)" />
          <stop offset="100%" stopColor="rgba(0,0,0,.36)" />
        </linearGradient>
        <linearGradient id="tp-steel" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#edf0f3" />
          <stop offset="16%" stopColor="#b6bbc3" />
          <stop offset="32%" stopColor="#eef1f5" />
          <stop offset="48%" stopColor="#9398a1" />
          <stop offset="61%" stopColor="#c6cbd2" />
          <stop offset="77%" stopColor="#868b95" />
          <stop offset="90%" stopColor="#cfd3d9" />
          <stop offset="100%" stopColor="#edeff3" />
        </linearGradient>
        <linearGradient id="tp-rim-top" x1="0" y1="0" x2="1" y2=".25">
          <stop offset="0%" stopColor="#fbfcfd" />
          <stop offset="30%" stopColor="#caced4" />
          <stop offset="55%" stopColor="#aab0b9" />
          <stop offset="100%" stopColor="#e6e9ed" />
        </linearGradient>
        <pattern id="tp-brush" width="2.4" height="6" patternUnits="userSpaceOnUse">
          <path d="M.6 0 V6 M1.8 0 V6" stroke="rgba(255,255,255,.05)" strokeWidth=".4" />
        </pattern>
        <clipPath id="tp-cavity-clip">
          <path d="M 22 56 L 38 234 A 62 13 0 0 0 162 234 L 178 56 A 78 18 0 0 1 22 56 Z" />
        </clipPath>
      </defs>

      {/* ── Back / cavity layer ── */}
      <g>
        <ellipse cx="100" cy="42" rx="72" ry="16" fill="url(#tp-cavity)" />
        <ellipse cx="100" cy="42" rx="72" ry="16" fill="url(#tp-mesh-back)" opacity=".3" />
        <path d="M 28 42 A 72 16 0 0 1 172 42" fill="none" stroke="#e8ebf0" strokeOpacity=".4" strokeWidth="1" />
        <path d="M 22 56 L 38 234 A 62 13 0 0 0 162 234 L 178 56 A 78 18 0 0 1 22 56 Z" fill="url(#tp-cavity)" />
        <path d="M 22 56 L 38 234 A 62 13 0 0 0 162 234 L 178 56 A 78 18 0 0 1 22 56 Z" fill="url(#tp-mesh-back)" opacity=".46" />
        <ellipse cx="100" cy="220" rx="60" ry="13" fill="rgba(40,43,50,.82)" />
        <ellipse cx="100" cy="218" rx="47" ry="9" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1" />
      </g>

      {/* ── Paper balls — between back and front layers ── */}
      <g clipPath="url(#tp-cavity-clip)">
        {balls.map((ball, i) => {
          const pos = ballSvgPos(i, ball.svgSize, ball.offsetX)
          return (
            <image
              key={ball.id}
              href={paperBallUrl}
              x={pos.x}
              y={pos.y}
              width={ball.svgSize}
              height={ball.svgSize}
              style={{ animation: 'tp-ball-in 0.28s cubic-bezier(0.34,1.56,0.64,1) both' }}
            />
          )
        })}
      </g>

      {/* ── Front / mesh layer ── */}
      <g>
        <path d="M 22 56 L 38 234 A 62 13 0 0 0 162 234 L 178 56 A 78 18 0 0 1 22 56 Z" fill="url(#tp-mesh-front)" opacity=".95" />
        <path d="M 22 56 L 38 234 A 62 13 0 0 0 162 234 L 178 56 A 78 18 0 0 1 22 56 Z" fill="url(#tp-mesh-shade)" />
        <path d="M 38 234 L 41 258 A 59 12 0 0 0 159 258 L 162 234 A 62 13 0 0 1 38 234 Z" fill="url(#tp-steel)" />
        <path d="M 38 234 L 41 258 A 59 12 0 0 0 159 258 L 162 234 A 62 13 0 0 1 38 234 Z" fill="url(#tp-brush)" />
        <path d="M 38 234 A 62 13 0 0 0 162 234" fill="none" stroke="rgba(255,255,255,.5)" strokeWidth="1" />
        <path d="M 41 258 A 59 12 0 0 0 159 258" fill="none" stroke="rgba(0,0,0,.34)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M 20 30 L 22 56 A 78 18 0 0 0 178 56 L 180 30 A 80 20 0 0 1 20 30 Z" fill="url(#tp-steel)" />
        <path d="M 20 30 L 22 56 A 78 18 0 0 0 178 56 L 180 30 A 80 20 0 0 1 20 30 Z" fill="url(#tp-brush)" />
        <path d="M 22 56 A 78 18 0 0 0 178 56" fill="none" stroke="rgba(0,0,0,.26)" strokeWidth="1" strokeLinecap="round" />
        <ellipse cx="100" cy="30" rx="80" ry="20" fill="none" stroke="url(#tp-rim-top)" strokeWidth="4.6" />
        <path d="M 40 16.77 A 80 20 0 0 1 160 16.77" fill="none" stroke="rgba(255,255,255,.8)" strokeWidth="1.4" strokeLinecap="round" />
      </g>
    </svg>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TestPage() {
  const [notes, setNotes] = useState<Note[]>([createBlankNote()])
  const [crumpling, setCrumpling] = useState<Set<number>>(new Set())
  const [flyingBalls, setFlyingBalls] = useState<FlyingBall[]>([])
  const [binBalls, setBinBalls] = useState<BinBall[]>([])
  const [binVisible, setBinVisible] = useState(false)

  const cardRefs = useRef<Map<number, HTMLElement>>(new Map())
  const wrapperRefs = useRef<Map<number, HTMLElement>>(new Map())
  const bodyRefs = useRef<Map<number, HTMLTextAreaElement>>(new Map())
  const inactivityTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const pendingFocusNoteId = useRef<number | null>(null)

  const resizeTextarea = useCallback((noteId: number) => {
    const textarea = bodyRefs.current.get(noteId)
    if (!textarea) return
    textarea.style.height = '0px'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [])

  useEffect(() => {
    if (pendingFocusNoteId.current === null) return
    const textarea = bodyRefs.current.get(pendingFocusNoteId.current)
    if (!textarea) return
    textarea.focus()
    pendingFocusNoteId.current = null
  }, [notes])

  useEffect(() => {
    notes.forEach((note) => resizeTextarea(note.id))
  }, [notes, resizeTextarea])

  const playSound = useCallback(() => {
    try {
      if (!audioRef.current) audioRef.current = new Audio(paperCrumpleUrl)
      audioRef.current.currentTime = 0
      audioRef.current.play()
    } catch {}
  }, [])

  const scheduleHide = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(() => {
      setBinVisible(false)
      setTimeout(() => setBinBalls([]), 600)
    }, 2000)
  }, [])

  const handleDelete = useCallback(
    (noteId: number) => {
      if (crumpling.has(noteId)) return
      const cardEl = cardRefs.current.get(noteId)
      const wrapperEl = wrapperRefs.current.get(noteId)
      if (!cardEl || !wrapperEl) return
      const note = notes.find((n) => n.id === noteId)
      if (!note) return

      // Capture position before any DOM changes
      const rect = cardEl.getBoundingClientRect()
      const { svgSize, flyingSize } = getBallSizes(note)

      playSound()
      setBinVisible(true)
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current)

      // Start crumple on card
      setCrumpling((s) => new Set(s).add(noteId))

      // Collapse wrapper height simultaneously
      const h = wrapperEl.offsetHeight
      wrapperEl.style.height = h + 'px'
      wrapperEl.style.overflow = 'hidden'
      requestAnimationFrame(() => {
        wrapperEl.style.transition = 'height 0.45s ease, margin-bottom 0.45s ease'
        wrapperEl.style.height = '0'
        wrapperEl.style.marginBottom = '0'
      })

      setTimeout(() => {
        // Target: bin mouth (in viewport px)
        const toX = window.innerWidth / 2
        const toY = window.innerHeight - BIN_H + (42 / 300) * BIN_H

        const flyId = `f${noteId}-${Date.now()}`
        setFlyingBalls((prev) => [
          ...prev,
          {
            id: flyId,
            flyingSize,
            fromX: rect.left + rect.width / 2,
            fromY: rect.top + rect.height / 2,
            toX,
            toY,
          },
        ])
        setNotes((prev) => prev.filter((n) => n.id !== noteId))
        setCrumpling((s) => {
          const ns = new Set(s)
          ns.delete(noteId)
          return ns
        })

        // Ball lands in bin
        setTimeout(() => {
          setFlyingBalls((prev) => prev.filter((b) => b.id !== flyId))
          setBinBalls((prev) => [
            ...prev,
            { id: flyId, svgSize, offsetX: Math.random() * 32 - 16 },
          ])
          scheduleHide()
        }, 700)
      }, 450)
    },
    [notes, crumpling, playSound, scheduleHide]
  )

  const addNote = useCallback(() => {
    const next = createBlankNote()
    pendingFocusNoteId.current = next.id
    setNotes((prev) => [next, ...prev])
  }, [])

  const updateNote = useCallback((noteId: number, patch: Partial<Note>) => {
    setNotes((prev) => prev.map((note) => (note.id === noteId ? { ...note, ...patch } : note)))
  }, [])

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0a0a0a',
        paddingTop: '76px',
        paddingBottom: '320px',
        overflowX: 'hidden',
        fontFamily: "'Patrick Hand', 'Bradley Hand', 'Segoe Print', cursive",
      }}
    >
      {/* ── Keyframes ── */}
      <style>{`
        @keyframes tp-crumple {
          0%   { transform: scale(1) rotate(0deg); }
          18%  { transform: scale(0.86) rotate(-4deg) skewX(-2deg); }
          46%  { transform: scale(0.5) rotate(8deg) skewX(4deg); border-radius: 30%; }
          76%  { transform: scale(0.18) rotate(-6deg); border-radius: 50%; opacity: .65; }
          100% { transform: scale(0.05) rotate(3deg); border-radius: 50%; opacity: 0; }
        }
        .tp-crumpling {
          animation: tp-crumple 0.45s cubic-bezier(0.36,0,0.66,-0.15) forwards;
          transform-origin: center center;
          pointer-events: none;
        }
        @keyframes tp-fly {
          0%  { transform: translate(0px, 0px) scale(1); opacity: 1; }
          26% { transform: translate(calc(var(--fdx)*0.26), calc(var(--fdy)*0.26 - 145px)) scale(0.96); opacity: 1; }
          72% { transform: translate(calc(var(--fdx)*0.72), calc(var(--fdy)*0.72 - 28px)) scale(0.84); opacity: 1; }
          100%{ transform: translate(var(--fdx), var(--fdy)) scale(0.68); opacity: 0; }
        }
        @keyframes tp-ball-in {
          from { transform: scale(0.5) translateY(-12px); opacity: 0; }
          to   { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>

      {/* ── Header ── */}
      <div
        style={{
          maxWidth: 400,
          margin: '0 auto',
          padding: '0 18px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span
          style={{
            color: '#f0ede8',
            fontSize: 17,
            fontWeight: 600,
            letterSpacing: '-0.015em',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          Notes
        </span>
        <button
          onClick={addNote}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.10)',
            borderRadius: 8,
            padding: '5px 12px',
            color: 'rgba(255,255,255,0.5)',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          }}
        >
          <PlusIcon />
          Add
        </button>
      </div>

      {/* ── Notes list ── */}
      <div style={{ maxWidth: 400, margin: '0 auto', padding: '0 18px' }}>
        {notes.length === 0 ? (
          <p
            style={{
              color: 'rgba(255,255,255,0.2)',
              fontSize: 14,
              textAlign: 'center',
              paddingTop: 64,
            }}
          >
            No paper yet. Tap Add and write whatever is on your mind.
          </p>
        ) : (
          notes.map((note) => (
            // Outer wrapper: handles height-collapse
            <div
              key={note.id}
              ref={(el) => {
                if (el) wrapperRefs.current.set(note.id, el)
                else wrapperRefs.current.delete(note.id)
              }}
              style={{ marginBottom: 10 }}
            >
              {/* Inner card: handles crumple animation */}
              <div
                ref={(el) => {
                  if (el) cardRefs.current.set(note.id, el)
                  else cardRefs.current.delete(note.id)
                }}
                className={crumpling.has(note.id) ? 'tp-crumpling' : ''}
                style={{
                  background: '#ffffff',
                  borderRadius: 14,
                  padding: '12px 13px 11px',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.6), 0 0 0 0.5px rgba(0,0,0,0.1)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <textarea
                  ref={(el) => {
                    if (el) bodyRefs.current.set(note.id, el)
                    else bodyRefs.current.delete(note.id)
                  }}
                  value={note.body}
                  onChange={(event) => {
                    updateNote(note.id, { body: event.target.value })
                    resizeTextarea(note.id)
                  }}
                  placeholder="Tulis keluhanmu hari ini, uneg-uneg, atau apa pun yang ingin kamu buang."
                  rows={1}
                  style={{
                    display: 'block',
                    width: '100%',
                    height: 0,
                    minHeight: 22,
                    resize: 'none',
                    overflow: 'hidden',
                    margin: '4px 0 0',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    padding: 0,
                    fontSize: 15,
                    color: '#666',
                    lineHeight: 1.55,
                    fontFamily: 'inherit',
                  }}
                />
                <div
                  style={{
                    marginTop: 8,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                  }}
                >
                  <p style={{ margin: 0, fontSize: 12, color: '#c0c0c0' }}>{note.label}</p>
                  <button
                    onClick={() => handleDelete(note.id)}
                    aria-label="Buang kertas ini"
                    style={{
                      flexShrink: 0,
                      width: 26,
                      height: 26,
                      borderRadius: '50%',
                      border: 'none',
                      background: 'rgba(0,0,0,0.055)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#999',
                    }}
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Flying balls overlay (position: fixed so coords are viewport-relative) ── */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 300 }}>
        {flyingBalls.map((ball) => (
          <img
            key={ball.id}
            src={paperBallUrl}
            alt=""
            style={
              {
                position: 'absolute',
                left: ball.fromX - ball.flyingSize / 2,
                top: ball.fromY - ball.flyingSize / 2,
                width: ball.flyingSize,
                height: ball.flyingSize,
                '--fdx': `${ball.toX - ball.fromX}px`,
                '--fdy': `${ball.toY - ball.fromY}px`,
                animation: 'tp-fly 0.7s cubic-bezier(0.25,0.1,0.55,1) forwards',
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* ── Trash bin — rises from bottom ── */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: '50%',
          transform: `translateX(-50%) translateY(${binVisible ? '0%' : '110%'})`,
          transition: 'transform 0.55s cubic-bezier(0.34,1.2,0.64,1)',
          zIndex: 100,
        }}
      >
        <BasketSvg balls={binBalls} />
      </div>
    </div>
  )
}
