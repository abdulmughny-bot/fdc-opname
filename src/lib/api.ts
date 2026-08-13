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

export const addManualLineItem = (sessionId: string, roomId: string, barangSku: string) =>
  call<Database['dev']['Tables']['dental_log_lines']['Row']>('add_manual_line_item', {
    p_session_id: sessionId,
    p_room_id: roomId,
    p_barang_sku: barangSku,
  })

export const removeLineItem = (sessionId: string, roomId: string, barangSku: string) =>
  call<void>('remove_line_item', { p_session_id: sessionId, p_room_id: roomId, p_barang_sku: barangSku })

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
  oldEmail: string | null,
  email: string,
  name: string,
  role: Role,
  allClinics: boolean,
  clinicIds: string[] | null
) =>
  call<void>('admin_upsert_user', {
    p_old_email: oldEmail,
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

export const adminSaveSettings = (submitThreshold: number) =>
  call<void>('admin_save_settings', { p_submit_threshold: submitThreshold })

// ---- clinics & stations ----

export const adminUpsertClinic = (id: string, name: string) =>
  call<Database['dev']['Tables']['clinics']['Row']>('admin_upsert_clinic', { p_id: id, p_name: name })

export const adminDeleteClinic = (id: string) => call<void>('admin_delete_clinic', { p_id: id })

export const adminUpsertRoom = (id: string | null, clinicId: string, name: string) =>
  call<Database['dev']['Tables']['rooms']['Row']>('admin_upsert_room', {
    p_id: id,
    p_clinic_id: clinicId,
    p_name: name,
  })

export const adminDeleteRoom = (id: string) => call<void>('admin_delete_room', { p_id: id })

export interface AdminUserRow {
  email: string
  name: string
  role: Role
  all_clinics: boolean
  active: boolean
  clinic_ids: string[]
  has_signed_in: boolean
  custom_role_id: string | null
  custom_role_name: string | null
}

export const adminListUsers = () => call<AdminUserRow[]>('admin_list_users')

export const adminDeleteUser = (email: string) => call<void>('admin_delete_user', { p_email: email })

// ---- custom roles ----

export interface CustomRoleRow {
  id: string
  name: string
  can_view_pricing: boolean
  can_edit_item_master: boolean
  can_manage_users: boolean
  can_access_admin: boolean
  created_at: string
  created_by: string | null
}

export const adminListCustomRoles = () => call<CustomRoleRow[]>('admin_list_custom_roles')

export const adminUpsertCustomRole = (
  id: string | null,
  name: string,
  canViewPricing: boolean,
  canEditItemMaster: boolean,
  canManageUsers: boolean,
  canAccessAdmin: boolean
) =>
  call<string>('admin_upsert_custom_role', {
    p_id: id,
    p_name: name,
    p_can_view_pricing: canViewPricing,
    p_can_edit_item_master: canEditItemMaster,
    p_can_manage_users: canManageUsers,
    p_can_access_admin: canAccessAdmin,
  })

export const adminDeleteCustomRole = (id: string) => call<void>('admin_delete_custom_role', { p_id: id })

export const adminAssignCustomRole = (email: string, customRoleId: string | null) =>
  call<void>('admin_assign_custom_role', { p_email: email, p_custom_role_id: customRoleId })

// ---- item master system ----

// Every SKU entering the system via an upload must already exist here —
// Item Master is the validation catalog, not just a pricing reference.
export const getActiveItemSkus = async (): Promise<Set<string>> => {
  const { data, error } = await supabase.from('item_master').select('sku').eq('status', 'Active')
  if (error) throw new Error(error.message)
  return new Set((data ?? []).map((r) => r.sku))
}

// Selling price per SKU (global row, clinic_id null), for valuing report
// discrepancies in Rupiah. Two queries, not a join — no FK embedding is
// configured between item_master and item_pricing (see types/database.ts).
export const getPricingForSkus = async (skus: string[]): Promise<Map<string, number>> => {
  if (skus.length === 0) return new Map()
  const { data: items, error: e1 } = await supabase.from('item_master').select('id,sku').in('sku', skus)
  if (e1) throw new Error(e1.message)
  const idToSku = new Map((items ?? []).map((i) => [i.id, i.sku]))
  const ids = (items ?? []).map((i) => i.id)
  if (ids.length === 0) return new Map()
  const { data: pricing, error: e2 } = await supabase
    .from('item_pricing')
    .select('item_id,selling_price')
    .is('clinic_id', null)
    .in('item_id', ids)
  if (e2) throw new Error(e2.message)
  const map = new Map<string, number>()
  ;(pricing ?? []).forEach((p) => {
    const sku = idToSku.get(p.item_id)
    if (sku) map.set(sku, p.selling_price)
  })
  return map
}

export interface ItemPickerOption {
  sku: string
  name: string
}

export const getActiveItemsForPicker = async (): Promise<ItemPickerOption[]> => {
  const { data, error } = await supabase.from('item_master').select('sku,name').eq('status', 'Active').order('name')
  if (error) throw new Error(error.message)
  return data ?? []
}

export interface ItemMasterRow {
  id: string
  sku: string
  name: string
  category: string | null
  unit: string
  std_qty_per_location: number | null
  cost_price: number | null
  status: 'Active' | 'Inactive' | 'Discontinued'
  created_at: string
  created_by: string | null
}

export interface ItemPricingRow {
  id: string
  item_id: string
  clinic_id: string | null
  cost_price: number | null
  selling_price: number
  margin_pct: number | null
  effective_date: string
  updated_by: string
  updated_at: string
}

export interface ClinicRanking {
  clinic_id: string
  clinic_name: string
  ketersesuaian_pct: number
  total_stations: number
  audited_stations: number
  last_audit_date: string | null
  variance_value: number | null
  trend_direction: string
}

export interface ItemVarianceAnalysis {
  item_id: string
  sku: string
  item_name: string
  category: string | null
  total_sistem_qty: number
  total_fisik_qty: number
  variance_qty: number
  variance_pct: number
  price_per_unit: number | null
  variance_value_rp: number | null
  most_affected_clinic: string
}

// Item Management RPCs
export const updateItemPricing = (
  itemId: string,
  sellingPrice: number,
  costPrice?: number,
  clinicId?: string
) =>
  call<void>('update_item_pricing', {
    p_item_id: itemId,
    p_clinic_id: clinicId,
    p_selling_price: sellingPrice,
    p_cost_price: costPrice,
  })

// Dashboard Analytics RPCs
export const getClinicRankings = (periodType: 'month' | 'quarter' | 'year' = 'month') =>
  call<ClinicRanking[]>('get_clinic_rankings', { p_period_type: periodType })

export const getItemVarianceAnalysis = (
  periodDays: number = 30,
  clinicIds?: string[],
  auditType?: string,
  agent?: string
) => {
  const params: Record<string, unknown> = { p_period_days: periodDays }
  if (clinicIds && clinicIds.length > 0) {
    params.p_clinic_ids = clinicIds
  }
  if (auditType) {
    params.p_audit_type = auditType
  }
  if (agent) {
    params.p_agent = agent
  }
  return call<ItemVarianceAnalysis[]>('get_item_variance_analysis', params)
}
