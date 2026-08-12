import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ThresholdSettings } from './settings/ThresholdSettings'
import { ItemTypeSettings } from './settings/ItemTypeSettings'
import { RoleSettings } from './settings/RoleSettings'

const SECTIONS = [
  { path: 'threshold', label: 'Acceptance threshold' },
  { path: 'item-types', label: 'Item types for upload' },
  { path: 'roles', label: 'Role settings' },
]

export function AdminSettings() {
  return (
    <div className="bg-paper border border-line rounded-[10px] p-6">
      <h2 className="font-display text-base font-bold mb-4">Settings</h2>
      <div className="grid grid-cols-[200px_1fr] gap-6">
        <nav className="space-y-0.5">
          {SECTIONS.map((s) => (
            <NavLink
              key={s.path}
              to={`/admin/settings/${s.path}`}
              className={({ isActive }) =>
                'block rounded-md px-3 py-2 text-[13px] font-medium transition-colors ' +
                (isActive ? 'bg-teal-wash text-teal-deep' : 'text-ink-soft hover:bg-bg hover:text-ink')
              }
            >
              {s.label}
            </NavLink>
          ))}
        </nav>
        <div className="border-l border-line pl-6">
          <Routes>
            <Route index element={<Navigate to="/admin/settings/threshold" replace />} />
            <Route path="threshold" element={<ThresholdSettings />} />
            <Route path="item-types" element={<ItemTypeSettings />} />
            <Route path="roles" element={<RoleSettings />} />
            <Route path="*" element={<Navigate to="/admin/settings/threshold" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
