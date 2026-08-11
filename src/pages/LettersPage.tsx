import { useCallback, useEffect, useRef, useState } from 'react'
import Typewriter from '../components/Typewriter'
import { MugDoodle, PlaneDoodle } from '../components/doodles'

const LOREM_SOURCE = 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '
const lorem = (length: number) =>
  LOREM_SOURCE.repeat(Math.ceil(length / LOREM_SOURCE.length)).slice(0, length)

const SECTIONS = [
  {
    number: '01',
    heading: lorem(14).toUpperCase(),
    body: lorem(148),
    Doodle: MugDoodle,
  },
  {
    number: '02',
    heading: lorem(12).toUpperCase(),
    body: lorem(138),
    Doodle: PlaneDoodle,
  },
  {
    number: '03',
    heading: lorem(27).toUpperCase(),
    body: `${lorem(337)}\n\n${lorem(281)}`,
  },
]

export default function LettersPage() {
  const paperRefs = useRef<(HTMLElement | null)[]>([])
  const scrollStopTimer = useRef<number | undefined>(undefined)
  const resetTimer = useRef<number | undefined>(undefined)
  const [page, setPage] = useState(0)
  const [rolling, setRolling] = useState(false)
  const [peekPhase, setPeekPhase] = useState<'peeking' | 'entering' | 'done'>('peeking')
  const peekPhaseRef = useRef(peekPhase)
  peekPhaseRef.current = peekPhase

  const exitPeek = useCallback(() => {
    if (peekPhaseRef.current !== 'peeking') return
    setPeekPhase('entering')
    window.setTimeout(() => setPeekPhase('done'), 720)
  }, [])

  const syncCurrentPaper = useCallback(() => {
    const closest = paperRefs.current.reduce<number>((current, paper, index) => {
      if (!paper) return current
      const currentPaper = paperRefs.current[current]
      if (!currentPaper) return index
      return Math.abs(paper.getBoundingClientRect().top - 86) <
        Math.abs(currentPaper.getBoundingClientRect().top - 86)
        ? index
        : current
    }, 0)
    setPage(closest)
  }, [])

  useEffect(() => {
    const onScroll = () => {
      exitPeek()
      syncCurrentPaper()
      document.documentElement.classList.add('is-scrolling')
      window.clearTimeout(scrollStopTimer.current)
      scrollStopTimer.current = window.setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling')
      }, 700)

      const atEnd = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2
      window.clearTimeout(resetTimer.current)
      if (atEnd) {
        resetTimer.current = window.setTimeout(() => {
          window.scrollTo({
            top: 0,
            behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
              ? 'auto'
              : 'smooth',
          })
          setPage(0)
        }, 900)
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(scrollStopTimer.current)
      window.clearTimeout(resetTimer.current)
      document.documentElement.classList.remove('is-scrolling')
    }
  }, [syncCurrentPaper, exitPeek])

  const pull = useCallback(() => {
    // The first control interaction only brings paper 01 fully into view.
    // Do not advance from the peek state: scroll events fired during the reveal
    // can otherwise make the first click resolve to a later sheet.
    if (peekPhaseRef.current === 'peeking') {
      exitPeek()
      setPage(0)
      return
    }

    const next = page >= SECTIONS.length - 1 ? 0 : page + 1
    const target = paperRefs.current[next]
    if (!target) return
    setRolling(true)
    setPage(next)
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth',
      block: 'start',
    })
  }, [page, exitPeek])

  useEffect(() => {
    if (!rolling) return
    const id = window.setTimeout(() => setRolling(false), 900)
    return () => window.clearTimeout(id)
  }, [rolling, page])

  return (
    <main className="letters min-h-screen overflow-x-hidden pb-[270px] sm:pb-[310px]">
      <div className="gingham fixed inset-0" aria-hidden />
      <div className="letters-paper-guard" aria-hidden />

      <section
        className={[
          'letter-stack relative z-10 mx-auto w-full px-5 pt-[58px] sm:px-8',
          peekPhase === 'peeking' ? 'letter-stack--peeking' : '',
          peekPhase === 'entering' ? 'letter-stack--entering' : '',
        ].join(' ')}
      >
        {SECTIONS.map(({ number, heading, body, Doodle }, index) => (
          <article
            key={number}
            ref={(node) => {
              paperRefs.current[index] = node
            }}
            className="paper-page scroll-mt-[58px]"
          >
            <hr className="dashed-rule mb-8" />
            <p className="elite text-[clamp(1.45rem,4.8vw,1.65rem)] leading-none">{number}</p>
            <h1 className="mt-4 text-[clamp(0.75rem,2.6vw,0.8rem)] font-bold tracking-[0.22em]">{heading}</h1>
            {body.split('\n\n').map((paragraph) => (
              <p key={paragraph} className="mt-4 text-[clamp(0.7rem,2.4vw,0.74rem)] leading-[1.85]">
                {paragraph}
              </p>
            ))}
            {Doodle && <Doodle className="mx-auto mt-8 w-[clamp(96px,30%,124px)]" />}
          </article>
        ))}
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-30 pb-3 sm:pb-5">
        <Typewriter
          typing={rolling}
          onReturn={pull}
          leverHint={page === 0 ? 'tarik tuas ini · atau gulir' : undefined}
        />
      </div>
    </main>
  )
}
