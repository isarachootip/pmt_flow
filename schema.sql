-- =============================================================================
-- SPMT (Store Project Management Tool) - Production Master Database Schema
-- Database: PostgreSQL 15+
-- Version: 2.0.0 (Updated: September 2026)
-- Target: Dev (https://vibepmt.online) & Production (https://prod.vibepmt.online)
-- =============================================================================

-- 1. Enable Required Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 2. SYSTEM & AUTHENTICATION TABLES
-- =============================================================================

-- System Configurations (Geo-fence radius, Alert days, API endpoints)
CREATE TABLE IF NOT EXISTS sys_config (
    config_key VARCHAR(50) PRIMARY KEY,
    config_value VARCHAR(255) NOT NULL,
    description TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- System Users (Authentication & Authorization: ADMIN, AE, QC, CONTACT_CENTER)
CREATE TABLE IF NOT EXISTS sys_users (
    id            BIGSERIAL PRIMARY KEY,
    user_code     VARCHAR(20)       UNIQUE NOT NULL,
    username      VARCHAR(50)       UNIQUE NOT NULL,
    email         VARCHAR(100)      UNIQUE,
    full_name     VARCHAR(150)      NOT NULL,
    role          VARCHAR(50)       NOT NULL DEFAULT 'AE',
    password_hash VARCHAR(255)      NOT NULL,
    is_active     BOOLEAN           DEFAULT TRUE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Active User Session Tokens
CREATE TABLE IF NOT EXISTS sys_user_sessions (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT       NOT NULL REFERENCES sys_users(id) ON DELETE CASCADE,
    token_hash  VARCHAR(255) NOT NULL UNIQUE,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    expires_at  TIMESTAMP WITH TIME ZONE NOT NULL,
    revoked_at  TIMESTAMP WITH TIME ZONE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sys_user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON sys_user_sessions(user_id);

-- System Login Audit Logs
CREATE TABLE IF NOT EXISTS sys_login_log (
    id          BIGSERIAL PRIMARY KEY,
    username    VARCHAR(50)  NOT NULL,
    user_id     BIGINT       REFERENCES sys_users(id) ON DELETE SET NULL,
    success     BOOLEAN      NOT NULL,
    ip_address  VARCHAR(45),
    user_agent  TEXT,
    fail_reason VARCHAR(100),
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_login_log_user ON sys_login_log(username);
CREATE INDEX IF NOT EXISTS idx_login_log_time ON sys_login_log(created_at DESC);

-- =============================================================================
-- 3. CORE OPERATIONAL TABLES (7-STEP PIPELINE & QUICK SERVICES)
-- =============================================================================

-- Core Jobs & Projects (Main Order Pipeline: Step 1 - Step 7)
CREATE TABLE IF NOT EXISTS core_jobs (
    id                    SERIAL PRIMARY KEY,
    job_no                VARCHAR(50) UNIQUE NOT NULL,
    external_ref_id       VARCHAR(100),
    booking_no            VARCHAR(100),
    ticket_no             VARCHAR(100),
    customer_id           INT DEFAULT 1,
    status                VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    job_type              VARCHAR(50) DEFAULT 'quick',
    step_timestamps       JSONB DEFAULT '{}'::jsonb,
    property_type         TEXT,
    project_type          TEXT,
    project_sub_type      TEXT,
    store_code            VARCHAR(50),
    agent_name            VARCHAR(150),
    assigned_tech         VARCHAR(150),
    plan_date             VARCHAR(50),
    services              JSONB DEFAULT '[]'::jsonb,
    overall_progress      INT DEFAULT 0,
    special_instructions  TEXT,
    additional_notes      TEXT,
    customer_data         JSONB DEFAULT '{}'::jsonb,
    tasks                 JSONB DEFAULT '[]'::jsonb,
    photos                JSONB DEFAULT '[]'::jsonb,
    boq_items             JSONB DEFAULT '[]'::jsonb,
    boq_discount          NUMERIC DEFAULT 0,
    boq_subtotal          NUMERIC DEFAULT 0,
    boq_grand_total       NUMERIC DEFAULT 0,
    pmt_accepted          BOOLEAN DEFAULT FALSE,
    pmt_accepted_at       TIMESTAMP WITH TIME ZONE,
    step3_confirmed       BOOLEAN DEFAULT FALSE,
    qc_inspection_type    VARCHAR(50),
    qc_passed_at          TIMESTAMP WITH TIME ZONE,
    csat_score            NUMERIC DEFAULT NULL,
    csat_remarks          TEXT,
    csat_photos           JSONB DEFAULT '[]'::jsonb,
    csat_surveyor         VARCHAR(150),
    csat_evaluated_at     TIMESTAMP WITH TIME ZONE,
    job_details           JSONB DEFAULT '[]'::jsonb,
    agent_data            JSONB DEFAULT '{}'::jsonb,
    store_data            JSONB DEFAULT '{}'::jsonb,
    schedule_plan         JSONB DEFAULT '{}'::jsonb,
    checkin_data          JSONB DEFAULT '{}'::jsonb,
    checkout_data         JSONB DEFAULT '{}'::jsonb,
    approval_data         JSONB DEFAULT '{}'::jsonb,
    visit_results         JSONB DEFAULT '[]'::jsonb,
    remarks_data          JSONB DEFAULT '{}'::jsonb,
    file_int_image        TEXT,
    raw_payload           JSONB DEFAULT '{}'::jsonb,
    created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_core_jobs_status     ON core_jobs(status);
CREATE INDEX IF NOT EXISTS idx_core_jobs_job_no     ON core_jobs(job_no);
CREATE INDEX IF NOT EXISTS idx_core_jobs_plan_date  ON core_jobs(plan_date);
CREATE INDEX IF NOT EXISTS idx_core_jobs_created_at ON core_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_core_jobs_customer   ON core_jobs USING GIN (customer_data);

-- Technician Daily Work Reports (24-Hour Format, 5 Site Photos, Daily Progress)
CREATE TABLE IF NOT EXISTS core_daily_work_logs (
    id                  VARCHAR(64) PRIMARY KEY,
    job_id              VARCHAR(64) NOT NULL,
    job_no              VARCHAR(50),
    task_id             VARCHAR(64) NOT NULL,
    task_name           VARCHAR(255),
    log_date            VARCHAR(20) NOT NULL,
    start_time          VARCHAR(10) DEFAULT '08:30',
    end_time            VARCHAR(10) DEFAULT '17:00',
    work_hours          VARCHAR(20) DEFAULT '8.5 ชม.',
    day_number          INT DEFAULT 1,
    total_days          INT DEFAULT 1,
    technician          VARCHAR(150),
    recorded_by         VARCHAR(150),
    reporter_role       VARCHAR(20) DEFAULT 'TECH',
    progress_percent    INT DEFAULT 0,
    work_description    TEXT,
    additional_details  TEXT,
    issues_encountered  TEXT,
    solutions_applied   TEXT,
    materials_used      TEXT,
    photos              JSONB DEFAULT '[]'::jsonb,
    is_completed        BOOLEAN DEFAULT FALSE,
    is_final_day        BOOLEAN DEFAULT FALSE,
    supervisor_approved BOOLEAN DEFAULT FALSE,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_daily_logs_job_id  ON core_daily_work_logs(job_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_task_id ON core_daily_work_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_daily_logs_date    ON core_daily_work_logs(log_date DESC);

-- QC Inspection Bookings (Online / On-site 5-day prior notice triggers)
CREATE TABLE IF NOT EXISTS core_qc_bookings (
    id                  VARCHAR(64) PRIMARY KEY,
    job_id              VARCHAR(64) NOT NULL,
    job_no              VARCHAR(50),
    customer_name       VARCHAR(150),
    booking_date        VARCHAR(20) NOT NULL,
    time_slot           VARCHAR(50) DEFAULT 'เช้า (09:00 - 12:00)',
    technician_name     VARCHAR(150),
    qc_inspector        VARCHAR(150),
    status              VARCHAR(30) DEFAULT 'PENDING',
    checklist           JSONB DEFAULT '[]'::jsonb,
    notes               TEXT,
    photos              JSONB DEFAULT '[]'::jsonb,
    task_id             VARCHAR(64),
    task_name           VARCHAR(255),
    plan_start_date     VARCHAR(20),
    plan_end_date       VARCHAR(20),
    qc_booking_date     VARCHAR(20),
    days_before         INT DEFAULT 5,
    assigned_tech       VARCHAR(150),
    assigned_qc_tech    VARCHAR(150),
    confirmed_at        TIMESTAMP WITH TIME ZONE,
    confirmed_by        VARCHAR(150),
    remarks             TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qc_bookings_job_id  ON core_qc_bookings(job_id);
CREATE INDEX IF NOT EXISTS idx_qc_bookings_date    ON core_qc_bookings(qc_booking_date ASC);
CREATE INDEX IF NOT EXISTS idx_qc_bookings_status  ON core_qc_bookings(status);

-- Inbound REST API Request Logs & Diagnostics
CREATE TABLE IF NOT EXISTS inbound_api_logs (
    id            VARCHAR(64) PRIMARY KEY,
    timestamp     TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    method        VARCHAR(10),
    path          TEXT,
    ip            VARCHAR(45),
    status        INT,
    duration_ms   INT,
    headers       JSONB DEFAULT '{}'::jsonb,
    body          JSONB,
    response_body JSONB
);

CREATE INDEX IF NOT EXISTS idx_api_logs_time   ON inbound_api_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_api_logs_status ON inbound_api_logs(status);

-- Staging Table for Inbound Site Visit / Survey Webhooks
CREATE TABLE IF NOT EXISTS staging_survey_reports (
    id                BIGINT PRIMARY KEY,
    source_job_id     VARCHAR(100),
    job_number        VARCHAR(50),
    booking_no        VARCHAR(100),
    ticket_no         VARCHAR(100),
    source_reference  VARCHAR(100),
    customer_code     VARCHAR(100),
    customer_name     VARCHAR(200),
    customer_phone    VARCHAR(50),
    store_code        VARCHAR(50),
    agent_code        VARCHAR(50),
    visit_date        VARCHAR(50),
    checkin_at        VARCHAR(50),
    checkout_at       VARCHAR(50),
    photo_count       INT DEFAULT 0,
    raw_payload       JSONB DEFAULT '{}'::jsonb,
    process_status    VARCHAR(50) DEFAULT 'PENDING',
    converted_job_id  BIGINT,
    retry_count       INT DEFAULT 0,
    validation_errors JSONB DEFAULT '[]'::jsonb,
    error_message     TEXT,
    received_at       TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processed_at      TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_staging_job_no ON staging_survey_reports(job_number);
CREATE INDEX IF NOT EXISTS idx_staging_status ON staging_survey_reports(process_status);

-- =============================================================================
-- 4. RECURRING MAINTENANCE / MA CONTRACTS & ROUNDS (สัญญา MA)
-- =============================================================================

CREATE TABLE IF NOT EXISTS ma_contracts (
    id                  VARCHAR(64) PRIMARY KEY,
    contract_no         VARCHAR(50) UNIQUE NOT NULL,
    customer_id         BIGINT,
    customer_site_id    BIGINT,
    customer_name       VARCHAR(150),
    customer_phone      VARCHAR(50),
    site_name           VARCHAR(150),
    site_address        TEXT,
    service_type        VARCHAR(100) NOT NULL,
    service_items       JSONB DEFAULT '[]'::jsonb,
    frequency_months    INT NOT NULL DEFAULT 3,
    total_rounds        INT NOT NULL DEFAULT 4,
    contract_start_date DATE NOT NULL,
    contract_end_date   DATE,
    contract_value      NUMERIC(14,2) DEFAULT 0.00,
    status              VARCHAR(50) DEFAULT 'Active',
    notes               TEXT,
    created_by          VARCHAR(64) DEFAULT 'system',
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ma_rounds (
    id                  VARCHAR(64) PRIMARY KEY,
    contract_id         VARCHAR(64) NOT NULL REFERENCES ma_contracts(id) ON DELETE CASCADE,
    project_id          BIGINT,
    round_number        INT NOT NULL,
    scheduled_date      DATE NOT NULL,
    actual_date         DATE,
    status              VARCHAR(50) DEFAULT 'Scheduled',
    technician_id       BIGINT,
    notes               TEXT,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ma_checklist_templates (
    id                  VARCHAR(64) PRIMARY KEY,
    service_type        VARCHAR(100) NOT NULL,
    template_name       VARCHAR(200) NOT NULL,
    checklist_items     JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ma_contracts_status  ON ma_contracts(status);
CREATE INDEX IF NOT EXISTS idx_ma_rounds_contract   ON ma_rounds(contract_id);
CREATE INDEX IF NOT EXISTS idx_ma_rounds_scheduled  ON ma_rounds(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_ma_rounds_status     ON ma_rounds(status);

-- =============================================================================
-- 5. MASTER REFERENCE CATALOGS
-- =============================================================================

CREATE TABLE IF NOT EXISTS m_customer (
    id            BIGSERIAL PRIMARY KEY,
    customer_code VARCHAR(30) UNIQUE NOT NULL,
    first_name    VARCHAR(100) NOT NULL,
    last_name     VARCHAR(100) NOT NULL,
    phone         VARCHAR(30) NOT NULL,
    email         VARCHAR(100),
    address       TEXT NOT NULL,
    lat           NUMERIC(10, 7) NOT NULL,
    lng           NUMERIC(10, 7) NOT NULL,
    created_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS m_service_type (
    id           BIGSERIAL PRIMARY KEY,
    service_code VARCHAR(30) UNIQUE NOT NULL,
    service_name VARCHAR(100) NOT NULL,
    description  TEXT,
    is_active    BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS m_technician (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT REFERENCES sys_users(id) ON DELETE SET NULL,
    tech_code   VARCHAR(30) UNIQUE NOT NULL,
    full_name   VARCHAR(150) NOT NULL,
    phone       VARCHAR(30),
    skill_type  VARCHAR(100),
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS m_material (
    id             BIGSERIAL PRIMARY KEY,
    material_code  VARCHAR(30) UNIQUE NOT NULL,
    material_name  VARCHAR(200) NOT NULL,
    unit           VARCHAR(30) NOT NULL,
    standard_price NUMERIC(15, 2) NOT NULL,
    cost_price     NUMERIC(15, 2),
    effective_date DATE DEFAULT CURRENT_DATE,
    is_active      BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- 6. MASTER SEED DATA INITIALIZATION
-- =============================================================================

-- 6.1 System Config Seeds
INSERT INTO sys_config (config_key, config_value, description) VALUES
('CHECKIN_RADIUS_METERS', '400', 'Geofence radius for technician checkin'),
('MIN_SITE_PHOTOS', '5', 'Minimum site photos required before SURVEYED status'),
('QC_ALERT_DAYS_BEFORE_DEADLINE', '5', 'Days before task deadline to trigger QC alert'),
('INT_API_ENDPOINT', 'https://int.system.local/api/v1', 'INT System Base URL'),
('BMT_API_ENDPOINT', 'https://bmt.system.local/api/v1', 'BMT System Base URL')
ON CONFLICT (config_key) DO NOTHING;

-- 6.2 Service Types Seeds
INSERT INTO m_service_type (service_code, service_name, description) VALUES
('SVC-WATER-HEATER', 'ติดตั้งเครื่องทำน้ำอุ่น', 'บริการติดตั้งเครื่องทำน้ำอุ่นพร้อมเดินสายไฟ'),
('SVC-PUMP-TANK', 'ปั้มแท็งก์', 'บริการติดตั้งปั้มน้ำและแท็งก์น้ำ'),
('SVC-KITCHEN-RENO', 'Renovate ครัว', 'บริการปรับปรุงและต่อเติมห้องครัว'),
('SVC-SITE-SURVEY', 'สำรวจหน้างาน', 'บริการเข้าสำรวจพื้นที่และประเมินหน้างาน')
ON CONFLICT (service_code) DO NOTHING;

-- 6.3 System Users Seeds (6 Core Accounts + Master Admin)
-- Passwords: Admin@1234, Ae@1234, Qc@1234, Cc@1234
INSERT INTO sys_users (user_code, username, email, full_name, role, password_hash, is_active) VALUES
('USR-001',  'admin',               'admin@pmt.com',          'ผู้ดูแลระบบ',        'ADMIN',          '$2a$12$demo_df4740268cae8dd415b3c396825c0ff1800f16f0b48db929c426639bcf469bfd', TRUE),
('USR-001B', 'isarachootip@gmail.com', 'isarachootip@gmail.com', 'Isara Chootip',      'ADMIN',          '$2a$12$demo_df4740268cae8dd415b3c396825c0ff1800f16f0b48db929c426639bcf469bfd', TRUE),
('USR-002',  'pm.somrak',           'somrak@pmt.local',       'สมรัก บริหารเก่ง',   'ADMIN',          '$2a$12$demo_df4740268cae8dd415b3c396825c0ff1800f16f0b48db929c426639bcf469bfd', TRUE),
('USR-003',  'ae.somchai',          'somchai@pmt.local',      'สมชาย ขยันทำ',       'AE',             '$2a$12$demo_015099516641aece866a9d70081d6d2b4a530eb7d6ff68853b0a7018318408a2', TRUE),
('USR-004',  'ae.malee',            'malee@pmt.local',        'มาลี สวยงาม',        'AE',             '$2a$12$demo_015099516641aece866a9d70081d6d2b4a530eb7d6ff68853b0a7018318408a2', TRUE),
('USR-005',  'qc.wichai',           'wichai@pmt.local',       'วิชัย ตรวจดี',       'QC',             '$2a$12$demo_c0e0b3c6317bc2d4a67cb56a09a5b9e07f7b243445ad0a931e97da7a1f592cf1', TRUE),
('USR-006',  'cc.nipa',             'nipa@pmt.local',         'นิภา ใจดี',          'CONTACT_CENTER', '$2a$12$demo_eb9ce7382be5cb4bc5ba28ae47fa65e91bb4d4ae83236e7a27eb8451b66df21a', TRUE),
('USR-008',  'pakpoom',             'janpakpoom@chg.co.th',   'Pakpoom janset',     'ADMIN',          '$2a$12$demo_cde8e4a47f23c10d7bf534ee4e7e44deec259e99b279d7bade9649029b8cad53', TRUE)
ON CONFLICT (username) DO NOTHING;

-- 6.4 MA Checklist Templates Seeds
INSERT INTO ma_checklist_templates (id, service_type, template_name, checklist_items) VALUES
('TPL-AC-CLEAN', 'ล้างแอร์ / บำรุงรักษาระบบปรับอากาศ', 'แบบตรวจสอบมาตรฐานการบำรุงรักษาเครื่องปรับอากาศ', '[
  "ตรวจเช็คแรงดันน้ำยาแอร์ R32/R410A",
  "ล้างทำความสะอาดแผ่นกรองฝุ่นและคอยล์เย็น",
  "ล้างทำความสะอาดคอยล์ร้อนและพัดลมระบายความร้อน",
  "ตรวจสอบระบบท่อน้ำทิ้งและปั๊มเดรน",
  "วัดค่ากระแสไฟฟ้าและแรงดันไฟฟ้าของคอมเพรสเซอร์",
  "ตรวจเช็คจุดเชื่อมต่อสายไฟฟ้าและสายดิน"
]'::jsonb),
('TPL-SOLAR-MA', 'โซลาร์เซลล์ / Solar Rooftop Maintenance', 'แบบตรวจสอบระบบโซลาร์เซลล์ประจำรอบ', '[
  "ล้างทำความสะอาดคราบฝุ่นบนแผง Solar Panels",
  "ตรวจสอบสภาพ Inverter และสถานะการเชื่อมต่อ Grid",
  "วัดค่า Insulation Resistance ของสายเคเบิล DC",
  "ตรวจเช็คจุดต่อ MC4 Connectors และโครงสร้างยึด Mounting",
  "ตรวจสอบประสิทธิภาพการผลิตไฟฟ้าเปรียบเทียบกับมาตรฐาน",
  "ตรวจสอบระบบ Surge Protection และกราวด์ดิน"
]'::jsonb),
('TPL-PUMP-WATER', 'ระบบปั๊มน้ำและสุขาภิบาล', 'แบบตรวจสอบระบบปั๊มน้ำและถังเก็บน้ำประจำรอบ', '[
  "ตรวจเช็คแรงดันเปิด-ปิดของ Pressure Switch",
  "ตรวจสอบการรั่วซึมของซีลยางและข้อต่อท่อ PPR/PVC",
  "ตรวจเช็คระบบวาล์วบายพาสและเช็ควาล์ว",
  "ตรวจสอบเสียงและการสั่นสะเทือนผิดปกติของมอเตอร์",
  "ล้างทำความสะอาดไส้กรองและถังดักตะกอน",
  "ทดสอบระบบไฟและเบรกเกอร์ตัดไฟรั่ว ELCB/RCBO"
]'::jsonb)
ON CONFLICT (id) DO NOTHING;
