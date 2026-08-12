import { NotBuiltYet } from './NotBuiltYet'

export function RoleSettings() {
  return (
    <NotBuiltYet
      title="Role settings"
      question="Right now roles are fixed: Lead (full access + admin) and Team (scoped to assigned clinics, no admin). What should be configurable here?"
      options={[
        'New roles beyond Lead/Team, with their own permission sets.',
        'Finer-grained permissions within the existing two roles (e.g. a Team member who can edit but not delete).',
        'Something else — tell me what you have in mind.',
      ]}
    />
  )
}
