import { NavLink } from 'react-router-dom'

const links = [
  { to: '/', label: 'Dashboard' },
  { to: '/skills', label: 'Skill Browser' },
  { to: '/skills/new', label: 'Publish Skill' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 text-gray-100 flex flex-col py-6 px-4 shrink-0">
      <div className="text-xl font-bold mb-8 tracking-tight">TokenLens</div>
      <nav className="flex flex-col gap-1">
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) =>
              `rounded px-3 py-2 text-sm transition-colors ${
                isActive ? 'bg-indigo-600 text-white' : 'hover:bg-gray-700'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
