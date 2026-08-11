import { useCallback, useEffect, useRef, useState } from 'react'
import typewriterHitSound from '../imports/mixkit-typewriter-hard-hit-1367.mp3'

const KEY_ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM']
const KEY_COUNT = KEY_ROWS.join('').length
const ROW_SHIFT_STEPS = [0, -0.5, -1]

type TypewriterProps = {
  /** True while a page is rolling out — the machine taps keys. */
  typing: boolean
  /** Called when the carriage return lever is pulled. */
  onReturn: () => void
  /** Small caption next to the lever, shown only before the first pull. */
  leverHint?: string
}

/**
 * Built entirely from elements and CSS: chrome platen rod with knurled wheels
 * and a carriage return lever, a perforated steel body, and three staggered
 * rows of chrome-rimmed keys sitting in their wells.
 */
export default function Typewriter({
  typing,
  onReturn,
  leverHint,
}: TypewriterProps) {
  const [pressed, setPressed] = useState(-1)
  const [pulling, setPulling] = useState(false)
  const typewriterSound = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    const sound = new Audio(typewriterHitSound)
    sound.volume = 0.32
    typewriterSound.current = sound
    return () => {
      sound.pause()
      typewriterSound.current = null
    }
  }, [])

  useEffect(() => {
    if (!typing) {
      setPressed(-1)
      return
    }
    const id = window.setInterval(() => {
      setPressed(Math.floor(Math.random() * KEY_COUNT))
    }, 110)
    return () => window.clearInterval(id)
  }, [typing])

  const pull = useCallback(() => {
    const sound = typewriterSound.current
    if (sound) {
      sound.currentTime = 0
      void sound.play().catch(() => undefined)
    }
    setPulling(true)
    window.setTimeout(() => setPulling(false), 260)
    onReturn()
  }, [onReturn])

  let keyIndex = -1

  return (
    <div className="tw">
      <div className="tw-carriage">
        <button
          type="button"
          className={`tw-lever${pulling ? ' is-pulled' : ''}`}
          style={{ marginLeft: '-6px', marginRight: 0 }}
          onClick={pull}
          aria-label="Tarik tuas carriage return"
        >
          <span className="tw-lever-arm" />
          <span className="tw-lever-grip" />
        </button>

        <div className="tw-rod" />
        <div className="tw-roller" style={{ left: '36%' }} />
        <div className="tw-roller" style={{ left: '65%' }} />
        <div className="tw-wheel tw-wheel-left">
          <span className="tw-ball" />
        </div>
        <div className="tw-wheel tw-wheel-right">
          <span className="tw-ball" />
        </div>
      </div>

      <div className="tw-body">
        {KEY_ROWS.map((row, r) => (
          <div
            className="tw-row"
            key={row}
            style={{
              paddingLeft: r * 6 + '%',
              transform: `translateX(calc(var(--key) * ${ROW_SHIFT_STEPS[r] * 1.28}))`,
            }}
          >
            {row.split('').map((letter) => {
              keyIndex += 1
              const isDown = keyIndex === pressed
              return (
                <span className="tw-slot" key={letter}>
                  <span className="tw-well" />
                  <span className={`tw-key${isDown ? ' is-down' : ''}`}>
                    {letter}
                  </span>
                </span>
              )
            })}
          </div>
        ))}
        <button
          type="button"
          className={`tw-space${pulling ? ' is-down' : ''}`}
          style={{ textAlign: 'center', fontWeight: 700, color: 'rgb(161, 161, 161)' }}
          onClick={pull}
          aria-label="Lanjut ke lembar surat berikutnya"
        >
          CLICK HERE OR JUST SCROLL
        </button>
      </div>

      {leverHint && <p className="tw-hint">{leverHint}</p>}
    </div>
  )
}
