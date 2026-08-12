// Typed wrappers around every RPC in supabase/migrations/0001_schema.sql and
// 0002_admin.sql. Each wrapper throws on error so callers can just await it;
// UI layers decide how to present the message (e.g. inline error / toast).

import { supabase } from './supabase'
import type { AuditType, Database, Role, UploadKind } from '../types/database'

type RpcName = keyof Database['dev']['Functions']

// `fn` stays fully checked against RpcName (catches typos/renames at every
// call site below). `args` can't be correlated to the right shape per-fn
// through a generic wrapper — TS has no way to narrow "args matches whichever
// literal fn is" — so it's cast at just this one internal line.
async function call<T>(fn: RpcName, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, (args ?? {}) as never)
  if (error) throw new Error(error.message)
  return data as T
}

// ---- auth / scope ----

export const isProvisioned = () => call<boolean>('is_provisioned')
export const currentProfile = () => call<Record<string, unknown>>('current_profile')
export const canAccessClinic = (clinicId: string) =>
  call<boolean>('can_access_clinic', { p_clinic_id: clinicId })
export const provisionSelf = () => call<void>('provision_self')

// ---- sessions / stations / lines ----

export const createSession = (clinicId: string, auditType: AuditType, roomIds: string[]) =>
  call<string>('create_session', { p_clinic_id: clinicId, p_audit_type: auditType, p_room_ids: roomIds })

export const addStation = (sessionId: string, roomId: string) =>
  call<void>('add_station', { p_session_id: sessionId, p_room_id: roomId })

export const saveLineEdit = (
  sessionId: string,
  roomId: string,
  barangSku: string,
  field: 'qty_kartu' | 'qty_fisik' | 'qty_sistem' | 'remarks',
  value: string
) =>
  call<void>('save_line_edit', {
    p_session_id: sessionId,
    p_room_id: roomId,
    p_barang_sku: barangSku,
    p_field: field,
    p_value: value,
  })

export interface SistemUploadItem {
  sku: string
  name: string
  qty: number
  unit: string
}

export interface ClinicTemplateUploadItem {
  sku: string
  kartu: string | number | null
  fisik: string | number | null
}

export const applyUpload = (
  sessionId: string,
  roomId: string,
  kind: UploadKind,
  items: SistemUploadItem[] | ClinicTemplateUploadItem[]
) =>
  call<{ updated: number; added: number; changed: number }>('apply_upload', {
    p_session_id: sessionId,
    p_room_id: roomId,
    p_kind: kind,
    p_items: items,
  })

export const submitDentalLog = (sessionId: string, roomId: string) =>
  call<{ ketersesuaian: number | null; scorable: number; matched: number; total: number }>(
    'submit_dental_log',
    { p_session_id: sessionId, p_room_id: roomId }
  )

export const reopenDentalLog = (sessionId: string, roomId: string) =>
  call<void>('reopen_dental_log', { p_session_id: sessionId, p_room_id: roomId })

export const finishSession = (sessionId: string) => call<void>('finish_session', { p_session_id: sessionId })

// ---- soft delete ----

export const softDeleteSession = (sessionId: string) =>
  call<void>('soft_delete_session', { p_session_id: sessionId })

export const restoreSession = (sessionId: string) => call<void>('restore_session', { p_session_id: sessionId })

export const softDeleteStation = (sessionId: string, roomId: string) =>
  call<void>('soft_delete_station', { p_session_id: sessionId, p_room_id: roomId })

// ---- admin (Lead-only, enforced server-side) ----

export const adminUpsertUser = (
  email: string,
  name: string,
  role: Role,
  allClinics: boolean,
  clinicIds: string[] | null
) =>
  call<void>('admin_upsert_user', {
    p_email: email,
    p_name: name,
    p_role: role,
    p_all_clinics: allClinics,
    p_clinic_ids: clinicIds,
  })

export const adminDeactivateUser = (email: string) => call<void>('admin_deactivate_user', { p_email: email })

export const adminReactivateUser = (email: string) => call<void>('admin_reactivate_user', { p_email: email })

export const adminSetRole = (email: string, role: Role) =>
  call<void>('admin_set_role', { p_email: email, p_role: role })

export const adminAddRecipient = (clinicId: string, email: string, label: string | null) =>
  call<void>('admin_add_recipient', { p_clinic_id: clinicId, p_email: email, p_label: label })

export const adminRemoveRecipient = (clinicId: string, email: string) =>
  call<void>('admin_remove_recipient', { p_clinic_id: clinicId, p_email: email })

export const adminSaveEmailTemplate = (subject: string, body: string) =>
  call<void>('admin_save_email_template', { p_subject: subject, p_body: body })

export interface AdminUserRow {
  email: string
  name: string
  role: Role
  all_clinics: boolean
  active: boolean
  clinic_ids: string[]
  has_signed_in: boolean
}

export const adminListUsers = () => call<AdminUserRow[]>('admin_list_users')
