import { useState } from 'react'
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Button } from '../../components'
import { PeopleAccess } from './PeopleAccess'
import { ClinicRecipients } from './ClinicRecipients'
import { EmailTemplate } from './EmailTemplate'
import { AdminSettings } from './AdminSettings'

const TABS = [
  { path: 'people', label: 'People & Access' },
  { path: 'recipients', label: 'Clinic Recipients' },
  { path: 'email', label: 'Email Template' },
  { path: 'settings', label: 'System Settings' },
]

function HamburgerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

// Same backdrop convention as the Modal in PeopleAccess/RoleSettings — no
// onClick on the sidebar panel itself, so only the backdrop or a nav link closes it.
function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <>
      {open && <div className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-sm" onClick={onClose} />}
      <aside
        className={
          'fixed left-0 top-0 h-full w-72 bg-paper border-r border-line z-50 shadow-2xl transition-transform duration-200 ' +
          (open ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-line">
          <h2 className="font-display text-sm font-bold">Admin menu</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            className="w-7 h-7 flex items-center justify-center rounded-full text-ink-soft hover:text-ink hover:bg-bg text-lg leading-none"
          >
            ×
          </button>
        </div>
        <nav className="p-3 space-y-1">
          {TABS.map((t) => (
            <NavLink
              key={t.path}
              to={`/admin/${t.path}`}
              onClick={onClose}
              className={({ isActive }) =>
                'block px-3.5 py-2.5 text-sm font-semibold rounded-lg transition-colors ' +
                (isActive ? 'bg-teal-deep text-white' : 'text-ink-soft hover:text-ink hover:bg-bg')
              }
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}

export function AdminPage() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="mt-1 w-9 h-9 flex items-center justify-center rounded-lg border border-line text-ink-soft hover:text-ink hover:bg-bg transition-colors shrink-0"
          >
            <HamburgerIcon />
          </button>
          <div>
            <h1 className="font-display text-3xl font-bold text-ink mb-1">Settings & Admin</h1>
            <p className="text-ink-soft">Manage users, clinic settings, and audit configuration</p>
          </div>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </Button>
      </div>

      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Content */}
      <div className="bg-paper border border-line rounded-lg p-6">
        <Routes>
          <Route index element={<Navigate to="/admin/people" replace />} />
          <Route path="people" element={<PeopleAccess />} />
          <Route path="recipients" element={<ClinicRecipients />} />
          <Route path="email" element={<EmailTemplate />} />
          <Route path="settings/*" element={<AdminSettings />} />
          <Route path="*" element={<Navigate to="/admin/people" replace />} />
        </Routes>
      </div>
    </div>
  )
}
