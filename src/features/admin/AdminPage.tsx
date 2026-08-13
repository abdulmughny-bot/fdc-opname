import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { Button } from '../../components'
import { PeopleAccess } from './PeopleAccess'
import { ClinicRecipients } from './ClinicRecipients'
import { EmailTemplate } from './EmailTemplate'
import { AdminSettings } from './AdminSettings'

const TABS = [
  { path: 'people', label: '👥 People & Access', icon: '👥' },
  { path: 'recipients', label: '📧 Clinic Recipients', icon: '📧' },
  { path: 'email', label: '✉️ Email Template', icon: '✉️' },
  { path: 'settings', label: '⚙️ System Settings', icon: '⚙️' },
]

export function AdminPage() {
  const navigate = useNavigate()
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-ink mb-1">Settings & Admin</h1>
          <p className="text-ink-soft">Manage users, clinic settings, and audit configuration</p>
        </div>
        <Button variant="ghost" onClick={() => navigate('/')}>
          ← Back to Dashboard
        </Button>
      </div>

      {/* Tab Navigation */}
      <div className="bg-paper border border-line rounded-lg p-1 inline-flex">
        {TABS.map((t) => (
          <NavLink
            key={t.path}
            to={`/admin/${t.path}`}
            className={({ isActive }) =>
              'px-4 py-2.5 text-sm font-semibold rounded-md transition-all ' +
              (isActive
                ? 'bg-teal-deep text-white shadow-md'
                : 'text-ink-soft hover:text-ink hover:bg-line-soft')
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>

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
