import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  MessageSquare,
  Database,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { AnimateIn } from './AnimateIn'
import { WidgetPage } from '../pages/WidgetPage'

const navItems = [
  { to: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
  { to: '/dashboard/leads', label: 'Leads', icon: MessageSquare },
  { to: '/dashboard/knowledge-base', label: 'Knowledge Base', icon: Database },
]

export function DashboardLayout() {
  const { signOut, user } = useAuth()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const location = useLocation()

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-white
          transition-transform duration-200 ease-out
          lg:static lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        aria-label="Main navigation"
      >
        {/* Logo */}
        <div className="flex h-16 items-center justify-between border-b border-border px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-white">
              I
            </div>
            <span className="font-heading text-lg font-semibold text-foreground">
              Intake
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="cursor-pointer rounded-md p-1 text-muted-foreground hover:bg-muted lg:hidden"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/dashboard/overview'}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}

          </nav>

        {/* User footer */}
        <div className="border-t border-border px-4 py-4">
          <div className="mb-3 truncate text-xs text-foreground/50">
            {user?.email}
          </div>
          <button
            onClick={signOut}
            className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground/70 transition-colors duration-150 hover:bg-muted hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile header */}
        <header className="flex h-16 items-center gap-4 border-b border-border bg-white px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="cursor-pointer rounded-md p-2 text-foreground/70 hover:bg-muted"
            aria-label="Open sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-xs font-bold text-white">
              I
            </div>
            <span className="font-heading text-base font-semibold text-foreground">
              Intake
            </span>
          </div>
        </header>

        {/* Page content */}
        <main
          id="main-content"
          className="flex-1 overflow-y-auto bg-background"
        >
          <AnimateIn key={location.pathname} from="fade" duration={200}>
            <Outlet />
          </AnimateIn>
        </main>
      </div>

      {/* Floating chat widget — testable from any dashboard page */}
      <WidgetPage />
    </div>
  )
}