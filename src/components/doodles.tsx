type DoodleProps = { className?: string }

const stroke = {
  fill: 'none',
  stroke: '#16161a',
  strokeWidth: 3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

/** A mug with steam — drawn as one continuous hand-inked outline. */
export function MugDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 220 160" className={className} aria-hidden>
      <g {...stroke}>
        <path d="M46 62c-2 34 4 58 14 68 6 6 16 9 34 9s28-3 34-9c10-10 16-34 14-68-32 5-64 5-96 0Z" />
        <path d="M46 62c8-6 26-9 48-9s40 3 48 9" />
        <path d="M144 78c14-6 26-2 27 9 1 12-9 20-25 20" />
        <path d="M78 34c6-7 6-13 0-20M100 30c6-7 6-14 0-21M122 34c6-7 6-13 0-20" />
      </g>
    </svg>
  )
}

/** A paper plane with a looping dashed trail behind it. */
export function PlaneDoodle({ className }: DoodleProps) {
  return (
    <svg viewBox="0 0 220 160" className={className} aria-hidden>
      <g {...stroke}>
        <path d="M196 26 96 84l-40-12 140-46Z" />
        <path d="M196 26 96 84l6 44 22-30 42 22 30-94Z" />
        <path d="m96 84 6 44" />
        <path
          d="M56 72C34 84 18 100 12 122c-4 16 4 26 18 24 12-2 16-16 6-20-12-5-24 8-24 8"
          strokeDasharray="1 11"
        />
      </g>
    </svg>
  )
}
