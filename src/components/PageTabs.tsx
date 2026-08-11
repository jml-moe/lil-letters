import { Tabs } from "@cloudflare/kumo"
import { useLocation, useNavigate } from "react-router"

/** Small stroke icons, inline so the tab bar carries no icon dependency. */
function PuzzleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 4h4v1.6a1.9 1.9 0 1 0 3.8 0V4H20v4.2h-1.6a1.9 1.9 0 1 0 0 3.8H20V20h-4.2v-1.6a1.9 1.9 0 1 0-3.8 0V20H4v-4.2h1.6a1.9 1.9 0 1 0 0-3.8H4V8h6z" />
    </svg>
  )
}

function LetterIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="14" rx="2" />
      <path d="M7 9.5h10M7 13h6" />
    </svg>
  )
}

function CrumpleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14H6L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4h6v2" />
    </svg>
  )
}

/**
 * Segment styling: 12px medium label, 6px radius, muted when idle and full
 * ink once selected — the white pill behind it is the Kumo indicator.
 */
const TAB_CLASS = [
  "my-0 flex h-[30px] min-w-0 flex-1 items-center justify-center gap-1 px-2.5 sm:gap-1.5 sm:px-3",
  "rounded-[6px] text-[11px] font-medium leading-none tracking-[0] sm:text-[12px]",
  "text-[#16161a]/55 hover:text-[#16161a]/80",
  "aria-selected:text-[#16161a] aria-selected:hover:text-[#16161a]",
  "transition-[color,transform] duration-200 active:scale-[0.98]",
].join(" ")

const TABS = [
  {
    value: "/",
    className: TAB_CLASS,
    label: (
      <span className="flex min-w-0 items-center justify-center gap-1 sm:gap-1.5">
        <PuzzleIcon />
        Puzzle
      </span>
    ),
  },
  {
    value: "/letters",
    className: TAB_CLASS,
    label: (
      <span className="flex min-w-0 items-center justify-center gap-1 sm:gap-1.5">
        <LetterIcon />
        Letters
      </span>
    ),
  },
  {
    value: "/test",
    className: TAB_CLASS,
    label: (
      <span className="flex min-w-0 items-center justify-center gap-1 sm:gap-1.5">
        <CrumpleIcon />
        Crumple
      </span>
    ),
  },
]

/** Centered segmented tabs that switch between the app pages. */
export default function PageTabs() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const value = TABS.some((tab) => tab.value === pathname) ? pathname : "/"

  return (
    <div className="page-tabs fixed left-1/2 top-4 z-50 w-[calc(100vw-16px)] max-w-[22rem] -translate-x-1/2 sm:w-auto sm:max-w-none">
      <Tabs
        tabs={TABS}
        value={value}
        onValueChange={(next) => {
          if (next !== value) navigate(next)
        }}
        className="w-full rounded-[9px] shadow-none ring-0"
        listClassName="m-0 grid h-9 w-full grid-cols-3 gap-0 overflow-visible rounded-[9px] border border-[#16161a]/[0.10] bg-[#f1f1f3] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.75),0_1px_2px_rgba(20,24,18,0.10)]"
        indicatorClassName="rounded-[6px] bg-white shadow-[0_1px_2px_rgba(20,24,18,0.16)] ring-0"
      />
    </div>
  )
}
