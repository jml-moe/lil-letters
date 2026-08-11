import { createBrowserRouter, Link, Outlet } from 'react-router'
import PageTabs from './components/PageTabs'
import PuzzlePage from './pages/PuzzlePage'
import LettersPage from './pages/LettersPage'
import TestPage from './pages/TestPage'

function Root() {
  return (
    <>
      <PageTabs />
      <Outlet />
    </>
  )
}

function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <p className="mono text-[11px] tracking-[0.22em] text-[#9a9aa4]">404</p>
      <h1 className="text-2xl font-bold tracking-[-0.02em]">
        Halaman ini belum ada.
      </h1>
      <Link
        to="/"
        className="mono text-[11px] tracking-[0.16em] text-[#8b8b95] underline-offset-4 hover:text-[#16161a] hover:underline"
      >
        kembali ke puzzle
      </Link>
    </main>
  )
}

export const router = createBrowserRouter([
  {
    path: '/',
    Component: Root,
    children: [
      { index: true, Component: PuzzlePage },
      { path: 'letters', Component: LettersPage },
      { path: 'test', Component: TestPage },
      { path: '*', Component: NotFound },
    ],
  },
])
