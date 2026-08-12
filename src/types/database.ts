// Generated from supabase/migrations/0001_schema.sql + 0002_admin.sql.
// Hand-derived (no live DB to introspect yet) — keep in sync with the SQL by hand
// until `supabase gen types` can run against a real project (see docs/DEPLOYMENT.md).

export type Role = 'Lead' | 'Team'
export type AuditType = 'Offline' | 'Self'
export type SessionStatus = 'Active' | 'Finished'
export type StationStatus = 'Not Started' | 'In Progress' | 'Submitted'
export type UploadKind = 'Sistem' | 'ClinicTemplate'

// dev/staging/prod are three isolated Postgres schemas that all get the same
// migrations run against them (see docs/ENVIRONMENTS.md), so they share one
// shape. The Supabase client picks the live one via `db.schema` in
// lib/supabase.ts; supabase-js requires each real schema name to be its own
// top-level key here, not a single generic "public" placeholder.
//
// Every table below declares `Relationships: []` — required by postgrest-js's
// GenericTable shape even though we don't use its relational-embedding
// features (no foreign keys are declared here; joins are done app-side).
interface FdcSchema {
  Tables: {
    clinics: {
      Row: { id: string; name: string }
      Insert: { id: string; name: string }
      Update: Partial<{ id: string; name: string }>
      Relationships: []
    }
    rooms: {
      Row: { id: string; clinic_id: string; name: string }
      Insert: { id?: string; clinic_id: string; name: string }
      Update: Partial<{ id: string; clinic_id: string; name: string }>
      Relationships: []
    }
    barang: {
      Row: { sku: string; name: string; unit: string | null }
      Insert: { sku: string; name: string; unit?: string | null }
      Update: Partial<{ sku: string; name: string; unit: string | null }>
      Relationships: []
    }
    profiles: {
      Row: {
        id: string
        email: string
        name: string
        role: Role
        all_clinics: boolean
        active: boolean
      }
      Insert: {
        id: string
        email: string
        name: string
        role?: Role
        all_clinics?: boolean
        active?: boolean
      }
      Update: Partial<{
        id: string
        email: string
        name: string
        role: Role
        all_clinics: boolean
        active: boolean
      }>
      Relationships: []
    }
    user_clinic_access: {
      Row: { user_id: string; clinic_id: string }
      Insert: { user_id: string; clinic_id: string }
      Update: Partial<{ user_id: string; clinic_id: string }>
      Relationships: []
    }
    allowed_users: {
      Row: { email: string; name: string; role: Role; all_clinics: boolean; active: boolean }
      Insert: { email: string; name: string; role?: Role; all_clinics?: boolean; active?: boolean }
      Update: Partial<{ email: string; name: string; role: Role; all_clinics: boolean; active: boolean }>
      Relationships: []
    }
    clinic_recipients: {
      Row: { id: string; clinic_id: string; email: string; label: string | null }
      Insert: { id?: string; clinic_id: string; email: string; label?: string | null }
      Update: Partial<{ id: string; clinic_id: string; email: string; label: string | null }>
      Relationships: []
    }
    email_settings: {
      Row: {
        id: number
        subject_template: string
        body_template: string
        updated_by: string | null
        updated_at: string | null
      }
      Insert: Partial<{
        id: number
        subject_template: string
        body_template: string
        updated_by: string | null
        updated_at: string | null
      }>
      Update: Partial<{
        id: number
        subject_template: string
        body_template: string
        updated_by: string | null
        updated_at: string | null
      }>
      Relationships: []
    }
    app_settings: {
      Row: { id: number; submit_threshold: number; updated_by: string | null; updated_at: string | null }
      Insert: Partial<{ id: number; submit_threshold: number; updated_by: string | null; updated_at: string | null }>
      Update: Partial<{ id: number; submit_threshold: number; updated_by: string | null; updated_at: string | null }>
      Relationships: []
    }
    sistem_current: {
      Row: {
        clinic_id: string
        room_id: string
        barang_sku: string
        qty: number
        unit: string | null
        updated_at: string
      }
      Insert: {
        clinic_id: string
        room_id: string
        barang_sku: string
        qty: number
        unit?: string | null
        updated_at?: string
      }
      Update: Partial<{
        clinic_id: string
        room_id: string
        barang_sku: string
        qty: number
        unit: string | null
        updated_at: string
      }>
      Relationships: []
    }
    upload_log: {
      Row: {
        id: string
        clinic_id: string
        room_id: string | null
        kind: UploadKind
        uploaded_by: string
        uploaded_at: string
        row_count: number
      }
      Insert: {
        id?: string
        clinic_id: string
        room_id?: string | null
        kind: UploadKind
        uploaded_by: string
        uploaded_at?: string
        row_count: number
      }
      Update: Partial<{
        id: string
        clinic_id: string
        room_id: string | null
        kind: UploadKind
        uploaded_by: string
        uploaded_at: string
        row_count: number
      }>
      Relationships: []
    }
    sessions: {
      Row: {
        id: string
        clinic_id: string
        clinic_name: string
        audit_type: AuditType
        started_by: string
        started_at: string
        status: SessionStatus
        finished_at: string | null
        deleted_at: string | null
        deleted_by: string | null
      }
      Insert: {
        id?: string
        clinic_id: string
        clinic_name: string
        audit_type: AuditType
        started_by: string
        started_at?: string
        status?: SessionStatus
        finished_at?: string | null
        deleted_at?: string | null
        deleted_by?: string | null
      }
      Update: Partial<{
        id: string
        clinic_id: string
        clinic_name: string
        audit_type: AuditType
        started_by: string
        started_at: string
        status: SessionStatus
        finished_at: string | null
        deleted_at: string | null
        deleted_by: string | null
      }>
      Relationships: []
    }
    dental_status: {
      Row: {
        id: string
        session_id: string
        room_id: string
        dental_name: string
        status: StationStatus
        submitted_at: string | null
        ketersesuaian: number | null
        total_count: number
        filled_count: number
        matched_count: number
        scorable_count: number
        amended: boolean
        deleted_at: string | null
        deleted_by: string | null
      }
      Insert: {
        id?: string
        session_id: string
        room_id: string
        dental_name: string
        status?: StationStatus
        submitted_at?: string | null
        ketersesuaian?: number | null
        total_count?: number
        filled_count?: number
        matched_count?: number
        scorable_count?: number
        amended?: boolean
        deleted_at?: string | null
        deleted_by?: string | null
      }
      Update: Partial<{
        id: string
        session_id: string
        room_id: string
        dental_name: string
        status: StationStatus
        submitted_at: string | null
        ketersesuaian: number | null
        total_count: number
        filled_count: number
        matched_count: number
        scorable_count: number
        amended: boolean
        deleted_at: string | null
        deleted_by: string | null
      }>
      Relationships: []
    }
    dental_log_lines: {
      Row: {
        id: string
        session_id: string
        room_id: string
        barang_sku: string
        qty_sistem: number | null
        qty_kartu: number | null
        qty_fisik: number | null
        remarks: string | null
        updated_by: string | null
        updated_at: string | null
      }
      Insert: {
        id?: string
        session_id: string
        room_id: string
        barang_sku: string
        qty_sistem?: number | null
        qty_kartu?: number | null
        qty_fisik?: number | null
        remarks?: string | null
        updated_by?: string | null
        updated_at?: string | null
      }
      Update: Partial<{
        id: string
        session_id: string
        room_id: string
        barang_sku: string
        qty_sistem: number | null
        qty_kartu: number | null
        qty_fisik: number | null
        remarks: string | null
        updated_by: string | null
        updated_at: string | null
      }>
      Relationships: []
    }
    audit_trail: {
      Row: { id: string; at: string; user_email: string; action: string; detail: string | null }
      Insert: { id?: string; at?: string; user_email: string; action: string; detail?: string | null }
      Update: Partial<{ id: string; at: string; user_email: string; action: string; detail: string | null }>
      Relationships: []
    }
    reports_sent: {
      Row: { id: string; session_id: string; sent_at: string; sent_by: string; recipients: string[] }
      Insert: { id?: string; session_id: string; sent_at?: string; sent_by: string; recipients: string[] }
      Update: Partial<{ id: string; session_id: string; sent_at: string; sent_by: string; recipients: string[] }>
      Relationships: []
    }
    expired_log: {
      Row: {
        id: string
        session_id: string | null
        room_id: string | null
        barang_sku: string | null
        qty_expired: number | null
        remarks: string | null
      }
      Insert: {
        id?: string
        session_id?: string | null
        room_id?: string | null
        barang_sku?: string | null
        qty_expired?: number | null
        remarks?: string | null
      }
      Update: Partial<{
        id: string
        session_id: string | null
        room_id: string | null
        barang_sku: string | null
        qty_expired: number | null
        remarks: string | null
      }>
      Relationships: []
    }
  }
  Views: Record<string, never>
  Functions: {
    // ---- schema_v4.sql ----
    period_month: { Args: { ts: string }; Returns: string }
    period_quarter: { Args: { ts: string }; Returns: string }
    is_provisioned: { Args: Record<string, never>; Returns: boolean }
    current_profile: { Args: Record<string, never>; Returns: FdcSchema['Tables']['profiles']['Row'] }
    can_access_clinic: { Args: { p_clinic_id: string }; Returns: boolean }
    provision_self: { Args: Record<string, never>; Returns: void }
    relink_allowed_users: { Args: Record<string, never>; Returns: void }
    create_session: {
      Args: { p_clinic_id: string; p_audit_type: AuditType; p_room_ids: string[] }
      Returns: string
    }
    add_station: { Args: { p_session_id: string; p_room_id: string }; Returns: void }
    recompute_station: { Args: { p_session_id: string; p_room_id: string }; Returns: void }
    save_line_edit: {
      Args: {
        p_session_id: string
        p_room_id: string
        p_barang_sku: string
        p_field: 'qty_kartu' | 'qty_fisik' | 'qty_sistem' | 'remarks'
        p_value: string
      }
      Returns: void
    }
    apply_upload: {
      Args: { p_session_id: string; p_room_id: string; p_kind: UploadKind; p_items: unknown }
      Returns: { updated: number; added: number; changed: number }
    }
    submit_dental_log: {
      Args: { p_session_id: string; p_room_id: string }
      Returns: { ketersesuaian: number | null; scorable: number; matched: number; total: number }
    }
    reopen_dental_log: { Args: { p_session_id: string; p_room_id: string }; Returns: void }
    finish_session: { Args: { p_session_id: string }; Returns: void }
    soft_delete_session: { Args: { p_session_id: string }; Returns: void }
    restore_session: { Args: { p_session_id: string }; Returns: void }
    soft_delete_station: { Args: { p_session_id: string; p_room_id: string }; Returns: void }
    // ---- admin_patch.sql ----
    is_lead: { Args: Record<string, never>; Returns: boolean }
    admin_upsert_user: {
      Args: {
        p_old_email: string | null
        p_email: string
        p_name: string
        p_role: Role
        p_all_clinics: boolean
        p_clinic_ids: string[] | null
      }
      Returns: void
    }
    admin_deactivate_user: { Args: { p_email: string }; Returns: void }
    admin_reactivate_user: { Args: { p_email: string }; Returns: void }
    admin_set_role: { Args: { p_email: string; p_role: Role }; Returns: void }
    admin_add_recipient: { Args: { p_clinic_id: string; p_email: string; p_label: string | null }; Returns: void }
    admin_remove_recipient: { Args: { p_clinic_id: string; p_email: string }; Returns: void }
    admin_save_email_template: { Args: { p_subject: string; p_body: string }; Returns: void }
    admin_save_settings: { Args: { p_submit_threshold: number }; Returns: void }
    admin_list_users: {
      Args: Record<string, never>
      Returns: {
        email: string
        name: string
        role: Role
        all_clinics: boolean
        active: boolean
        clinic_ids: string[]
        has_signed_in: boolean
      }[]
    }
  }
  Enums: Record<string, never>
}

export interface Database {
  dev: FdcSchema
  staging: FdcSchema
  prod: FdcSchema
}
