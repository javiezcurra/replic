import { useState } from 'react'
import { NavLink, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

const publicNavLinks = [
  { to: '/', label: 'Home', end: true },
  { to: '/experiments', label: 'Experiments', end: false },
]

const adminNavLinks = [
  { to: '/materials', label: 'Materials', end: true },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [adminOpen, setAdminOpen] = useState(false)
  const { user, isAdmin, loading, signIn, signOut } = useAuth()

  const userNavLinks = user
    ? [
        { to: '/my-lab', label: 'My Lab', end: false },
        { to: '/designs/mine', label: 'My Designs', end: false },
      ]
    : []

  const navLinkClass = ({ isActive }: { isActive: boolean }) =>
    `px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive
        ? 'bg-surface text-primary'
        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
    }`

  const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
      isActive ? 'bg-surface text-primary' : 'text-gray-600 hover:bg-gray-100'
    }`

  const authButtons = loading ? null : user ? (
    <>
      <Link to="/profile" className="text-sm font-medium text-gray-700 hover:text-gray-900 px-3 py-2">
        {user.displayName ?? user.email}
      </Link>
      <button onClick={signOut} className="btn-secondary text-sm">Sign out</button>
    </>
  ) : (
    <>
      <button onClick={signIn} className="btn-secondary text-sm">Sign in</button>
      <button onClick={signIn} className="btn-primary text-sm">Get started</button>
    </>
  )

  const mobileAuthButtons = loading ? null : user ? (
    <>
      <Link
        to="/profile"
        onClick={() => setMobileOpen(false)}
        className="block px-3 py-2 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
      >
        {user.displayName ?? user.email}
      </Link>
      <button onClick={signOut} className="btn-secondary w-full justify-center">Sign out</button>
    </>
  ) : (
    <>
      <button onClick={signIn} className="btn-secondary w-full justify-center">Sign in</button>
      <button onClick={signIn} className="btn-primary w-full justify-center">Get started</button>
    </>
  )

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <span
              className="text-xl font-bold tracking-tight"
              style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}
            >
              Replic
            </span>
            <span className="hidden sm:inline-block text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
              alpha
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {publicNavLinks.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                {label}
              </NavLink>
            ))}

            {userNavLinks.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass}>
                {label}
              </NavLink>
            ))}

            {/* Admin Panel dropdown — admin-only */}
            {isAdmin && (
              <div className="relative">
                <button
                  onClick={() => setAdminOpen((v) => !v)}
                  onBlur={() => setTimeout(() => setAdminOpen(false), 150)}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium
                             text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                >
                  Admin Panel
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${adminOpen ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {adminOpen && (
                  <div className="absolute left-0 top-full mt-1 w-48 bg-white rounded-xl shadow-lg
                                  border border-gray-200 py-1 z-50">
                    {adminNavLinks.map(({ to, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        onClick={() => setAdminOpen(false)}
                        className={({ isActive }) =>
                          `block px-4 py-2 text-sm transition-colors ${
                            isActive
                              ? 'bg-surface text-primary font-medium'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`
                        }
                      >
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            )}
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex items-center gap-3">
            {authButtons}
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded-lg text-gray-600 hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="md:hidden pb-4 space-y-1">
            {publicNavLinks.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={mobileNavLinkClass}>
                {label}
              </NavLink>
            ))}
            {userNavLinks.map(({ to, label, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMobileOpen(false)} className={mobileNavLinkClass}>
                {label}
              </NavLink>
            ))}
            {isAdmin && (
              <>
                <p className="px-3 pt-2 pb-1 text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Admin Panel
                </p>
                {adminNavLinks.map(({ to, label }) => (
                  <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={mobileNavLinkClass}>
                    {label}
                  </NavLink>
                ))}
              </>
            )}
            <div className="pt-2 flex flex-col gap-2">
              {mobileAuthButtons}
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
