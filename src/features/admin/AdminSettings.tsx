import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { ThresholdSettings } from './settings/ThresholdSettings'
import { RoleSettings } from './settings/RoleSettings'
import { ClinicStations } from './settings/ClinicStations'
import { ItemsManagement } from './ItemsManagement'

const SECTIONS = [
  { path: 'item-master', label: 'Item Master' },
  { path: 'clinics', label: 'Clinic & Station' },
  { path: 'threshold', label: 'Acceptance threshold' },
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
            <Route index element={<Navigate to="/admin/settings/item-master" replace />} />
            <Route path="item-master" element={<ItemsManagement />} />
            <Route path="clinics" element={<ClinicStations />} />
            <Route path="threshold" element={<ThresholdSettings />} />
            <Route path="roles" element={<RoleSettings />} />
            <Route path="*" element={<Navigate to="/admin/settings/item-master" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  )
}
