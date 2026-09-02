-- =============================================================================
-- SPMT (Store Project Management Tool) - Production Database Schema
-- Database: PostgreSQL 15+
-- Version: 1.0.0
-- Date: 2026-09-01
-- =============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM TYPES
-- =============================================================================
CREATE TYPE job_status_enum AS ENUM (
    'DRAFT',
    'SURVEYED',
    'DESIGN',
    'BOQ',
    'IN_PROGRESS',
    'QC_PENDING',
    'QC_PASSED',
    'AFTER_SALE',
    'CLOSED',
    'CANCELLED'
);

CREATE TYPE task_status_enum AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'DONE',
    'OVERDUE',
    'REWORK',
    'CANCELLED'
);

CREATE TYPE qc_result_enum AS ENUM (
    'PASS',
    'FAIL',
    'NA'
);

CREATE TYPE csat_result_enum AS ENUM (
    'PASS',
    'FAIL'
);

CREATE TYPE after_sale_type_enum AS ENUM (
    'WARRANTY_CLAIM',
    'REPAIR_SERVICE',
    'COMPLAINT'
);

-- =============================================================================
-- 1. MASTER DATA TABLES
-- =============================================================================

-- System Configurations (Geo-fence radius, Alert days, etc.)
CREATE TABLE sys_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User Accounts & Roles
CREATE TABLE m_user (
    id BIGSERIAL PRIMARY KEY,
    user_code VARCHAR(20) UNIQUE NOT NULL,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(150) NOT NULL,
    email VARCHAR(100),
    phone VARCHAR(30),
    role VARCHAR(30) NOT NULL, -- ADMIN, SALE, DESIGNER, MANAGER, TECH, QC, AFTERSALE, ACCOUNT
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Customers
CREATE TABLE m_customer (
    id BIGSERIAL PRIMARY KEY,
    customer_code VARCHAR(30) UNIQUE NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(100),
    address TEXT NOT NULL,
    lat NUMERIC(10, 7) NOT NULL,
    lng NUMERIC(10, 7) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Service Types Master
CREATE TABLE m_service_type (
    id BIGSERIAL PRIMARY KEY,
    service_code VARCHAR(30) UNIQUE NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE
);

-- Material / Price Standard Master (For BOQ)
CREATE TABLE m_material (
    id BIGSERIAL PRIMARY KEY,
    material_code VARCHAR(30) UNIQUE NOT NULL,
    material_name VARCHAR(200) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    standard_price NUMERIC(15, 2) NOT NULL,
    cost_price NUMERIC(15, 2),
    effective_date DATE DEFAULT CURRENT_DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- QC Checklist Templates
CREATE TABLE m_qc_checklist_template (
    id BIGSERIAL PRIMARY KEY,
    template_name VARCHAR(100) NOT NULL,
    service_type_id BIGINT REFERENCES m_service_type(id),
    is_active BOOLEAN DEFAULT TRUE
);

CREATE TABLE m_qc_checklist_item (
    id BIGSERIAL PRIMARY KEY,
    template_id BIGINT NOT NULL REFERENCES m_qc_checklist_template(id) ON DELETE CASCADE,
    item_order INT NOT NULL,
    description TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT FALSE -- Mandatory item failing triggers overall QC FAIL
);

-- =============================================================================
-- 2. INBOUND & INTEGRATION LOGS (INT & BMT)
-- =============================================================================

CREATE TABLE t_integration_log (
    id BIGSERIAL PRIMARY KEY,
    direction VARCHAR(10) NOT NULL, -- 'INBOUND', 'OUTBOUND'
    target_system VARCHAR(20) NOT NULL, -- 'INT', 'BMT'
    endpoint VARCHAR(255) NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE,
    raw_payload JSONB NOT NULL,
    response_payload JSONB,
    http_status INT,
    status VARCHAR(20) NOT NULL, -- 'SUCCESS', 'FAILED', 'RETRY'
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Staging Table for Survey / Site Visit Reports before Core Conversion
CREATE TABLE t_staging_survey_report (
    id BIGSERIAL PRIMARY KEY,
    source_job_id VARCHAR(100) NOT NULL,
    job_number VARCHAR(50) NOT NULL,
    booking_no VARCHAR(50),
    ticket_no VARCHAR(50),
    source_reference VARCHAR(100),
    customer_code VARCHAR(100),
    customer_name VARCHAR(150),
    customer_phone VARCHAR(30),
    store_code VARCHAR(30),
    agent_code VARCHAR(100),
    visit_date DATE,
    checkin_at TIMESTAMP WITH TIME ZONE,
    checkout_at TIMESTAMP WITH TIME ZONE,
    photo_count INT DEFAULT 0,
    raw_payload JSONB NOT NULL,
    process_status VARCHAR(30) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'CONVERTED', 'VALIDATION_FAILED', 'ERROR'
    converted_job_id BIGINT,
    validation_errors JSONB,
    error_message TEXT,
    retry_count INT NOT NULL DEFAULT 0,
    received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 3. CORE TRANSACTION TABLES (JOBS & VISITS)
-- =============================================================================

-- Main Job / Order
CREATE TABLE t_job (
    id BIGSERIAL PRIMARY KEY,
    job_no VARCHAR(30) UNIQUE NOT NULL, -- Format: JOBYYYYMMXXX e.g. JOB202609001
    external_ref_id VARCHAR(100), -- Ref from INT system
    customer_id BIGINT NOT NULL REFERENCES m_customer(id),
    primary_service_id BIGINT REFERENCES m_service_type(id),
    status job_status_enum NOT NULL DEFAULT 'DRAFT',
    assigned_tech_id BIGINT REFERENCES m_user(id),
    assigned_tech_name VARCHAR(150),
    assigned_tech_phone VARCHAR(30),
    appointment_date DATE,
    appointment_time TIME,
    overall_progress INT DEFAULT 0 CHECK (overall_progress BETWEEN 0 AND 100),
    bmt_export_ref VARCHAR(100),
    bmt_exported_at TIMESTAMP WITH TIME ZONE,
    closed_at TIMESTAMP WITH TIME ZONE,
    created_by BIGINT REFERENCES m_user(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Additional Services attached to a Job
CREATE TABLE t_job_service (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    service_id BIGINT REFERENCES m_service_type(id),
    service_name VARCHAR(100) NOT NULL,
    notes TEXT
);

-- Site Visit & Check-in Log (Mobile App)
CREATE TABLE t_visit_checkin (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    tech_id BIGINT REFERENCES m_user(id),
    checkin_at TIMESTAMP WITH TIME ZONE NOT NULL,
    checkout_at TIMESTAMP WITH TIME ZONE,
    duration_minutes INT,
    checkin_lat NUMERIC(10, 7) NOT NULL,
    checkin_lng NUMERIC(10, 7) NOT NULL,
    distance_meters NUMERIC(8, 2),
    is_in_radius BOOLEAN NOT NULL DEFAULT TRUE,
    out_of_radius_reason TEXT,
    photo_count INT DEFAULT 0 CHECK (photo_count >= 0),
    visit_summary TEXT,
    progress_reported INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Site Photos (Minimum 5 required)
CREATE TABLE t_site_photo (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    visit_checkin_id BIGINT REFERENCES t_visit_checkin(id),
    file_path VARCHAR(500) NOT NULL,
    file_size_bytes BIGINT,
    photo_angle_tag VARCHAR(50), -- 'FRONT', 'LEFT', 'RIGHT', 'POWER_POINT', 'OVERALL'
    taken_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    lat NUMERIC(10, 7),
    lng NUMERIC(10, 7)
);

-- =============================================================================
-- 4. DESIGN & BOQ TABLES
-- =============================================================================

-- Design Files (With Versioning)
CREATE TABLE t_design_file (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    version_no INT NOT NULL DEFAULT 1,
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_type VARCHAR(20) NOT NULL, -- 'pdf', 'dwg', 'jpg', 'skp'
    file_size_bytes BIGINT,
    is_current BOOLEAN DEFAULT TRUE,
    remark TEXT,
    uploaded_by BIGINT REFERENCES m_user(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- BOQ Header
CREATE TABLE t_boq (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    version_no INT NOT NULL DEFAULT 1,
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    discount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    vat_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    grand_total NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    is_current BOOLEAN DEFAULT TRUE,
    created_by BIGINT REFERENCES m_user(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- BOQ Items (Price Locked Snapshot)
CREATE TABLE t_boq_item (
    id BIGSERIAL PRIMARY KEY,
    boq_id BIGINT NOT NULL REFERENCES t_boq(id) ON DELETE CASCADE,
    item_order INT NOT NULL,
    material_id BIGINT REFERENCES m_material(id),
    description VARCHAR(300) NOT NULL,
    qty NUMERIC(12, 3) NOT NULL,
    unit VARCHAR(30) NOT NULL,
    unit_price NUMERIC(15, 2) NOT NULL, -- Locked price at time of creation
    cost_price NUMERIC(15, 2),
    amount NUMERIC(15, 2) NOT NULL
);

-- =============================================================================
-- 5. TASKS & SCHEDULING (Gantt - Independent Tasks)
-- =============================================================================

CREATE TABLE t_task (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    task_name VARCHAR(200) NOT NULL,
    assigned_tech_id BIGINT REFERENCES m_user(id),
    assigned_tech_name VARCHAR(150),
    plan_start_date DATE NOT NULL,
    plan_end_date DATE NOT NULL,
    duration_days INT NOT NULL,
    progress_percent INT DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    status task_status_enum NOT NULL DEFAULT 'PENDING',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Daily Task Log (Technician Daily Reports)
CREATE TABLE t_daily_task_log (
    id BIGSERIAL PRIMARY KEY,
    task_id BIGINT NOT NULL REFERENCES t_task(id) ON DELETE CASCADE,
    tech_id BIGINT REFERENCES m_user(id),
    work_date DATE NOT NULL,
    checkin_at TIMESTAMP WITH TIME ZONE,
    checkout_at TIMESTAMP WITH TIME ZONE,
    progress_reported INT CHECK (progress_reported BETWEEN 0 AND 100),
    work_summary TEXT,
    issues_noted TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- 6. QC, AFTER SALE & CSAT TABLES
-- =============================================================================

-- QC Inspection Header
CREATE TABLE t_qc_inspection (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    round_no INT NOT NULL DEFAULT 1,
    inspector_id BIGINT REFERENCES m_user(id),
    overall_result qc_result_enum NOT NULL DEFAULT 'NA',
    remarks TEXT,
    inspected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- QC Inspection Item Details
CREATE TABLE t_qc_inspection_item (
    id BIGSERIAL PRIMARY KEY,
    inspection_id BIGINT NOT NULL REFERENCES t_qc_inspection(id) ON DELETE CASCADE,
    checklist_item_id BIGINT REFERENCES m_qc_checklist_item(id),
    item_description TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT FALSE,
    result qc_result_enum NOT NULL DEFAULT 'NA',
    remark TEXT,
    photo_path VARCHAR(500)
);

-- After Sale & CSAT Survey
CREATE TABLE t_after_sale_case (
    id BIGSERIAL PRIMARY KEY,
    case_no VARCHAR(30) UNIQUE NOT NULL, -- e.g. AS-256909-0001
    job_id BIGINT NOT NULL REFERENCES t_job(id),
    case_type after_sale_type_enum NOT NULL DEFAULT 'COMPLAINT',
    csat_score INT CHECK (csat_score BETWEEN 1 AND 5),
    csat_result csat_result_enum,
    customer_feedback TEXT,
    contacted_by BIGINT REFERENCES m_user(id),
    contacted_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'OPEN', -- 'OPEN', 'RESOLVED', 'CLOSED'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payment Ticket (Slip attachment only - No gateway)
CREATE TABLE t_payment_ticket (
    id BIGSERIAL PRIMARY KEY,
    ticket_no VARCHAR(30) UNIQUE NOT NULL, -- e.g. TKT-256909-0001
    job_id BIGINT NOT NULL REFERENCES t_job(id),
    amount NUMERIC(15, 2) NOT NULL,
    payment_date DATE NOT NULL,
    payment_method VARCHAR(50) DEFAULT 'BANK_TRANSFER',
    slip_photo_path VARCHAR(500) NOT NULL,
    recorded_by BIGINT REFERENCES m_user(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Job Status Audit History
CREATE TABLE t_job_status_log (
    id BIGSERIAL PRIMARY KEY,
    job_id BIGINT NOT NULL REFERENCES t_job(id) ON DELETE CASCADE,
    from_status job_status_enum,
    to_status job_status_enum NOT NULL,
    changed_by BIGINT REFERENCES m_user(id),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- INDEXES FOR OPTIMAL PERFORMANCE
-- =============================================================================
CREATE INDEX idx_t_job_status ON t_job(status);
CREATE INDEX idx_t_job_customer ON t_job(customer_id);
CREATE INDEX idx_t_job_assigned_tech ON t_job(assigned_tech_id);
CREATE INDEX idx_t_task_job_id ON t_task(job_id);
CREATE INDEX idx_t_task_dates ON t_task(plan_start_date, plan_end_date);
CREATE INDEX idx_t_visit_checkin_job ON t_visit_checkin(job_id);
CREATE INDEX idx_t_site_photo_job ON t_site_photo(job_id);
CREATE INDEX idx_t_integration_idempotency ON t_integration_log(idempotency_key);
CREATE UNIQUE INDEX idx_staging_source_job_id ON t_staging_survey_report(source_job_id);
CREATE INDEX idx_staging_job_number ON t_staging_survey_report(job_number);
CREATE INDEX idx_staging_booking_no ON t_staging_survey_report(booking_no);
CREATE INDEX idx_staging_process_status ON t_staging_survey_report(process_status);
CREATE INDEX idx_staging_raw_payload_gin ON t_staging_survey_report USING GIN (raw_payload);

-- =============================================================================
-- INITIAL DATA SEEDING
-- =============================================================================

INSERT INTO sys_config (config_key, config_value, description) VALUES
('CHECKIN_RADIUS_METERS', '400', 'Geofence radius for technician checkin'),
('MIN_SITE_PHOTOS', '5', 'Minimum site photos required before SURVEYED status'),
('QC_ALERT_DAYS_BEFORE_DEADLINE', '5', 'Days before task deadline to trigger QC alert'),
('INT_API_ENDPOINT', 'https://int.system.local/api/v1', 'INT System Base URL'),
('BMT_API_ENDPOINT', 'https://bmt.system.local/api/v1', 'BMT System Base URL');

INSERT INTO m_service_type (service_code, service_name, description) VALUES
('SVC-WATER-HEATER', 'ติดตั้งเครื่องทำน้ำอุ่น', 'บริการติดตั้งเครื่องทำน้ำอุ่นพร้อมเดินสายไฟ'),
('SVC-PUMP-TANK', 'ปั้มแท็งก์', 'บริการติดตั้งปั้มน้ำและแท็งก์น้ำ'),
('SVC-KITCHEN-RENO', 'Renovate ครัว', 'บริการปรับปรุงและต่อเติมห้องครัว'),
('SVC-SITE-SURVEY', 'สำรวจหน้างาน', 'บริการเข้าสำรวจพื้นที่และประเมินหน้างาน');

INSERT INTO m_user (user_code, username, password_hash, full_name, email, role) VALUES
('USR-001', 'admin', '$2a$10$abcdefghijklmnopqrstuvwxyz123456', 'Administrator', 'admin@pmt.local', 'ADMIN'),
('USR-002', 'manager', '$2a$10$abcdefghijklmnopqrstuvwxyz123456', 'Project Manager', 'mgr@pmt.local', 'MANAGER');
