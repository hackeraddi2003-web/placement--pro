import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  LayoutDashboard, BookOpen, MessageSquareText, Code2, Layers,
  FolderKanban, Brain, Briefcase, Sparkles, BarChart3, Settings,
  Menu, X, LogOut,
} from 'lucide-react'
import './AppLayout.css'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/journal', label: 'Journal', icon: BookOpen },
  { to: '/english', label: 'English Hub', icon: MessageSquareText },
  { to: '/dsa', label: 'DSA Tracker', icon: Code2 },
  { to: '/skills', label: 'Languages & Subjects', icon: Layers },
  { to: '/projects', label: 'Projects', icon: FolderKanban },
  { to: '/interview', label: 'Interview Prep', icon: Brain },
  { to: '/jobs', label: 'Job Applications', icon: Briefcase },
  { to: '/mentor', label: 'AI Mentor', icon: Sparkles },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const { signOut, user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="shell">
      {/* Mobile top bar */}
      <header className="shell-topbar">
        <button className="icon-btn" onClick={() => setMobileOpen(true)} aria-label="Open menu">
          <Menu size={20} />
        </button>
        <span className="shell-topbar-brand">PlacementOS</span>
        <div className="shell-topbar-spacer" />
      </header>

      {/* Sidebar */}
      <aside className={`shell-sidebar ${mobileOpen ? 'is-open' : ''}`}>
        <div className="shell-sidebar-header">
          <div className="shell-brand">
            <span className="shell-brand-mark">P</span>
            <div>
              <div className="shell-brand-name">PlacementOS</div>
              <div className="shell-brand-sub">Pro</div>
            </div>
          </div>
          <button className="icon-btn shell-sidebar-close" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={18} />
          </button>
        </div>

        <nav className="shell-nav">
          {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `shell-nav-item ${isActive ? 'is-active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={18} strokeWidth={2} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="shell-sidebar-footer">
          <div className="shell-user">
            <div className="shell-user-avatar">{(user?.email || '?')[0].toUpperCase()}</div>
            <div className="shell-user-email mono">{user?.email}</div>
          </div>
          <button className="icon-btn" onClick={handleSignOut} aria-label="Sign out">
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {mobileOpen && <div className="shell-overlay" onClick={() => setMobileOpen(false)} />}

      {/* Main content */}
      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  )
}
