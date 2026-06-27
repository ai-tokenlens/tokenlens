import { useLocation } from 'react-router-dom'

const TITLES = {
  '/': 'Dashboard',
  '/skills': 'Skill Browser',
  '/skills/new': 'Publish Skill',
}

export default function Header() {
  const { pathname } = useLocation()
  const title = TITLES[pathname] ?? 'TokenLens'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center px-6 shrink-0">
      <h1 className="text-lg font-semibold text-gray-800">{title}</h1>
    </header>
  )
}
