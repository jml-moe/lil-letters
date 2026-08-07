import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import Typewriter from '../components/Typewriter'
import { MugDoodle, PlaneDoodle } from '../components/doodles'

const SECTIONS = [
  {
    number: '01',
    heading: 'SECANGKIR SORE',
    body: 'Ada sore yang tidak istimewa sama sekali. Lalu jadi istimewa hanya karena kamu cerita panjang lebar tentang harimu, dan aku lupa tehku sudah dingin.',
    Doodle: MugDoodle,
  },
  {
    number: '02',
    heading: 'JALAN PULANG',
    body: 'Rute pulang yang sama selama bertahun-tahun bisa terasa baru kalau di kepala sedang ada seseorang. Aneh, tapi memang begitu cara kerjanya.',
    Doodle: PlaneDoodle,
  },
]

/** How far the sheet stays tucked behind the platen at rest. */
const TUCK = 24
/** Clearance kept below the tab bar so the paper never covers it. */
const TOP_GUARD = 68
/** Breathing room above and below the first sheet. */
const FIRST_PAGE_MARGIN = 44
const ROLL_MS = 900

export default function LettersPage() {
  const machineRef = useRef<HTMLDivElement>(null)
  const [machineH, setMachineH] = useState(260)
  const [viewH, setViewH] = useState(
    typeof window === 'undefined' ? 800 : window.innerHeight,
  )
  const [page, setPage] = useState(0)
  const [rolling, setRolling] = useState(false)
  const [instant, setInstant] = useState(false)

  // The stage is a fixed viewport: the paper is fed by the lever, not by scroll.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  useLayoutEffect(() => {
    const machine = machineRef.current
    if (!machine) return
    const measure = () => {
      setMachineH(machine.offsetHeight)
      setViewH(window.innerHeight)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(machine)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [])

  const total = SECTIONS.length
  const windowH = Math.max(200, viewH - machineH + TUCK - TOP_GUARD)
  const pageH = windowH

  /** Distance the roll travels so page `p` sits fully in the window. */
  const offsetFor = (p: number) =>
    p === 0 ? 0 : p * pageH + FIRST_PAGE_MARGIN * (p === 1 ? 1 : 2)

  const pull = useCallback(() => {
    setRolling(true)
    setPage((current) => (current > total ? 1 : current + 1))
  }, [total])

  // Typing chatter stops once the sheet has settled.
  useEffect(() => {
    if (!rolling) return
    const id = window.setTimeout(() => setRolling(false), ROLL_MS)
    return () => window.clearTimeout(id)
  }, [rolling, page])

  // One pull past the last page ejects the stack, then the roll silently resets.
  useEffect(() => {
    if (page !== total + 1) return
    const id = window.setTimeout(() => {
      setInstant(true)
      setPage(0)
    }, ROLL_MS)
    return () => window.clearTimeout(id)
  }, [page, total])

  useEffect(() => {
    if (!instant) return
    const id = requestAnimationFrame(() => setInstant(false))
    return () => cancelAnimationFrame(id)
  }, [instant])

  return (
    <div className="letters fixed inset-0 overflow-hidden">
      <div className="gingham absolute inset-0" aria-hidden />

      {/* The roll: pages stacked upward, fed out from behind the platen. */}
      <div
        className="absolute inset-x-0"
        style={{ top: TOP_GUARD, height: windowH }}
      >
        <div className="absolute inset-0 overflow-hidden">
          <div
            className="paper-roll absolute left-1/2 top-0"
            style={{
              transform: `translate3d(-50%, ${windowH - offsetFor(page)}px, 0)`,
              transition: instant
                ? 'none'
                : `transform ${ROLL_MS}ms var(--ease-drawer)`,
              willChange: 'transform',
            }}
          >
            {SECTIONS.map(({ number, heading, body, Doodle }, i) => (
              <article
                key={number}
                className="paper-page"
                style={{
                  height: pageH,
                  marginTop: i === 0 ? FIRST_PAGE_MARGIN : undefined,
                  marginBottom: i === 0 ? FIRST_PAGE_MARGIN : undefined,
                }}
              >
                {i === 0 && (
                  <p className="text-[11px] font-bold leading-[1.7] tracking-[0.02em]">
                    Mungkin boleh dimulai dari hal-hal kecil.
                  </p>
                )}
                {i === 0 && (
                  <h1 className="elite mt-6 flex items-start justify-center gap-3 text-[clamp(1.2rem,4.5vw,1.85rem)] leading-none tracking-[0.04em]">
                    <span className="text-[1.2em] leading-[0.8] opacity-80">
                      &ldquo;
                    </span>
                    <span className="mt-1">HAL-HAL KECIL</span>
                    <span className="text-[1.2em] leading-[0.8] opacity-80">
                      &rdquo;
                    </span>
                  </h1>
                )}
                {i > 0 && <hr className="dashed-rule mb-8" />}

                <p className="elite mt-8 text-[clamp(1.45rem,4.8vw,1.95rem)] leading-none">
                  {number}
                </p>
                <h2 className="mt-4 text-[clamp(0.75rem,2.6vw,0.9rem)] font-bold tracking-[0.22em]">
                  {heading}
                </h2>
                <p className="mt-4 text-[clamp(0.7rem,2.4vw,0.8rem)] leading-[1.85]">
                  {body}
                </p>
                <Doodle className="mx-auto mt-8 w-[clamp(96px,30%,144px)]" />
              </article>
            ))}
          </div>
        </div>
      </div>

      <div
        ref={machineRef}
        className="absolute bottom-0 left-0 right-0 z-20 pb-3 sm:pb-5"
      >
        <Typewriter
          typing={rolling}
          onReturn={pull}
          leverHint={page === 0 ? 'tarik tuas ini' : undefined}
        />
      </div>
    </div>
  )
}
