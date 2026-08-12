import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { PeopleAccess } from './PeopleAccess'
import { ClinicRecipients } from './ClinicRecipients'
import { EmailTemplate } from './EmailTemplate'
import { AdminSettings } from './AdminSettings'

const TABS = [
  { path: 'people', label: 'People & Access' },
  { path: 'recipients', label: 'Clinic Recipients' },
  { path: 'email', label: 'Email Template' },
  { path: 'settings', label: 'Settings' },
]

export function AdminPage() {
  const navigate = useNavigate()
  return (
    <div>
      <button
        type="button"
        onClick={() => navigate('/')}
        className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:border-ink-soft mb-4"
      >
        ← Dashboard
      </button>
      <div className="flex items-center gap-5 border-b border-line mb-5">
        {TABS.map((t) => (
          <NavLink
            key={t.path}
            to={`/admin/${t.path}`}
            className={({ isActive }) =>
              'pb-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ' +
              (isActive ? 'text-teal-deep border-teal' : 'text-ink-soft border-transparent hover:text-ink')
            }
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <Routes>
        <Route index element={<Navigate to="/admin/people" replace />} />
        <Route path="people" element={<PeopleAccess />} />
        <Route path="recipients" element={<ClinicRecipients />} />
        <Route path="email" element={<EmailTemplate />} />
        <Route path="settings/*" element={<AdminSettings />} />
        <Route path="*" element={<Navigate to="/admin/people" replace />} />
      </Routes>
    </div>
  )
}
