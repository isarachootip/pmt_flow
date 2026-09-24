import { toDateTime } from '@/lib/date';

export type JobStatus =
  | 'DRAFT'
  | 'NEW'
  | 'NEW_ORDER'
  | 'ASSIGNED'
  | 'SURVEYED'
  | 'DESIGNED'
  | 'BOQ_CONFIRMED'
  | 'PENDING_TICKET'
  | 'TICKET_ISSUED'
  | 'IN_PROGRESS'
  | 'INSTALLING'
  | 'GANTT_ACTIVE'
  | 'QC_PENDING'
  | 'QC_INSPECTING'
  | 'QC_PASSED'
  | 'QC_CONFIRMED'
  | 'QC_REWORK'
  | 'CLOSED'
  | 'CANCELLED'
  | 'AFTER_SALE';

export type ServiceCategory = 'quick' | 'renovate' | 'ma';

export interface CustomerData {
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  mobile_no?: string;
  address?: string;
  lat?: number;
  lng?: number;
  google_map_url?: string;
}

/**
 * Standardized Job / Project Entity Model for PMT Flow v2.
 * Rule:
 * 1. plan_date is strictly a Date object (วันนัดหมาย) or null.
 * 2. plan_time / time_slot is strictly separated from plan_date (เวลานัดหมาย / ช่วงเวลานัด 24 ชม.).
 * 3. Timestamps (created_at, updated_at, qc_passed_at, etc.) are Date objects.
 */
export interface Job {
  id: string | number;
  jobId?: number;
  job_no: string;
  external_ref_id?: string;
  booking_no?: string;
  ticket_no?: string;
  customer_id?: number;
  customer_name: string;
  customer_phone?: string;
  customer_address?: string;
  customer_data?: CustomerData;
  status: JobStatus;
  job_type: ServiceCategory | string;

  // Separation of Date and Time:
  plan_date: Date | null;       // วันนัดหมาย (Native Date Object)
  plan_time: string | null;     // เวลานัดหมาย (24 ชม. เช่น "08:30" หรือ "08:30 - 12:00")
  time_slot: string | null;     // ช่วงเวลานัดหมาย

  // Assignments & Operational Status
  agent_name?: string;
  assigned_tech?: string;
  assigned_team?: string;
  overall_progress: number;
  services: string[];
  project_sub_type?: string;
  property_type?: string;
  store_code?: string;
  special_instructions?: string;
  additional_notes?: string;

  // Event & Audit Timestamps (Date Objects)
  created_at: Date;
  updated_at: Date;
  qc_passed_at?: Date | null;
  pmt_accepted?: boolean;
  pmt_accepted_at?: Date | null;
  step3_confirmed?: boolean;
  qc_inspection_type?: string | null;
  qc_score?: number | null;
  csat_score?: number | null;
  csat_remarks?: string | null;
  csat_evaluated_at?: Date | null;

  // Rich collections
  photos?: any[];
  tasks?: any[];
  boq_items?: any[];
  boq_discount?: number;
  boq_subtotal?: number;
  boq_grand_total?: number;
}

/**
 * Normalizes raw API response into strongly-typed Job entity
 * Guarantees Date objects for dates/datetimes and clean separation of plan_date & plan_time.
 */
export function normalizeJob(raw: any): Job {
  if (!raw) {
    throw new Error('normalizeJob: raw job data cannot be null or undefined');
  }

  const rawDate = raw.plan_date || raw.date || raw.survey_date || null;
  const rawTime = raw.plan_time || raw.time_slot || raw.schedule_plan?.time_slot || raw.survey_time || raw.time || null;

  return {
    id: raw.id || raw.job_no,
    jobId: raw.jobId || (typeof raw.id === 'number' ? raw.id : undefined),
    job_no: raw.job_no || String(raw.id || ''),
    external_ref_id: raw.external_ref_id || undefined,
    booking_no: raw.booking_no || raw.vfix_no || undefined,
    ticket_no: raw.ticket_no || undefined,
    customer_id: raw.customer_id ? Number(raw.customer_id) : undefined,
    customer_name: raw.customer_name || raw.customer || 'ลูกค้าทั่วไป',
    customer_phone: raw.customer_phone || raw.phone || raw.customer_data?.phone || '',
    customer_address: raw.customer_address || raw.address || raw.customer_data?.address || '',
    customer_data: raw.customer_data || undefined,
    status: (raw.status || 'DRAFT') as JobStatus,
    job_type: (raw.job_type || 'quick') as ServiceCategory,

    // Date & Time Separation
    plan_date: toDateTime(rawDate),
    plan_time: rawTime ? String(rawTime).trim() : null,
    time_slot: rawTime ? String(rawTime).trim() : null,

    // Progress & Assignments
    agent_name: raw.agent_name || raw.agent?.name || undefined,
    assigned_tech: raw.assigned_tech || raw.tech || undefined,
    assigned_team: raw.assigned_team || undefined,
    overall_progress: Number(raw.overall_progress || raw.progress || 0),
    services: Array.isArray(raw.services) ? raw.services : (raw.service ? [raw.service] : []),
    project_sub_type: raw.project_sub_type || raw.service || undefined,
    property_type: raw.property_type || undefined,
    store_code: raw.store_code || raw.store?.code || undefined,
    special_instructions: raw.special_instructions || '',
    additional_notes: raw.additional_notes || '',

    // Event Timestamps (Native Date Objects)
    created_at: toDateTime(raw.created_at) || new Date(),
    updated_at: toDateTime(raw.updated_at) || new Date(),
    qc_passed_at: toDateTime(raw.qc_passed_at),
    pmt_accepted: Boolean(raw.pmt_accepted),
    pmt_accepted_at: toDateTime(raw.pmt_accepted_at),
    step3_confirmed: Boolean(raw.step3_confirmed),
    qc_inspection_type: raw.qc_inspection_type || null,
    qc_score: raw.qc_score !== undefined && raw.qc_score !== null ? Number(raw.qc_score) : null,
    csat_score: raw.csat_score !== undefined && raw.csat_score !== null ? Number(raw.csat_score) : null,
    csat_remarks: raw.csat_remarks || null,
    csat_evaluated_at: toDateTime(raw.csat_evaluated_at),

    // Collections
    photos: Array.isArray(raw.photos) ? raw.photos : [],
    tasks: Array.isArray(raw.tasks) ? raw.tasks : [],
    boq_items: Array.isArray(raw.boq_items) ? raw.boq_items : [],
    boq_discount: Number(raw.boq_discount || 0),
    boq_subtotal: Number(raw.boq_subtotal || 0),
    boq_grand_total: Number(raw.boq_grand_total || 0),
  };
}
