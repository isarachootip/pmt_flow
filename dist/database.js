"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LEAN_JOB_COLUMNS = exports.isDatabaseConnected = exports.pool = void 0;
exports.initDatabase = initDatabase;
exports.dbLoadUsers = dbLoadUsers;
exports.dbGetUser = dbGetUser;
exports.dbSaveUser = dbSaveUser;
exports.dbUpdateUser = dbUpdateUser;
exports.dbDeleteUser = dbDeleteUser;
exports.dbSaveLoginLog = dbSaveLoginLog;
exports.dbLoadLoginLogs = dbLoadLoginLogs;
exports.mapDbJobRow = mapDbJobRow;
exports.dbGetJobMetrics = dbGetJobMetrics;
exports.dbLoadJobsPaginated = dbLoadJobsPaginated;
exports.dbLoadJobs = dbLoadJobs;
exports.dbGetJob = dbGetJob;
exports.dbSaveJob = dbSaveJob;
exports.dbUpdateJob = dbUpdateJob;
exports.dbSaveAuditLog = dbSaveAuditLog;
exports.dbLoadAuditLogs = dbLoadAuditLogs;
exports.dbGetJobByBookingNo = dbGetJobByBookingNo;
exports.dbSaveStkSyncLog = dbSaveStkSyncLog;
exports.dbUpdateStkSyncLog = dbUpdateStkSyncLog;
exports.dbGetStkSyncLog = dbGetStkSyncLog;
exports.dbGetStkSyncLogByIdempotencyKey = dbGetStkSyncLogByIdempotencyKey;
exports.dbLoadStkSyncLogs = dbLoadStkSyncLogs;
exports.dbDeleteJob = dbDeleteJob;
exports.dbResetJobStatus = dbResetJobStatus;
exports.dbWipeAllTransactions = dbWipeAllTransactions;
exports.dbSeedMockJobs = dbSeedMockJobs;
exports.dbLoadDailyWorkLogs = dbLoadDailyWorkLogs;
exports.dbSaveDailyWorkLog = dbSaveDailyWorkLog;
exports.dbDeleteDailyWorkLog = dbDeleteDailyWorkLog;
exports.dbLoadQCBookings = dbLoadQCBookings;
exports.dbSaveQCBooking = dbSaveQCBooking;
exports.dbDeleteQCBookingByTask = dbDeleteQCBookingByTask;
exports.dbConfirmQCBooking = dbConfirmQCBooking;
exports.dbRevertQCBooking = dbRevertQCBooking;
exports.dbLoadMAContracts = dbLoadMAContracts;
exports.dbGetMAContract = dbGetMAContract;
exports.dbSaveMAContract = dbSaveMAContract;
exports.dbDeleteMAContract = dbDeleteMAContract;
exports.dbLoadMARounds = dbLoadMARounds;
exports.dbSaveMARound = dbSaveMARound;
exports.dbUpdateMARound = dbUpdateMARound;
exports.dbSaveApiLog = dbSaveApiLog;
exports.dbLoadApiLogs = dbLoadApiLogs;
exports.dbDeleteApiLogs = dbDeleteApiLogs;
exports.dbSaveStagingReport = dbSaveStagingReport;
exports.dbLoadStagingReports = dbLoadStagingReports;
exports.dbGetStagingReport = dbGetStagingReport;
exports.dbUpdateStagingReport = dbUpdateStagingReport;
exports.dbLoadBlueprints = dbLoadBlueprints;
exports.dbSaveBlueprint = dbSaveBlueprint;
exports.dbUpdateBlueprint = dbUpdateBlueprint;
exports.dbDeleteBlueprint = dbDeleteBlueprint;
exports.dbLoadTickets = dbLoadTickets;
exports.dbSaveTicket = dbSaveTicket;
exports.dbUpdateTicket = dbUpdateTicket;
exports.dbDeleteTicket = dbDeleteTicket;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// PostgreSQL Connection Pool
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:EsQShpeaGvSr21I5ieQGJRmCELp78GSlQn6hQHAIjbTnY4c1aWw56JleGierEk2t@187.77.147.16:5432/spmt_db';
exports.pool = new pg_1.Pool({
    connectionString,
    ssl: false,
    max: 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});
exports.pool.on('error', (err) => {
    console.error('[DB POOL ERROR] Unexpected client error:', err.message);
});
exports.isDatabaseConnected = false;
// Check and Initialize Database Tables
async function initDatabase() {
    try {
        const client = await exports.pool.connect();
        exports.isDatabaseConnected = true;
        console.log('[DB] Connected to PostgreSQL successfully at spmt_db!');
        // 1. Ensure core tables exist
        await client.query(`
      CREATE TABLE IF NOT EXISTS sys_users (
        id BIGSERIAL PRIMARY KEY,
        user_code VARCHAR(20) UNIQUE NOT NULL,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE,
        full_name VARCHAR(150) NOT NULL,
        role VARCHAR(50) NOT NULL DEFAULT 'AE',
        password_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sys_user_sessions (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        token_hash VARCHAR(255) NOT NULL UNIQUE,
        ip_address VARCHAR(45),
        user_agent TEXT,
        expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
        revoked_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sys_login_log (
        id BIGSERIAL PRIMARY KEY,
        username VARCHAR(50) NOT NULL,
        user_id BIGINT,
        success BOOLEAN NOT NULL,
        ip_address VARCHAR(45),
        user_agent TEXT,
        fail_reason VARCHAR(100),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS core_jobs (
        id SERIAL PRIMARY KEY,
        job_no VARCHAR(50) UNIQUE NOT NULL,
        external_ref_id VARCHAR(100),
        booking_no VARCHAR(100),
        ticket_no VARCHAR(100),
        customer_id BIGINT,
        customer_name VARCHAR(150),
        customer_phone VARCHAR(50),
        customer_address TEXT,
        status VARCHAR(50) NOT NULL DEFAULT 'NEW',
        job_type VARCHAR(50) DEFAULT 'Q',
        step_timestamps JSONB DEFAULT '{}'::jsonb,
        property_type VARCHAR(50),
        project_type VARCHAR(100),
        project_sub_type VARCHAR(100),
        store_code VARCHAR(50),
        agent_name VARCHAR(150),
        assigned_tech VARCHAR(150),
        plan_date VARCHAR(50),
        services JSONB DEFAULT '[]'::jsonb,
        overall_progress INT DEFAULT 0,
        special_instructions TEXT,
        additional_notes TEXT,
        customer_data JSONB DEFAULT '{}'::jsonb,
        tasks JSONB DEFAULT '[]'::jsonb,
        photos JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS core_daily_work_logs (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64) NOT NULL,
        job_no VARCHAR(50),
        task_id VARCHAR(64) NOT NULL,
        task_name VARCHAR(255),
        log_date VARCHAR(20) NOT NULL,
        start_time VARCHAR(10),
        end_time VARCHAR(10),
        work_hours VARCHAR(20),
        day_number INT,
        total_days INT,
        technician VARCHAR(150),
        recorded_by VARCHAR(150),
        reporter_role VARCHAR(20),
        progress_percent INT DEFAULT 0,
        work_description TEXT,
        issues_encountered TEXT,
        solutions_applied TEXT,
        materials_used TEXT,
        photos JSONB DEFAULT '[]'::jsonb,
        is_final_day BOOLEAN DEFAULT FALSE,
        supervisor_approved BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS core_qc_bookings (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(64) NOT NULL,
        job_no VARCHAR(50),
        customer_name VARCHAR(150),
        booking_date VARCHAR(20) NOT NULL,
        time_slot VARCHAR(50),
        technician_name VARCHAR(150),
        qc_inspector VARCHAR(150),
        status VARCHAR(30) DEFAULT 'PENDING',
        checklist JSONB DEFAULT '[]'::jsonb,
        notes TEXT,
        photos JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS inbound_api_logs (
        id VARCHAR(64) PRIMARY KEY,
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        method VARCHAR(10),
        path TEXT,
        ip VARCHAR(45),
        status INT,
        duration_ms INT,
        headers JSONB,
        body JSONB,
        response_body JSONB
      );

      CREATE TABLE IF NOT EXISTS staging_survey_reports (
        id BIGINT PRIMARY KEY,
        source_job_id VARCHAR(100),
        job_number VARCHAR(50),
        booking_no VARCHAR(100),
        ticket_no VARCHAR(100),
        source_reference VARCHAR(100),
        customer_code VARCHAR(100),
        customer_name VARCHAR(200),
        customer_phone VARCHAR(50),
        store_code VARCHAR(50),
        agent_code VARCHAR(50),
        visit_date VARCHAR(50),
        checkin_at VARCHAR(50),
        checkout_at VARCHAR(50),
        photo_count INT DEFAULT 0,
        raw_payload JSONB DEFAULT '{}'::jsonb,
        process_status VARCHAR(50) DEFAULT 'PENDING',
        converted_job_id BIGINT,
        retry_count INT DEFAULT 0,
        validation_errors JSONB DEFAULT '[]'::jsonb,
        error_message TEXT,
        received_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        processed_at TIMESTAMP WITH TIME ZONE
      );

      CREATE TABLE IF NOT EXISTS ma_contracts (
        id VARCHAR(64) PRIMARY KEY,
        contract_no VARCHAR(50) UNIQUE NOT NULL,
        customer_id BIGINT,
        customer_site_id BIGINT,
        customer_name VARCHAR(150),
        customer_phone VARCHAR(50),
        site_name VARCHAR(150),
        site_address TEXT,
        service_type VARCHAR(100) NOT NULL,
        service_items JSONB DEFAULT '[]'::jsonb,
        frequency_months INT NOT NULL DEFAULT 3,
        total_rounds INT NOT NULL DEFAULT 4,
        contract_start_date DATE NOT NULL,
        contract_end_date DATE,
        contract_value NUMERIC(14,2) DEFAULT 0.00,
        status VARCHAR(50) DEFAULT 'Active',
        notes TEXT,
        created_by VARCHAR(64),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ma_rounds (
        id VARCHAR(64) PRIMARY KEY,
        contract_id VARCHAR(64) NOT NULL,
        project_id BIGINT,
        round_number INT NOT NULL,
        scheduled_date DATE NOT NULL,
        actual_date DATE,
        status VARCHAR(50) DEFAULT 'Scheduled',
        technician_id BIGINT,
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS ma_checklist_templates (
        id VARCHAR(64) PRIMARY KEY,
        service_type VARCHAR(100) NOT NULL,
        template_name VARCHAR(200) NOT NULL,
        checklist_items JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS core_blueprints (
        id VARCHAR(64) PRIMARY KEY,
        job_id VARCHAR(50) NOT NULL,
        customer_name VARCHAR(150),
        file_name VARCHAR(255) NOT NULL,
        zone VARCHAR(100),
        room_zone VARCHAR(100),
        version VARCHAR(50) NOT NULL,
        file_size VARCHAR(50),
        file_type VARCHAR(20),
        notes TEXT,
        preview_img TEXT,
        version_history JSONB DEFAULT '[]'::jsonb,
        uploaded_at VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS core_tickets (
        id VARCHAR(64) PRIMARY KEY,
        ticket_no VARCHAR(100) UNIQUE NOT NULL,
        receipt_no VARCHAR(100),
        contract_no VARCHAR(100),
        job_id VARCHAR(50) NOT NULL,
        customer_name VARCHAR(150),
        service VARCHAR(100),
        amount NUMERIC(14,2) DEFAULT 0.00,
        payment_date VARCHAR(50),
        payment_method VARCHAR(50),
        slip_url TEXT,
        slip_name VARCHAR(255),
        contract_url TEXT,
        contract_name VARCHAR(255),
        status VARCHAR(50) DEFAULT 'VERIFIED',
        notes TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      CREATE SEQUENCE IF NOT EXISTS core_audit_logs_id_seq;
      CREATE TABLE IF NOT EXISTS core_audit_logs (
        id BIGINT PRIMARY KEY DEFAULT nextval('core_audit_logs_id_seq'),
        timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        user_id BIGINT,
        username VARCHAR(50),
        full_name VARCHAR(150),
        role VARCHAR(50),
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id VARCHAR(100) NOT NULL,
        booking_no VARCHAR(100),
        old_values JSONB DEFAULT '{}'::jsonb,
        new_values JSONB DEFAULT '{}'::jsonb,
        metadata JSONB DEFAULT '{}'::jsonb
      );

      CREATE SEQUENCE IF NOT EXISTS stk_sync_logs_id_seq;
      CREATE TABLE IF NOT EXISTS stk_sync_logs (
        id BIGINT PRIMARY KEY DEFAULT nextval('stk_sync_logs_id_seq'),
        idempotency_key VARCHAR(255) UNIQUE NOT NULL,
        booking_no VARCHAR(100) NOT NULL,
        job_type VARCHAR(20) NOT NULL,
        area_id VARCHAR(100),
        area_name VARCHAR(255),
        task_id VARCHAR(100),
        task_name VARCHAR(255),
        assigned_tech VARCHAR(150),
        assigned_qc VARCHAR(150),
        final_score INT NOT NULL,
        rework_count INT DEFAULT 0,
        status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        payload JSONB NOT NULL DEFAULT '{}'::jsonb,
        response_body JSONB,
        retry_count INT DEFAULT 0,
        max_retries INT DEFAULT 3,
        last_error TEXT,
        last_attempt_at TIMESTAMP WITH TIME ZONE,
        sent_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE core_jobs 
        ALTER COLUMN customer_id TYPE BIGINT,
        ALTER COLUMN project_sub_type TYPE TEXT,
        ALTER COLUMN project_type TYPE TEXT,
        ALTER COLUMN property_type TYPE TEXT,
        ADD COLUMN IF NOT EXISTS boq_items JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS boq_discount NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS boq_subtotal NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS boq_grand_total NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS boq_original_file JSONB DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS pmt_accepted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS pmt_accepted_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS step3_confirmed BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS qc_inspection_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS qc_passed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS qc_score NUMERIC DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS csat_score NUMERIC DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS csat_remarks TEXT,
        ADD COLUMN IF NOT EXISTS csat_photos JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS csat_surveyor VARCHAR(150),
        ADD COLUMN IF NOT EXISTS csat_evaluated_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS job_details JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS agent_data JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS store_data JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS schedule_plan JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS checkin_data JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS checkout_data JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS approval_data JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS visit_results JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS remarks_data JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS customer_name VARCHAR(150),
        ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
        ADD COLUMN IF NOT EXISTS customer_address TEXT,
        ADD COLUMN IF NOT EXISTS qc_history JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS qc_subtasks JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS rework_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS qc_rework_count INT DEFAULT 0,
        ADD COLUMN IF NOT EXISTS has_rework BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS qc_remarks TEXT,
        ADD COLUMN IF NOT EXISTS qc_inspector VARCHAR(150),
        ADD COLUMN IF NOT EXISTS stk_ref VARCHAR(100),
        ADD COLUMN IF NOT EXISTS stk_status VARCHAR(50),
        ADD COLUMN IF NOT EXISTS stk_payload JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS stk_exported_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS raw_payload JSONB DEFAULT '{}'::jsonb,
        ADD COLUMN IF NOT EXISTS areas JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS qc_manual_questions JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS escalated_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS escalated_reason TEXT,
        ADD COLUMN IF NOT EXISTS boq_version INT DEFAULT 1,
        ADD COLUMN IF NOT EXISTS boq_revisions JSONB DEFAULT '[]'::jsonb;

      ALTER TABLE core_daily_work_logs
        ADD COLUMN IF NOT EXISTS additional_details TEXT,
        ADD COLUMN IF NOT EXISTS is_completed BOOLEAN DEFAULT FALSE;

      ALTER TABLE core_qc_bookings
        ADD COLUMN IF NOT EXISTS task_id VARCHAR(64),
        ADD COLUMN IF NOT EXISTS task_name VARCHAR(255),
        ADD COLUMN IF NOT EXISTS plan_start_date VARCHAR(20),
        ADD COLUMN IF NOT EXISTS plan_end_date VARCHAR(20),
        ADD COLUMN IF NOT EXISTS qc_booking_date VARCHAR(20),
        ADD COLUMN IF NOT EXISTS days_before INT DEFAULT 5,
        ADD COLUMN IF NOT EXISTS assigned_tech VARCHAR(150),
        ADD COLUMN IF NOT EXISTS assigned_qc_tech VARCHAR(150),
        ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS confirmed_by VARCHAR(150),
        ADD COLUMN IF NOT EXISTS remarks TEXT;

      -- Backfill customer columns if null
      UPDATE core_jobs 
      SET 
        customer_name = COALESCE(NULLIF(customer_name, ''), customer_data->>'name', customer_data->>'first_name', 'ลูกค้าทั่วไป'),
        customer_phone = COALESCE(NULLIF(customer_phone, ''), customer_data->>'phone', customer_data->>'mobile_no', ''),
        customer_address = COALESCE(NULLIF(customer_address, ''), customer_data->>'address', customer_data->'location'->>'address', '')
      WHERE customer_name IS NULL OR customer_phone IS NULL OR customer_address IS NULL;

      -- Backfill intake photos if null or empty for both Q and R jobs so QC always has original intake photos
      UPDATE core_jobs
      SET photos = '[
        {"id":"photo_seed_before","slot_id":"before","tag":"before","phase":"BEFORE","label":"1. ก่อนเริ่มงาน (Before)","url":"https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80","source":"INTAKE"},
        {"id":"photo_seed_progress1","slot_id":"progress1","tag":"progress1","phase":"DURING_1","label":"2. ระหว่างทำ #1 (During 1)","url":"https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80","source":"INTAKE"},
        {"id":"photo_seed_progress2","slot_id":"progress2","tag":"progress2","phase":"DURING_2","label":"3. ระหว่างทำ #2 (During 2)","url":"https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80","source":"INTAKE"},
        {"id":"photo_seed_test","slot_id":"test","tag":"test","phase":"TESTING","label":"4. ทดสอบความปลอดภัย (Testing)","url":"https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80","source":"INTAKE"},
        {"id":"photo_seed_after","slot_id":"after","tag":"after","phase":"AFTER","label":"5. งานเสร็จสมบูรณ์ (After)","url":"https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80","source":"INTAKE"}
      ]'::jsonb
      WHERE photos IS NULL OR jsonb_typeof(photos) != 'array' OR jsonb_array_length(photos) = 0;

      -- High-frequency query indexes on core_jobs
      CREATE INDEX IF NOT EXISTS idx_core_jobs_status          ON core_jobs(status);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_created_at      ON core_jobs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_job_no          ON core_jobs(job_no);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_external_ref_id ON core_jobs(external_ref_id);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_booking_no      ON core_jobs(booking_no);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_ticket_no       ON core_jobs(ticket_no);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_plan_date       ON core_jobs(plan_date);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_customer_name   ON core_jobs(customer_name);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_customer_phone  ON core_jobs(customer_phone);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_job_type        ON core_jobs(job_type);
      CREATE INDEX IF NOT EXISTS idx_core_jobs_lower_status    ON core_jobs(LOWER(status));
      CREATE INDEX IF NOT EXISTS idx_core_jobs_lower_job_type  ON core_jobs(LOWER(job_type));
      CREATE INDEX IF NOT EXISTS idx_core_jobs_created_id      ON core_jobs(created_at DESC, id DESC);
      CREATE INDEX IF NOT EXISTS idx_core_blueprints_job_id    ON core_blueprints(job_id);
      CREATE INDEX IF NOT EXISTS idx_core_tickets_job_id       ON core_tickets(job_id);
      CREATE INDEX IF NOT EXISTS idx_audit_booking             ON core_audit_logs(booking_no);
      CREATE INDEX IF NOT EXISTS idx_audit_entity              ON core_audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_audit_time                ON core_audit_logs(timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_action              ON core_audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_stk_sync_booking          ON stk_sync_logs(booking_no);
      CREATE INDEX IF NOT EXISTS idx_stk_sync_status           ON stk_sync_logs(status);
      CREATE INDEX IF NOT EXISTS idx_stk_sync_key              ON stk_sync_logs(idempotency_key);
    `);
        // 2. Ensure default users exist in sys_users
        await client.query(`
      INSERT INTO sys_users (user_code, username, email, full_name, role, password_hash, is_active)
      VALUES 
        ('USR-001B', 'isarachootip@gmail.com', 'isarachootip@gmail.com', 'Isara Chootip', 'ADMIN', '$2a$12$demo_df4740268cae8dd415b3c396825c0ff1800f16f0b48db929c426639bcf469bfd', true)
      ON CONFLICT (username) DO NOTHING;
    `);
        // 3. Ensure unaccepted jobs strictly have empty Gantt tasks and areas in DB
        await client.query(`
      UPDATE core_jobs 
      SET tasks = '[]'::jsonb, areas = '[]'::jsonb 
      WHERE UPPER(status) IN ('NEW', 'NEED_REVIEW', 'DRAFT', 'SURVEYED', 'NEW_ORDER') 
         OR (pmt_accepted IS FALSE OR pmt_accepted IS NULL);
    `);
        // 4. Auto-seed mock data if core_jobs table is empty
        const countCheck = await client.query('SELECT COUNT(*)::int AS count FROM core_jobs');
        const existingCount = countCheck.rows[0]?.count || 0;
        client.release();
        console.log('[DB] Core tables verified / created in spmt_db.');
        if (existingCount === 0) {
            console.log('[DB AUTO-SEED] core_jobs table is empty. Auto-seeding initial jobs...');
            await dbSeedMockJobs();
        }
        return true;
    }
    catch (err) {
        console.error('[DB FATAL] Could not initialize PostgreSQL tables:', err.message);
        exports.isDatabaseConnected = false;
        throw err; // DB is mandatory - server must not start without it
    }
}
// =============================================================================
// USERS & AUTH DB REPOSITORY
// =============================================================================
async function dbLoadUsers() {
    try {
        const res = await exports.pool.query('SELECT * FROM sys_users ORDER BY id ASC');
        return res.rows;
    }
    catch (err) {
        console.error('[DB] Error loading users:', err.message);
        return [];
    }
}
async function dbGetUser(usernameOrEmail) {
    try {
        const res = await exports.pool.query('SELECT * FROM sys_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1', [usernameOrEmail]);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB] Error getting user:', err.message);
        return null;
    }
}
async function dbSaveUser(user) {
    try {
        await exports.pool.query(`INSERT INTO sys_users (user_code, username, email, full_name, role, password_hash, is_active, last_login_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (username) DO UPDATE SET
         user_code = EXCLUDED.user_code,
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         is_active = EXCLUDED.is_active,
         last_login_at = EXCLUDED.last_login_at,
         updated_at = CURRENT_TIMESTAMP`, [
            user.user_code,
            user.username,
            user.email || null,
            user.full_name,
            user.role,
            user.password_hash,
            user.is_active ?? true,
            user.last_login_at ? new Date(user.last_login_at) : null,
            user.created_at ? new Date(user.created_at) : new Date(),
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving user:', err.message);
    }
}
async function dbUpdateUser(id, fields) {
    try {
        const setClauses = [];
        const values = [];
        let idx = 1;
        for (const [key, val] of Object.entries(fields)) {
            if (['full_name', 'email', 'role', 'is_active', 'password_hash', 'last_login_at'].includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(key === 'last_login_at' && val ? new Date(val) : val);
            }
        }
        if (setClauses.length === 0)
            return;
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await exports.pool.query(`UPDATE sys_users SET ${setClauses.join(', ')} WHERE id::text = $${idx} OR user_code = $${idx}`, values);
    }
    catch (err) {
        console.error('[DB] Error updating user:', err.message);
    }
}
async function dbDeleteUser(id) {
    try {
        await exports.pool.query('DELETE FROM sys_users WHERE id::text = $1 OR user_code = $1', [String(id)]);
    }
    catch (err) {
        console.error('[DB] Error deleting user:', err.message);
    }
}
async function dbSaveLoginLog(log) {
    try {
        await exports.pool.query(`INSERT INTO sys_login_log (username, user_id, success, ip_address, fail_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`, [
            log.username,
            log.user_id ? Number(log.user_id) : null,
            log.success,
            log.ip_address || null,
            log.fail_reason || null,
            log.created_at ? new Date(log.created_at) : new Date(),
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving login log:', err.message);
    }
}
async function dbLoadLoginLogs(limit = 100) {
    try {
        const res = await exports.pool.query('SELECT * FROM sys_login_log ORDER BY created_at DESC LIMIT $1', [limit]);
        return res.rows;
    }
    catch (err) {
        console.error('[DB] Error loading login logs:', err.message);
        return [];
    }
}
// =============================================================================
// JOBS & PROJECTS DB REPOSITORY
// =============================================================================
function mapDbJobRow(row) {
    if (!row)
        return null;
    const cust = row.customer_data || {};
    let customerFullName = 'ไม่ระบุชื่อ';
    if (cust) {
        if (cust.name) {
            customerFullName = cust.name;
        }
        else if (cust.first_name || cust.last_name) {
            customerFullName = `คุณ${cust.first_name || ''} ${cust.last_name || ''}`.trim();
        }
    }
    const primaryService = (row.project_sub_type && row.project_sub_type.trim() && row.project_sub_type !== 'งานบริการ' ? row.project_sub_type.trim() : null) || (Array.isArray(row.services) && row.services[0]) || row.project_sub_type || 'งานติดตั้ง';
    return {
        ...row,
        id: row.job_no || `JOB-${row.id}`,
        jobId: row.id,
        job_no: row.job_no,
        external_ref_id: row.external_ref_id,
        booking_no: row.booking_no,
        vfix_no: row.booking_no,
        ticket_no: row.ticket_no,
        customer: row.customer_name || customerFullName,
        customer_name: row.customer_name || customerFullName,
        customer_phone: row.customer_phone || cust.phone || cust.mobile_no || (row.raw_payload?.customer?.phone) || '',
        customer_address: row.customer_address || cust.address || (cust.location?.address) || (row.raw_payload?.customer?.address) || '',
        customer_data: cust,
        firstName: cust.first_name || ((row.customer_name || customerFullName).replace(/^คุณ/, '').trim().split(' ')[0] || ''),
        lastName: cust.last_name || ((row.customer_name || customerFullName).replace(/^คุณ/, '').trim().split(' ').slice(1).join(' ') || ''),
        phone: row.customer_phone || cust.phone || cust.mobile_no || (row.raw_payload?.customer?.phone) || '',
        address: row.customer_address || cust.address || (cust.location?.address) || (row.raw_payload?.customer?.address) || '',
        lat: cust.lat || (cust.location?.latitude) || 13.7563,
        lng: cust.lng || (cust.location?.longitude) || 100.5018,
        google_map_url: cust.google_map_url || (cust.location?.google_map_url) || (row.raw_payload?.customer?.google_map_url) || '',
        branch_name: row.raw_payload?.branch?.name || row.store_data?.name || (row.store?.name) || '',
        branch_code: row.raw_payload?.branch?.code3 || row.store_code || '',
        service: primaryService,
        services: Array.isArray(row.services) && row.services.length > 0 ? row.services : [primaryService],
        project_sub_type: row.project_sub_type || primaryService,
        store_code: row.store_code || (row.store_data?.code) || (row.raw_payload?.branch?.store_code) || '',
        agent_name: row.agent_name || (row.agent_data?.name) || '',
        job_details: Array.isArray(row.job_details) && row.job_details.length > 0 ? row.job_details : (Array.isArray(row.job_detail) && row.job_detail.length > 0 ? row.job_detail : (Array.isArray(row.raw_payload?.jobdetails) ? row.raw_payload.jobdetails : [])),
        job_detail: Array.isArray(row.job_details) && row.job_details.length > 0 ? row.job_details : (Array.isArray(row.job_detail) && row.job_detail.length > 0 ? row.job_detail : (Array.isArray(row.raw_payload?.jobdetails) ? row.raw_payload.jobdetails : [])),
        agent: row.agent_data || { name: row.agent_name },
        store: row.store_data || { code: row.store_code, name: row.raw_payload?.branch?.name },
        schedule_plan: row.schedule_plan || {},
        check_in: row.checkin_data || {},
        check_out: row.checkout_data || {},
        approval: row.approval_data || {},
        visit_results: Array.isArray(row.visit_results) ? row.visit_results : (Array.isArray(row.visit_result) ? row.visit_result : []),
        visit_result: Array.isArray(row.visit_results) ? row.visit_results : (Array.isArray(row.visit_result) ? row.visit_result : []),
        remarks_data: row.remarks_data || row.remarks || { comment: row.special_instructions, note: row.additional_notes },
        remarks: row.remarks_data || row.remarks || { comment: row.special_instructions, note: row.additional_notes },
        file_int_image: row.file_int_image || '',
        raw_payload: row.raw_payload || {},
        status: row.status || 'NEW',
        plan_date: row.plan_date || (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-09-08'),
        date: row.plan_date || (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-09-08'),
        progress: row.overall_progress || 0,
        tech: row.assigned_tech || 'Team A (สมศักดิ์)',
        special_instructions: row.special_instructions || '',
        additional_notes: row.additional_notes || '',
        photos: Array.isArray(row.photos) ? row.photos : [],
        photo_count: row.photo_count !== undefined ? Number(row.photo_count) : (Array.isArray(row.photos) ? row.photos.length : 0),
        tasks: Array.isArray(row.tasks) ? row.tasks : [],
        task_count: row.task_count !== undefined ? Number(row.task_count) : (Array.isArray(row.tasks) ? row.tasks.length : 0),
        boq_items: Array.isArray(row.boq_items) ? row.boq_items : [],
        boq_count: row.boq_count !== undefined ? Number(row.boq_count) : (Array.isArray(row.boq_items) ? row.boq_items.length : 0),
        boq_discount: Number(row.boq_discount) || 0,
        boq_subtotal: Number(row.boq_subtotal) || 0,
        boq_grand_total: Number(row.boq_grand_total) || 0,
        boq_original_file: row.boq_original_file || row.raw_payload?.boq_original_file || null,
        boq_version: Number(row.boq_version) || 1,
        boq_revisions: Array.isArray(row.boq_revisions) ? row.boq_revisions : (Array.isArray(row.raw_payload?.boq_revisions) ? row.raw_payload.boq_revisions : []),
        pmt_accepted: row.pmt_accepted !== undefined && row.pmt_accepted !== null ? Boolean(row.pmt_accepted) : (row.status !== 'DRAFT' && row.status !== 'NEW' && row.status !== 'SURVEYED' && row.status !== 'Survey'),
        pmt_accepted_at: row.pmt_accepted_at || null,
        step3_confirmed: Boolean(row.step3_confirmed),
        qc_inspection_type: row.qc_inspection_type || null,
        qc_passed_at: row.qc_passed_at || null,
        qc_score: row.qc_score !== null && row.qc_score !== undefined ? Number(row.qc_score) : null,
        qc_history: Array.isArray(row.qc_history) ? row.qc_history : (Array.isArray(row.raw_payload?.qc_history) ? row.raw_payload.qc_history : []),
        qc_subtasks: Array.isArray(row.qc_subtasks) ? row.qc_subtasks : (Array.isArray(row.raw_payload?.qc_subtasks) ? row.raw_payload.qc_subtasks : []),
        rework_count: row.rework_count !== undefined && row.rework_count !== null ? Number(row.rework_count) : (Number(row.raw_payload?.rework_count) || 0),
        qc_rework_count: row.qc_rework_count !== undefined && row.qc_rework_count !== null ? Number(row.qc_rework_count) : (Number(row.raw_payload?.qc_rework_count) || 0),
        has_rework: Boolean(row.has_rework || row.raw_payload?.has_rework),
        qc_remarks: row.qc_remarks || row.raw_payload?.qc_remarks || '',
        qc_inspector: row.qc_inspector || row.raw_payload?.qc_inspector || '',
        csat_score: row.csat_score !== null && row.csat_score !== undefined ? Number(row.csat_score) : null,
        csat_remarks: row.csat_remarks || '',
        csat_photos: Array.isArray(row.csat_photos) ? row.csat_photos : [],
        csat_surveyor: row.csat_surveyor || '',
        csat_evaluated_at: row.csat_evaluated_at || null,
        stk_ref: row.stk_ref || row.raw_payload?.stk_ref || '',
        stk_status: row.stk_status || row.raw_payload?.stk_status || '',
        stk_payload: row.stk_payload || row.raw_payload?.stk_payload || null,
        stk_exported_at: row.stk_exported_at || row.raw_payload?.stk_exported_at || null,
        areas: Array.isArray(row.areas) ? row.areas : (Array.isArray(row.raw_payload?.areas) ? row.raw_payload.areas : []),
        qc_manual_questions: Array.isArray(row.qc_manual_questions) ? row.qc_manual_questions : (Array.isArray(row.raw_payload?.qc_manual_questions) ? row.raw_payload.qc_manual_questions : []),
        escalated_at: row.escalated_at || row.raw_payload?.escalated_at || null,
        escalated_reason: row.escalated_reason || row.raw_payload?.escalated_reason || '',
        job_type: row.job_type || 'quick',
        step_timestamps: row.step_timestamps || {},
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
}
exports.LEAN_JOB_COLUMNS = `
  id,
  job_no,
  external_ref_id,
  booking_no,
  ticket_no,
  customer_id,
  customer_name,
  customer_phone,
  customer_address,
  status,
  job_type,
  step_timestamps,
  property_type,
  project_type,
  project_sub_type,
  store_code,
  agent_name,
  assigned_tech,
  plan_date,
  services,
  overall_progress,
  special_instructions,
  additional_notes,
  boq_discount,
  boq_subtotal,
  boq_grand_total,
  pmt_accepted,
  pmt_accepted_at,
  step3_confirmed,
  qc_inspection_type,
  qc_passed_at,
  qc_score,
  qc_history,
  qc_subtasks,
  rework_count,
  qc_rework_count,
  has_rework,
  qc_remarks,
  qc_inspector,
  csat_score,
  csat_remarks,
  csat_surveyor,
  csat_evaluated_at,
  stk_ref,
  stk_status,
  stk_payload,
  stk_exported_at,
  areas,
  qc_manual_questions,
  escalated_at,
  escalated_reason,
  customer_data,
  job_details,
  store_data,
  remarks_data,
  raw_payload,
  created_at,
  updated_at,
  CASE 
    WHEN photos IS NOT NULL AND jsonb_typeof(photos) = 'array' THEN jsonb_array_length(photos)
    ELSE 0 
  END AS photo_count,
  CASE 
    WHEN boq_items IS NOT NULL AND jsonb_typeof(boq_items) = 'array' THEN jsonb_array_length(boq_items)
    ELSE 0 
  END AS boq_count,
  CASE 
    WHEN tasks IS NOT NULL AND jsonb_typeof(tasks) = 'array' THEN jsonb_array_length(tasks)
    ELSE 0 
  END AS task_count
`;
let cachedMetrics = null;
let cachedMetricsTime = 0;
async function dbGetJobMetrics() {
    const now = Date.now();
    if (cachedMetrics && (now - cachedMetricsTime < 15000)) {
        return cachedMetrics;
    }
    if (!exports.isDatabaseConnected) {
        return {
            total: 0,
            step1: 0,
            qc_pending: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0,
            quick: 0,
            renovate: 0,
            ma: 0,
            today: 0,
            qc_passed: 0,
            after_sale: 0
        };
    }
    try {
        const res = await exports.pool.query(`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('SURVEYED', 'DRAFT', 'NEW', 'NEW_ORDER', 'NEED_REVIEW') AND (pmt_accepted IS FALSE OR pmt_accepted IS NULL))::int AS step1,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('WAIT_QC', 'QC_PENDING', 'QC_INSPECTING', 'QC_REWORK', 'REWORK'))::int AS qc_pending,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('IN_PROGRESS', 'CONVERTED', 'PLANNED'))::int AS in_progress,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('COMPLETED', 'CLOSED', 'QC_PASSED', 'PASSED', 'AFTER_SALE'))::int AS completed,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('COMPLETED', 'QC_PASSED', 'PASSED'))::int AS qc_passed,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('AFTER_SALE', 'CLOSED'))::int AS after_sale,
        COUNT(*) FILTER (WHERE UPPER(status) IN ('CANCELLED', 'CLOSED_LOST'))::int AS cancelled,
        COUNT(*) FILTER (WHERE LOWER(job_type) = 'quick' OR LOWER(job_type) = 'q')::int AS quick,
        COUNT(*) FILTER (WHERE LOWER(job_type) = 'renovate' OR LOWER(job_type) = 'r')::int AS renovate,
        COUNT(*) FILTER (WHERE LOWER(job_type) = 'ma')::int AS ma,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE)::int AS today
      FROM core_jobs
    `);
        const row = res.rows[0] || {};
        const result = {
            total: Number(row.total) || 0,
            step1: Number(row.step1) || 0,
            qc_pending: Number(row.qc_pending) || 0,
            in_progress: Number(row.in_progress) || 0,
            completed: Number(row.completed) || 0,
            cancelled: Number(row.cancelled) || 0,
            quick: Number(row.quick) || 0,
            renovate: Number(row.renovate) || 0,
            ma: Number(row.ma) || 0,
            today: Number(row.today) || 0,
            qc_passed: Number(row.qc_passed) || 0,
            after_sale: Number(row.after_sale) || 0
        };
        cachedMetrics = result;
        cachedMetricsTime = Date.now();
        return result;
    }
    catch (err) {
        console.error('[DB] Error getting job metrics:', err.message);
        return {
            total: 0,
            step1: 0,
            qc_pending: 0,
            in_progress: 0,
            completed: 0,
            cancelled: 0,
            quick: 0,
            renovate: 0,
            ma: 0,
            today: 0,
            qc_passed: 0,
            after_sale: 0
        };
    }
}
async function dbLoadJobsPaginated(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const rawLimit = Number(options.limit) || 50;
    const limit = Math.min(100, Math.max(1, rawLimit));
    if (!exports.isDatabaseConnected) {
        return {
            jobs: [],
            total: 0,
            page,
            limit,
            totalPages: 1
        };
    }
    try {
        const whereClauses = [];
        const params = [];
        let paramIdx = 1;
        if (options.status && options.status !== 'all') {
            const rawStatus = options.status.trim();
            const st = rawStatus.toLowerCase();
            if (rawStatus.includes(',')) {
                const statuses = rawStatus.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                const placeholders = statuses.map(() => `$${paramIdx++}`).join(', ');
                const hasCompletedStatus = statuses.some(s => ['COMPLETED', 'CLOSED', 'CLOSEJOB', 'QC_PASS', 'QC_PASSED'].includes(s));
                if (hasCompletedStatus) {
                    whereClauses.push(`(UPPER(status) IN (${placeholders}) OR UPPER(COALESCE(stk_status, '')) = 'DELIVERED')`);
                }
                else {
                    whereClauses.push(`UPPER(status) IN (${placeholders})`);
                }
                params.push(...statuses);
            }
            else if (st === 'step1_queue') {
                whereClauses.push(`(UPPER(status) IN ('SURVEYED', 'DRAFT', 'NEW', 'NEW_ORDER', 'NEED_REVIEW') AND (pmt_accepted IS FALSE OR pmt_accepted IS NULL))`);
            }
            else if (st === 'transferred') {
                whereClauses.push(`(pmt_accepted IS TRUE OR UPPER(status) NOT IN ('SURVEYED', 'DRAFT', 'NEW', 'NEW_ORDER', 'NEED_REVIEW'))`);
            }
            else if (st === 'new') {
                whereClauses.push(`UPPER(status) IN ('NEW', 'NEED_REVIEW', 'DRAFT', 'NEW_ORDER')`);
            }
            else if (st === 'completed') {
                whereClauses.push(`(UPPER(status) IN ('COMPLETED', 'CLOSED', 'CLOSEJOB', 'QC_PASSED', 'QC_PASS', 'PASSED') OR UPPER(COALESCE(stk_status, '')) = 'DELIVERED')`);
            }
            else if (st === 'wait_qc' || st === 'qc') {
                whereClauses.push(`UPPER(status) IN ('WAIT_QC', 'QC_PENDING', 'QC_INSPECTING', 'QC_REWORK', 'REWORK')`);
            }
            else if (st === 'planned') {
                whereClauses.push(`UPPER(status) IN ('PLANNED', 'BOQ', 'DESIGN')`);
            }
            else if (st === 'assigned') {
                whereClauses.push(`(assigned_tech IS NOT NULL AND assigned_tech != '' AND assigned_tech != 'รอระบุช่าง' AND LOWER(status) NOT IN ('surveyed', 'cancelled', 'closed_lost') AND (pmt_accepted IS FALSE OR pmt_accepted IS NULL))`);
            }
            else if (st === 'surveyed') {
                whereClauses.push(`((LOWER(status) = 'surveyed' OR (step_timestamps->>'step1_survey_at') IS NOT NULL OR (photos IS NOT NULL AND jsonb_typeof(photos) = 'array' AND jsonb_array_length(photos) > 0)) AND (pmt_accepted IS FALSE OR pmt_accepted IS NULL))`);
            }
            else {
                whereClauses.push(`LOWER(status) = LOWER($${paramIdx++})`);
                params.push(options.status);
            }
        }
        if (options.step && options.step !== 'all') {
            const stp = options.step.toLowerCase();
            if (stp === 'step1') {
                whereClauses.push(`(UPPER(status) IN ('SURVEYED', 'DRAFT', 'NEW', 'NEW_ORDER', 'NEED_REVIEW') AND (pmt_accepted IS FALSE OR pmt_accepted IS NULL))`);
            }
            else if (stp === 'step2') {
                whereClauses.push(`(pmt_accepted IS TRUE AND UPPER(status) IN ('IN_PROGRESS', 'PENDING_TICKET', 'TICKET_ISSUED', 'DESIGNED', 'PLANNED'))`);
            }
            else if (stp === 'step4') {
                whereClauses.push(`(UPPER(status) IN ('IN_PROGRESS', 'INSTALLING', 'GANTT_ACTIVE'))`);
            }
            else if (stp === 'step5' || stp === 'qc') {
                whereClauses.push(`(UPPER(status) IN ('WAIT_QC', 'QC_PENDING', 'QC_INSPECTING', 'QC_REWORK', 'REWORK', 'QC_PASSED', 'QC_CONFIRMED', 'DRAFT_QC'))`);
            }
            else if (stp === 'step6' || stp === 'closed' || stp === 'completed') {
                whereClauses.push(`(UPPER(status) IN ('COMPLETED', 'CLOSED', 'CLOSEJOB', 'QC_PASSED', 'QC_PASS', 'PASSED') OR UPPER(COALESCE(stk_status, '')) = 'DELIVERED')`);
            }
            else if (stp === 'step7' || stp === 'ma') {
                whereClauses.push(`(UPPER(status) = 'AFTER_SALE' OR LOWER(job_type) = 'ma')`);
            }
        }
        if (options.service && options.service !== 'all') {
            const s = options.service.toLowerCase();
            if (s === 'quick' || s === 'q') {
                whereClauses.push(`(LOWER(job_type) = 'quick' OR LOWER(job_type) = 'q' OR services::text ILIKE '%quick%')`);
            }
            else if (s === 'renovate' || s === 'r') {
                whereClauses.push(`(LOWER(job_type) = 'renovate' OR LOWER(job_type) = 'r' OR services::text ILIKE '%renovate%' OR project_sub_type ILIKE '%renovate%')`);
            }
            else if (s === 'ma') {
                whereClauses.push(`(LOWER(job_type) = 'ma' OR services::text ILIKE '%ma%' OR project_sub_type ILIKE '%ma%')`);
            }
            else {
                whereClauses.push(`(project_sub_type = $${paramIdx} OR services::text ILIKE $${paramIdx + 1})`);
                params.push(options.service, `%${options.service}%`);
                paramIdx += 2;
            }
        }
        if (options.search && options.search.trim()) {
            const sanitized = options.search.trim().replace(/[%_\\]/g, '\\$&');
            const q = `%${sanitized}%`;
            whereClauses.push(`(
        job_no ILIKE $${paramIdx} OR
        external_ref_id ILIKE $${paramIdx} OR
        booking_no ILIKE $${paramIdx} OR
        ticket_no ILIKE $${paramIdx} OR
        customer_name ILIKE $${paramIdx} OR
        customer_phone ILIKE $${paramIdx} OR
        plan_date ILIKE $${paramIdx} OR
        assigned_tech ILIKE $${paramIdx} OR
        store_code ILIKE $${paramIdx} OR
        agent_name ILIKE $${paramIdx} OR
        project_sub_type ILIKE $${paramIdx}
      )`);
            params.push(q);
            paramIdx++;
        }
        if (options.plan_date_from) {
            whereClauses.push(`plan_date >= $${paramIdx++}`);
            params.push(options.plan_date_from);
        }
        if (options.plan_date_to) {
            whereClauses.push(`plan_date <= $${paramIdx++}`);
            params.push(options.plan_date_to);
        }
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        // 1. Fast count query using indexes
        const countSql = `SELECT COUNT(*)::int AS total FROM core_jobs ${whereSql}`;
        const countRes = await exports.pool.query(countSql, params);
        const total = Number(countRes.rows[0]?.total) || 0;
        const totalPages = Math.max(1, Math.ceil(total / limit));
        // 2. Fast lean list query using indexes
        const selectCols = options.lean === false ? '*' : exports.LEAN_JOB_COLUMNS;
        const offset = (page - 1) * limit;
        let orderBySql = 'ORDER BY created_at DESC, id DESC';
        const sortBy = options.sort_by;
        const sortOrder = (options.sort_order || '').toLowerCase();
        if (sortBy === 'plan_date' || ((options.plan_date_from || options.plan_date_to) && sortBy !== 'created_at')) {
            const dir = sortOrder === 'desc' ? 'DESC' : 'ASC';
            orderBySql = `ORDER BY plan_date ${dir} NULLS LAST, created_at DESC, id DESC`;
        }
        else if (sortBy === 'created_at') {
            const dir = sortOrder === 'asc' ? 'ASC' : 'DESC';
            orderBySql = `ORDER BY created_at ${dir}, id DESC`;
        }
        const querySql = `
      SELECT ${selectCols}
      FROM core_jobs
      ${whereSql}
      ${orderBySql}
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
        const rowsRes = await exports.pool.query(querySql, [...params, limit, offset]);
        const mapped = rowsRes.rows.map(mapDbJobRow);
        return {
            jobs: mapped,
            total,
            page,
            limit,
            totalPages
        };
    }
    catch (err) {
        console.error('[DB] Error in dbLoadJobsPaginated:', err.message);
        return {
            jobs: [],
            total: 0,
            page,
            limit,
            totalPages: 1
        };
    }
}
async function dbLoadJobs(filters) {
    if (filters && (filters.page !== undefined || filters.limit !== undefined)) {
        const paged = await dbLoadJobsPaginated(filters);
        return paged.jobs;
    }
    try {
        const whereClauses = [];
        const params = [];
        let paramIdx = 1;
        if (filters?.status && filters.status !== 'all') {
            const st = filters.status.toLowerCase();
            if (st === 'new') {
                whereClauses.push(`(LOWER(status) IN ('new', 'draft', 'new_order') AND (assigned_tech IS NULL OR assigned_tech = '' OR assigned_tech = 'รอระบุช่าง'))`);
            }
            else if (st === 'assigned') {
                whereClauses.push(`(assigned_tech IS NOT NULL AND assigned_tech != '' AND assigned_tech != 'รอระบุช่าง' AND LOWER(status) NOT IN ('surveyed', 'cancelled', 'closed_lost'))`);
            }
            else if (st === 'surveyed') {
                whereClauses.push(`(LOWER(status) = 'surveyed' OR (step_timestamps->>'step1_survey_at') IS NOT NULL OR (photos IS NOT NULL AND jsonb_typeof(photos) = 'array' AND jsonb_array_length(photos) > 0))`);
            }
            else {
                whereClauses.push(`LOWER(status) = LOWER($${paramIdx++})`);
                params.push(filters.status);
            }
        }
        if (filters?.service && filters.service !== 'all') {
            const s = filters.service.toLowerCase();
            if (s === 'quick') {
                whereClauses.push(`(LOWER(job_type) = 'quick' OR services::text ILIKE '%quick%')`);
            }
            else if (s === 'renovate') {
                whereClauses.push(`(LOWER(job_type) = 'renovate' OR services::text ILIKE '%renovate%' OR project_sub_type ILIKE '%renovate%')`);
            }
            else if (s === 'ma') {
                whereClauses.push(`(LOWER(job_type) = 'ma' OR services::text ILIKE '%ma%' OR project_sub_type ILIKE '%ma%')`);
            }
            else {
                whereClauses.push(`(project_sub_type = $${paramIdx} OR services::text ILIKE $${paramIdx + 1})`);
                params.push(filters.service, `%${filters.service}%`);
                paramIdx += 2;
            }
        }
        if (filters?.search && filters.search.trim()) {
            const sanitized = filters.search.trim().replace(/[%_\\]/g, '\\$&');
            const q = `%${sanitized}%`;
            whereClauses.push(`(
        job_no ILIKE $${paramIdx} OR
        external_ref_id ILIKE $${paramIdx} OR
        booking_no ILIKE $${paramIdx} OR
        ticket_no ILIKE $${paramIdx} OR
        customer_name ILIKE $${paramIdx} OR
        customer_phone ILIKE $${paramIdx} OR
        plan_date ILIKE $${paramIdx} OR
        assigned_tech ILIKE $${paramIdx} OR
        store_code ILIKE $${paramIdx} OR
        agent_name ILIKE $${paramIdx} OR
        project_sub_type ILIKE $${paramIdx}
      )`);
            params.push(q);
            paramIdx++;
        }
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const selectCols = filters?.lean === false ? '*' : exports.LEAN_JOB_COLUMNS;
        const querySql = `
      SELECT ${selectCols}
      FROM core_jobs
      ${whereSql}
      ORDER BY created_at DESC, id DESC
    `;
        const res = await exports.pool.query(querySql, params);
        return res.rows.map(mapDbJobRow);
    }
    catch (err) {
        console.error('[DB] Error loading jobs:', err.message);
        return [];
    }
}
async function dbGetJob(jobNoOrId) {
    try {
        const target = String(jobNoOrId);
        const res = await exports.pool.query('SELECT * FROM core_jobs WHERE job_no = $1 OR (id::text = $1) OR external_ref_id = $1 OR booking_no = $1 OR ticket_no = $1 LIMIT 1', [target]);
        if (res.rows.length === 0)
            return null;
        return mapDbJobRow(res.rows[0]);
    }
    catch (err) {
        console.error('[DB] Error getting job:', err.message);
        return null;
    }
}
async function dbSaveJob(job) {
    try {
        const customerData = job.customer_data || job.customer || {};
        const agentData = job.agent_data || job.agent || {};
        const storeData = job.store_data || job.store || {};
        const schedulePlan = job.schedule_plan || {};
        const checkinData = job.checkin_data || job.check_in || {};
        const checkoutData = job.checkout_data || job.check_out || {};
        const approvalData = job.approval_data || job.approval || {};
        const visitResults = job.visit_results || job.visit_result || [];
        const remarksData = job.remarks_data || job.remarks || {};
        const jobDetails = job.job_details || job.job_detail || [];
        const rawPayload = {
            ...(job.raw_payload || {}),
            qc_history: job.qc_history || [],
            qc_subtasks: job.qc_subtasks || [],
            rework_count: job.rework_count || 0,
            qc_rework_count: job.qc_rework_count || 0,
            has_rework: !!job.has_rework,
            qc_remarks: job.qc_remarks || '',
            qc_inspector: job.qc_inspector || ''
        };
        const customerName = job.customer_name || customerData.name || customerData.first_name || 'ลูกค้าทั่วไป';
        const customerPhone = job.customer_phone || customerData.phone || customerData.mobile_no || '';
        const customerAddress = job.customer_address || customerData.address || customerData.location?.address || '';
        await exports.pool.query(`INSERT INTO core_jobs (
        job_no, external_ref_id, booking_no, ticket_no, customer_id, status, job_type,
        step_timestamps, property_type, project_type, project_sub_type, store_code,
        agent_name, assigned_tech, plan_date, services, overall_progress,
        special_instructions, additional_notes, customer_data, customer_name, customer_phone, customer_address, tasks, photos,
        boq_items, boq_discount, boq_subtotal, boq_grand_total, pmt_accepted, pmt_accepted_at, step3_confirmed,
        job_details, agent_data, store_data, schedule_plan, checkin_data, checkout_data, approval_data,
        visit_results, remarks_data, file_int_image, raw_payload, areas, qc_manual_questions, escalated_at, escalated_reason, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29,
        $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42, $43, $44, $45, $46, $47, COALESCE($48::timestamptz, CURRENT_TIMESTAMP)
      ) ON CONFLICT (job_no) DO UPDATE SET
        external_ref_id = EXCLUDED.external_ref_id,
        booking_no = EXCLUDED.booking_no,
        ticket_no = EXCLUDED.ticket_no,
        customer_id = EXCLUDED.customer_id,
        status = EXCLUDED.status,
        job_type = EXCLUDED.job_type,
        step_timestamps = EXCLUDED.step_timestamps,
        property_type = EXCLUDED.property_type,
        project_type = EXCLUDED.project_type,
        project_sub_type = EXCLUDED.project_sub_type,
        store_code = EXCLUDED.store_code,
        agent_name = EXCLUDED.agent_name,
        assigned_tech = EXCLUDED.assigned_tech,
        plan_date = EXCLUDED.plan_date,
        services = EXCLUDED.services,
        overall_progress = EXCLUDED.overall_progress,
        special_instructions = EXCLUDED.special_instructions,
        additional_notes = EXCLUDED.additional_notes,
        customer_data = EXCLUDED.customer_data,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        customer_address = EXCLUDED.customer_address,
        tasks = EXCLUDED.tasks,
        photos = EXCLUDED.photos,
        boq_items = EXCLUDED.boq_items,
        boq_discount = EXCLUDED.boq_discount,
        boq_subtotal = EXCLUDED.boq_subtotal,
        boq_grand_total = EXCLUDED.boq_grand_total,
        pmt_accepted = EXCLUDED.pmt_accepted,
        pmt_accepted_at = EXCLUDED.pmt_accepted_at,
        step3_confirmed = EXCLUDED.step3_confirmed,
        job_details = EXCLUDED.job_details,
        agent_data = EXCLUDED.agent_data,
        store_data = EXCLUDED.store_data,
        schedule_plan = EXCLUDED.schedule_plan,
        checkin_data = EXCLUDED.checkin_data,
        checkout_data = EXCLUDED.checkout_data,
        approval_data = EXCLUDED.approval_data,
        visit_results = EXCLUDED.visit_results,
        remarks_data = EXCLUDED.remarks_data,
        file_int_image = EXCLUDED.file_int_image,
        raw_payload = EXCLUDED.raw_payload,
        areas = EXCLUDED.areas,
        qc_manual_questions = EXCLUDED.qc_manual_questions,
        escalated_at = EXCLUDED.escalated_at,
        escalated_reason = EXCLUDED.escalated_reason,
        updated_at = CURRENT_TIMESTAMP`, [
            job.job_no,
            job.external_ref_id || null,
            job.booking_no || null,
            job.ticket_no || null,
            job.customer_id ? Number(job.customer_id) : 1,
            job.status || 'DRAFT',
            job.job_type || 'quick',
            JSON.stringify(job.step_timestamps || {}),
            job.property_type || null,
            job.project_type || null,
            job.project_sub_type || null,
            job.store_code || null,
            job.agent_name || null,
            job.assigned_tech || null,
            job.plan_date || null,
            JSON.stringify(job.services || []),
            job.overall_progress || 0,
            job.special_instructions || null,
            job.additional_notes || null,
            JSON.stringify(customerData),
            customerName,
            customerPhone,
            customerAddress,
            JSON.stringify(job.tasks || []),
            JSON.stringify(job.photos || []),
            JSON.stringify(job.boq_items || []),
            Number(job.boq_discount) || 0,
            Number(job.boq_subtotal) || 0,
            Number(job.boq_grand_total) || 0,
            Boolean(job.pmt_accepted),
            job.pmt_accepted_at ? new Date(job.pmt_accepted_at) : null,
            Boolean(job.step3_confirmed),
            JSON.stringify(jobDetails),
            JSON.stringify(agentData),
            JSON.stringify(storeData),
            JSON.stringify(schedulePlan),
            JSON.stringify(checkinData),
            JSON.stringify(checkoutData),
            JSON.stringify(approvalData),
            JSON.stringify(visitResults),
            JSON.stringify(remarksData),
            job.file_int_image || null,
            JSON.stringify(rawPayload),
            JSON.stringify(job.areas || []),
            JSON.stringify(job.qc_manual_questions || []),
            job.escalated_at ? new Date(job.escalated_at) : null,
            job.escalated_reason || null,
            job.created_at || null
        ]);
        cachedMetrics = null;
    }
    catch (err) {
        console.error('[DB] Error saving job:', err.message);
        throw err;
    }
}
async function dbUpdateJob(jobNoOrId, updates) {
    try {
        const target = String(jobNoOrId);
        const setClauses = [];
        const values = [];
        let idx = 1;
        const jsonbFields = [
            'step_timestamps', 'services', 'customer_data', 'tasks', 'photos', 'boq_items', 'csat_photos',
            'job_details', 'agent_data', 'store_data', 'schedule_plan', 'checkin_data', 'checkout_data',
            'approval_data', 'visit_results', 'remarks_data', 'raw_payload', 'qc_history', 'qc_subtasks',
            'stk_payload', 'boq_original_file', 'areas', 'qc_manual_questions', 'boq_revisions'
        ];
        const stringFields = [
            'external_ref_id', 'booking_no', 'ticket_no', 'status', 'job_type',
            'property_type', 'project_type', 'project_sub_type', 'store_code',
            'agent_name', 'assigned_tech', 'plan_date', 'special_instructions',
            'additional_notes', 'qc_inspection_type', 'csat_remarks', 'csat_surveyor', 'file_int_image',
            'qc_remarks', 'qc_inspector', 'stk_ref', 'stk_status', 'escalated_reason'
        ];
        const numFields = ['customer_id', 'overall_progress', 'boq_discount', 'boq_subtotal', 'boq_grand_total', 'qc_score', 'csat_score', 'rework_count', 'qc_rework_count', 'boq_version'];
        const boolFields = ['pmt_accepted', 'step3_confirmed', 'has_rework'];
        const dateFields = ['pmt_accepted_at', 'qc_passed_at', 'csat_evaluated_at', 'stk_exported_at', 'escalated_at'];
        for (const [key, val] of Object.entries(updates)) {
            if (val === undefined)
                continue;
            if (jsonbFields.includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'customer') {
                setClauses.push(`customer_data = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'agent') {
                setClauses.push(`agent_data = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'store') {
                setClauses.push(`store_data = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'check_in') {
                setClauses.push(`checkin_data = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'check_out') {
                setClauses.push(`checkout_data = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'approval') {
                setClauses.push(`approval_data = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'remarks' || key === 'remarks_data') {
                setClauses.push(`remarks_data = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'job_detail' || key === 'job_details') {
                setClauses.push(`job_details = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'visit_result' || key === 'visit_results') {
                setClauses.push(`visit_results = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (stringFields.includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val);
            }
            else if (numFields.includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(Number(val));
            }
            else if (boolFields.includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(Boolean(val));
            }
            else if (dateFields.includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val ? new Date(val) : null);
            }
        }
        if (setClauses.length === 0)
            return await dbGetJob(jobNoOrId);
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(target);
        await exports.pool.query(`UPDATE core_jobs SET ${setClauses.join(', ')} WHERE job_no = $${idx} OR (id::text = $${idx})`, values);
        cachedMetrics = null;
        return await dbGetJob(jobNoOrId);
    }
    catch (err) {
        console.error('[DB] Error updating job:', err.message);
        return null;
    }
}
async function dbSaveAuditLog(entry) {
    try {
        const ts = entry.timestamp ? new Date(entry.timestamp) : new Date();
        await exports.pool.query(`INSERT INTO core_audit_logs (
        timestamp, user_id, username, full_name, role, action, entity_type, entity_id, booking_no, old_values, new_values, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [
            ts,
            entry.user_id ? Number(entry.user_id) : null,
            entry.username || null,
            entry.full_name || null,
            entry.role || null,
            entry.action,
            entry.entity_type,
            String(entry.entity_id),
            entry.booking_no || null,
            JSON.stringify(entry.old_values || {}),
            JSON.stringify(entry.new_values || {}),
            JSON.stringify(entry.metadata || {})
        ]);
    }
    catch (err) {
        console.error('[DB AUDIT LOG] Error saving audit log:', err.message);
    }
}
async function dbLoadAuditLogs(filters) {
    try {
        const whereClauses = [];
        const params = [];
        let idx = 1;
        if (filters?.booking_no) {
            whereClauses.push(`booking_no = $${idx++}`);
            params.push(filters.booking_no);
        }
        if (filters?.entity_type) {
            whereClauses.push(`entity_type = $${idx++}`);
            params.push(filters.entity_type);
        }
        if (filters?.entity_id) {
            whereClauses.push(`entity_id = $${idx++}`);
            params.push(filters.entity_id);
        }
        if (filters?.action) {
            whereClauses.push(`action = $${idx++}`);
            params.push(filters.action);
        }
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const countRes = await exports.pool.query(`SELECT COUNT(*)::int AS total FROM core_audit_logs ${whereSql}`, params);
        const total = Number(countRes.rows[0]?.total) || 0;
        const limit = Math.min(200, Math.max(1, Number(filters?.limit) || 50));
        const page = Math.max(1, Number(filters?.page) || 1);
        const offset = (page - 1) * limit;
        const querySql = `
      SELECT * FROM core_audit_logs
      ${whereSql}
      ORDER BY timestamp DESC, id DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;
        const res = await exports.pool.query(querySql, [...params, limit, offset]);
        return {
            logs: res.rows.map(r => ({
                ...r,
                timestamp: r.timestamp ? new Date(r.timestamp).toISOString() : new Date().toISOString()
            })),
            total
        };
    }
    catch (err) {
        console.error('[DB AUDIT LOG] Error loading audit logs:', err.message);
        return { logs: [], total: 0 };
    }
}
// =============================================================================
// BOOKING LOOKUP & IDEMPOTENCY
// =============================================================================
async function dbGetJobByBookingNo(bookingNo) {
    try {
        if (!bookingNo || !bookingNo.trim())
            return null;
        const res = await exports.pool.query('SELECT * FROM core_jobs WHERE booking_no = $1 OR external_ref_id = $1 OR job_no = $1 LIMIT 1', [bookingNo.trim()]);
        if (res.rows.length === 0)
            return null;
        return mapDbJobRow(res.rows[0]);
    }
    catch (err) {
        console.error('[DB] Error getting job by booking no:', err.message);
        return null;
    }
}
async function dbSaveStkSyncLog(syncLog) {
    try {
        const effectivePayload = syncLog.request_payload || syncLog.payload || {};
        const effectiveResponse = syncLog.response_payload || syncLog.response_body || null;
        const effectiveError = syncLog.error_message || syncLog.last_error || null;
        const effectiveSent = syncLog.synced_at || syncLog.sent_at || null;
        const res = await exports.pool.query(`INSERT INTO stk_sync_logs (
        idempotency_key, booking_no, job_type, area_id, area_name, task_id, task_name,
        assigned_tech, assigned_qc, final_score, rework_count, status, payload,
        response_body, retry_count, max_retries, last_error, last_attempt_at, sent_at, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, CURRENT_TIMESTAMP
      ) ON CONFLICT (idempotency_key) DO UPDATE SET
        status = EXCLUDED.status,
        payload = EXCLUDED.payload,
        response_body = EXCLUDED.response_body,
        retry_count = EXCLUDED.retry_count,
        last_error = EXCLUDED.last_error,
        last_attempt_at = EXCLUDED.last_attempt_at,
        sent_at = EXCLUDED.sent_at
      RETURNING *`, [
            syncLog.idempotency_key,
            syncLog.booking_no,
            syncLog.job_type || 'R',
            syncLog.area_id || null,
            syncLog.area_name || null,
            syncLog.task_id || null,
            syncLog.task_name || null,
            syncLog.assigned_tech || null,
            syncLog.assigned_qc || null,
            Number(syncLog.final_score || effectivePayload.qc_score || 1),
            Number(syncLog.rework_count || 0),
            syncLog.status || 'PENDING',
            JSON.stringify(effectivePayload),
            effectiveResponse ? JSON.stringify(effectiveResponse) : null,
            Number(syncLog.retry_count || 0),
            Number(syncLog.max_retries || 3),
            effectiveError,
            syncLog.last_attempt_at ? new Date(syncLog.last_attempt_at) : null,
            effectiveSent ? new Date(effectiveSent) : null
        ]);
        return res.rows[0] || syncLog;
    }
    catch (err) {
        console.error('[DB STK LOG] Error saving STK sync log:', err.message);
        return syncLog;
    }
}
async function dbUpdateStkSyncLog(idOrKey, updates) {
    try {
        const isNum = typeof idOrKey === 'number' || (!isNaN(Number(idOrKey)) && !String(idOrKey).includes('-') && !String(idOrKey).startsWith('STK_'));
        const setClauses = [];
        const values = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
            if (val === undefined)
                continue;
            if (['payload', 'request_payload'].includes(key)) {
                setClauses.push(`payload = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (['response_body', 'response_payload'].includes(key)) {
                setClauses.push(`response_body = $${idx++}`);
                values.push(val ? JSON.stringify(val) : null);
            }
            else if (['retry_count', 'final_score', 'rework_count', 'max_retries'].includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(Number(val));
            }
            else if (['last_error', 'error_message'].includes(key)) {
                setClauses.push(`last_error = $${idx++}`);
                values.push(val);
            }
            else if (['sent_at', 'synced_at'].includes(key)) {
                setClauses.push(`sent_at = $${idx++}`);
                values.push(val ? new Date(val) : null);
            }
            else if (key === 'last_attempt_at') {
                setClauses.push(`last_attempt_at = $${idx++}`);
                values.push(val ? new Date(val) : null);
            }
            else if (key !== 'job_id' && key !== 'idempotency_key') {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val);
            }
        }
        if (setClauses.length === 0)
            return;
        values.push(idOrKey);
        const whereClause = isNum ? `id = $${idx}` : `idempotency_key = $${idx}`;
        await exports.pool.query(`UPDATE stk_sync_logs SET ${setClauses.join(', ')} WHERE ${whereClause}`, values);
    }
    catch (err) {
        console.error('[DB STK LOG] Error updating STK sync log:', err.message);
    }
}
async function dbGetStkSyncLog(idOrKey) {
    try {
        const isNum = typeof idOrKey === 'number' || (!isNaN(Number(idOrKey)) && !String(idOrKey).includes('-'));
        const whereClause = isNum ? 'id = $1' : 'idempotency_key = $1';
        const res = await exports.pool.query(`SELECT * FROM stk_sync_logs WHERE ${whereClause} LIMIT 1`, [idOrKey]);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB STK LOG] Error getting STK sync log:', err.message);
        return null;
    }
}
async function dbGetStkSyncLogByIdempotencyKey(key) {
    try {
        const res = await exports.pool.query('SELECT * FROM stk_sync_logs WHERE idempotency_key = $1 LIMIT 1', [key]);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB STK LOG] Error getting STK sync log by key:', err.message);
        return null;
    }
}
async function dbLoadStkSyncLogs(filters) {
    try {
        const whereClauses = [];
        const params = [];
        let idx = 1;
        if (filters?.status && filters.status !== 'all') {
            whereClauses.push(`status = $${idx++}`);
            params.push(filters.status);
        }
        if (filters?.booking_no) {
            whereClauses.push(`booking_no = $${idx++}`);
            params.push(filters.booking_no);
        }
        const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const limit = Math.min(200, Math.max(1, Number(filters?.limit) || 50));
        params.push(limit);
        const res = await exports.pool.query(`SELECT * FROM stk_sync_logs ${whereSql} ORDER BY created_at DESC, id DESC LIMIT $${idx}`, params);
        return res.rows;
    }
    catch (err) {
        console.error('[DB STK LOG] Error loading STK sync logs:', err.message);
        return [];
    }
}
async function dbDeleteJob(jobNoOrId) {
    try {
        const isId = typeof jobNoOrId === 'number' || !isNaN(Number(jobNoOrId));
        const whereCol = isId ? 'id' : 'job_no';
        await exports.pool.query(`DELETE FROM core_jobs WHERE ${whereCol} = $1`, [jobNoOrId]);
        cachedMetrics = null;
    }
    catch (err) {
        console.error('[DB] Error deleting job:', err.message);
    }
}
async function dbResetJobStatus() {
    try {
        const res = await exports.pool.query(`
      UPDATE core_jobs SET
        status = 'NEW',
        overall_progress = 0,
        pmt_accepted = false,
        pmt_accepted_at = NULL,
        ticket_no = NULL,
        step_timestamps = '{}'::jsonb,
        step3_confirmed = false,
        tasks = '[]'::jsonb,
        areas = '[]'::jsonb,
        boq_items = '[]'::jsonb,
        boq_discount = 0,
        boq_subtotal = 0,
        boq_grand_total = 0,
        boq_original_file = NULL,
        boq_version = 1,
        boq_revisions = '[]'::jsonb,
        checkin_data = '{}'::jsonb,
        checkout_data = '{}'::jsonb,
        approval_data = '{}'::jsonb,
        visit_results = '[]'::jsonb,
        qc_inspection_type = NULL,
        qc_passed_at = NULL,
        qc_score = NULL,
        qc_history = '[]'::jsonb,
        qc_subtasks = '[]'::jsonb,
        rework_count = 0,
        qc_rework_count = 0,
        has_rework = false,
        qc_remarks = NULL,
        qc_inspector = NULL,
        qc_manual_questions = '[]'::jsonb,
        csat_score = NULL,
        csat_remarks = NULL,
        csat_photos = '[]'::jsonb,
        csat_surveyor = NULL,
        csat_evaluated_at = NULL,
        stk_ref = NULL,
        stk_status = NULL,
        stk_payload = '{}'::jsonb,
        stk_exported_at = NULL,
        escalated_at = NULL,
        escalated_reason = NULL,
        updated_at = CURRENT_TIMESTAMP;
    `);
        await exports.pool.query(`
      TRUNCATE TABLE 
        core_daily_work_logs, 
        core_qc_bookings, 
        core_tickets, 
        core_blueprints, 
        staging_survey_reports, 
        core_audit_logs, 
        stk_sync_logs, 
        ma_rounds, 
        ma_contracts 
      CASCADE;
    `);
        return res.rowCount || 0;
    }
    catch (err) {
        console.error('[DB] Error resetting job status:', err.message);
        return 0;
    }
}
async function dbWipeAllTransactions() {
    try {
        await exports.pool.query(`
      TRUNCATE core_jobs, core_daily_work_logs, core_qc_bookings, ma_contracts, ma_rounds CASCADE;
    `);
        console.log('[DB] Wiped all transactions via TRUNCATE CASCADE.');
    }
    catch (err) {
        console.warn('[DB] TRUNCATE failed, falling back to DELETE:', err.message);
        await exports.pool.query('DELETE FROM core_daily_work_logs;');
        await exports.pool.query('DELETE FROM core_qc_bookings;');
        await exports.pool.query('DELETE FROM ma_rounds;');
        await exports.pool.query('DELETE FROM ma_contracts;');
        await exports.pool.query('DELETE FROM core_jobs;');
    }
}
// 40 Mock Jobs Data Generator (20 Renovate with BOQ & Gantt Tasks, 20 Quick Services with QC Photos)
async function dbSeedMockJobs() {
    console.log('[DB SEED] Generating 40 mock jobs (20 Renovate with BOQ & Gantt + 20 Quick with QC photos)...');
    const client = await exports.pool.connect();
    try {
        await client.query('BEGIN');
        await client.query(`
      TRUNCATE TABLE 
        core_daily_work_logs, 
        core_qc_bookings, 
        core_tickets, 
        core_blueprints, 
        staging_survey_reports, 
        core_audit_logs, 
        stk_sync_logs, 
        ma_rounds, 
        ma_contracts,
        core_jobs
      CASCADE;
    `);
        // 1. Wipe all operational/log tables and core_jobs ("ที่เหลือ ลบออกให้หมด")
        console.log('[SEED-40] Wiping all remaining data in core_jobs and related tables...');
        await client.query(`
      TRUNCATE TABLE 
        core_daily_work_logs, 
        core_qc_bookings, 
        core_tickets, 
        core_blueprints, 
        staging_survey_reports, 
        core_audit_logs, 
        stk_sync_logs, 
        ma_rounds, 
        ma_contracts,
        core_jobs
      CASCADE;
    `);
        // Reset sequence if exists
        try {
            await client.query(`ALTER SEQUENCE core_jobs_id_seq RESTART WITH 1;`);
        }
        catch { }
        // Master Customer Pool (40 unique customers with realistic Thai names and addresses)
        const customers = [
            { name: 'คุณภาคิน วรโชติเมธี', phone: '081-912-3456', address: '88/15 ม.เซนโทร รามอินทรา-จตุโชติ แขวงออเงิน เขตสายไหม กทม. 10220', branch: 'สาขารามอินทรา', store_code: 'STORE-RAM' },
            { name: 'คุณชวินท์ ก้องธนภัทร', phone: '086-734-5678', address: '29/88 คอนโด ไอดีโอ คิว จุฬา-สามย่าน แขวงสี่พระยา เขตบางรัก กทม. 10500', branch: 'สาขาพระราม 4', store_code: 'STORE-RAM4' },
            { name: 'คุณภัทรดนัย อัครโยธิน', phone: '083-556-7890', address: '63/4 บ้านกลางเมือง ลาดพร้าว-เสรีไทย แขวงคลองกุ่ม เขตบึงกุ่ม กทม. 10240', branch: 'สาขาลาดพร้าว', store_code: 'STORE-LDP' },
            { name: 'คุณภูมิภัทร ชาญปรีชา', phone: '087-378-9012', address: '75/10 อาคารพาณิชย์ 4 ชั้น ถ.เพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กทม. 10160', branch: 'สาขาเพชรเกษม', store_code: 'STORE-PK' },
            { name: 'คุณเอกภาพ พงษ์ศิริพาณิชย์', phone: '098-190-1234', address: '310/55 มัณฑนา ราชพฤกษ์-นครอินทร์ ต.บางขุนกอง อ.บางกรวย นนทบุรี 11130', branch: 'สาขาราชพฤกษ์', store_code: 'STORE-RP' },
            { name: 'คุณธนพล วรเกียรติกุล', phone: '085-902-3456', address: '204/18 แกรนด์ บางกอก บูเลอวาร์ด สาทร-กัลปพฤกษ์ แขวงบางแค กทม. 10160', branch: 'สาขากัลปพฤกษ์', store_code: 'STORE-KP' },
            { name: 'คุณปัณณธร พัฒนประเสริฐ', phone: '082-724-5678', address: '120/45 วิลเลจจิโอ ประชาอุทิศ 90 ต.แหลมฟ้าผ่า อ.พระสมุทรเจดีย์ สมุทรปราการ', branch: 'สาขาสุขสวัสดิ์', store_code: 'STORE-SSW' },
            { name: 'คุณรัชชานนท์ เมธาบวรกุล', phone: '080-546-7890', address: '155/12 บุราสิริ พัฒนาการ แขวงประเวศ เขตประเวศ กทม. 10250', branch: 'สาขาพัฒนาการ', store_code: 'STORE-PTN' },
            { name: 'คุณกฤษดา เจริญวิชิตชัย', phone: '089-123-9876', address: '48/22 เพอร์เฟค มาสเตอร์พีซ แจ้งวัฒนะ ต.บางตะไนย์ อ.ปากเกร็ด นนทบุรี', branch: 'สาขาแจ้งวัฒนะ', store_code: 'STORE-CWT' },
            { name: 'คุณธัญชนก ธนกุลสวัสดิ์', phone: '094-876-5432', address: '102/19 ลัดดารมย์ ราชพฤกษ์-ปิ่นเกล้า แขวงบางระมาด เขตตลิ่งชัน กทม. 10170', branch: 'สาขาปิ่นเกล้า', store_code: 'STORE-PKL' },
            { name: 'คุณณัฐนพิน รัตนวิบูลย์', phone: '092-823-4567', address: '142/36 เดอะ แกรนด์ พระราม 2 ต.พันท้ายนรสิงห์ อ.เมือง สมุทรสาคร 74000', branch: 'สาขาพระราม 2', store_code: 'STORE-RM2' },
            { name: 'คุณลภัสรดา สิริวัฒนกุล', phone: '095-645-6789', address: '512/18 เศรษฐสิริ กรุงเทพกรีฑา แขวงหัวหมาก เขตบางกะปิ กทม. 10240', branch: 'สาขาศรีนครินทร์', store_code: 'STORE-SNK' },
            { name: 'คุณนภัสสร บุญญานุวัตร', phone: '091-467-8901', address: '189/27 เพอร์เฟค เพลส รังสิต-ทางด่วนบางพูน ต.บ้านกลาง อ.เมือง ปทุมธานี', branch: 'สาขารังสิต คลองสี่', store_code: 'STORE-RS4' },
            { name: 'คุณวริศรา กิตติโภคิน', phone: '084-289-0123', address: '450/92 คอนโด แอชตัน สีลม ถ.สีลม แขวงสุริยวงศ์ เขตบางรัก กทม. 10500', branch: 'สาขาสีลม', store_code: 'STORE-SLM' },
            { name: 'คุณกัญญารัตน์ โสภณพิทักษ์', phone: '089-091-2345', address: '99/124 สราญสิริ ชัยพฤกษ์-แจ้งวัฒนะ ต.บางพลับ อ.ปากเกร็ด นนทบุรี', branch: 'สาขาชัยพฤกษ์', store_code: 'STORE-CPK' },
            { name: 'คุณนันทิกานต์ เตชะไพบูลย์', phone: '093-813-4567', address: '77/205 คอนโด เดอะ ริทซ์-คาร์ลตัน เรสซิเดนเซส ถ.นราธิวาส แขวงสีลม กทม.', branch: 'สาขาสาทร', store_code: 'STORE-STN' },
            { name: 'คุณมนัสชนก ศรีวิชัยพฤกษ์', phone: '096-635-6789', address: '38/66 พาทิโอ แจ้งวัฒนะ-เมืองทองธานี ต.คลองเกลือ อ.ปากเกร็ด นนทบุรี', branch: 'สาขาเมืองทองธานี', store_code: 'STORE-MTT' },
            { name: 'คุณพิชญ์สินี อัครวิวัฒน์', phone: '094-457-8901', address: '620/14 โฮมออฟฟิศ 4 ชั้น ถ.นวลจันทร์ แขวงนวลจันทร์ เขตบึงกุ่ม กทม.', branch: 'สาขานวมินทร์', store_code: 'STORE-NMN' },
            { name: 'คุณศุภณัฐ อัศวเมธิน', phone: '086-345-6789', address: '168/40 นันทวัน บางนา กม.7 ต.บางแก้ว อ.บางพลี สมุทรปราการ 10540', branch: 'สาขาบางนา', store_code: 'STORE-BNA' },
            { name: 'คุณศศิธร พัชรเกียรติกุล', phone: '097-890-1234', address: '89/12 เดอะ ปาล์ม พัฒนาการ แขวงสวนหลวง เขตสวนหลวง กทม. 10250', branch: 'สาขาสวนหลวง', store_code: 'STORE-SWL' },
            // 21 - 40
            { name: 'คุณสมศักดิ์ ทดสอบระบบ', phone: '089-999-8888', address: '123/45 ซอยสุขุมวิท 101/1 แขวงบางจาก เขตพระโขนง กทม. 10260', branch: 'สาขาบางจาก', store_code: 'STORE-BJK' },
            { name: 'คุณอานิสา แซ่ใบ', phone: '097-284-0079', address: '55/9 ม.สัมมากร รังสิต คลองสอง ต.ประชาธิปัตย์ อ.ธัญบุรี ปทุมธานี 12130', branch: 'สาขารังสิต คลองสี่', store_code: 'STORE-RS4' },
            { name: 'คุณนงศิรา หงษ์สุวรรณ', phone: '064-863-6074', address: '14/22 ถนนประชาอุทิศ แขวงราษฎร์บูรณะ เขตราษฎร์บูรณะ กทม. 10140', branch: 'สาขาสุขสวัสดิ์', store_code: 'STORE-SSW' },
            { name: 'คุณบุษกร กิ่งอุบล', phone: '089-124-6480', address: '99/8 ซอยอารีย์สัมพันธ์ แขวงพญาไท เขตพญาไท กทม. 10400', branch: 'สาขาพญาไท', store_code: 'STORE-PYT' },
            { name: 'คุณวรศักดิ์ ปิ่นเกตุ', phone: '062-614-2625', address: '44/12 ถ.ศรีนครินทร์ แขวงหนองบอน เขตประเวศ กทม. 10250', branch: 'สาขาบางนา', store_code: 'STORE-BNA' },
            { name: 'คุณสุชาดา ชัยวรรณ์', phone: '081-279-0515', address: '78/90 ถนนนวมินทร์ แขวงนวมินทร์ เขตบึงกุ่ม กทม. 10240', branch: 'สาขานวมินทร์', store_code: 'STORE-NMN' },
            { name: 'คุณธีรภัทร ชาญวารินทร์', phone: '085-332-1144', address: '51/10 ม.ศุภาลัย พรีมา วิลล่า เพชรเกษม แขวงบางหว้า กทม. 10160', branch: 'สาขาเพชรเกษม', store_code: 'STORE-PK' },
            { name: 'คุณพัชราภา วงศ์เสนา', phone: '086-445-9988', address: '112/5 คอนโด ลุมพินี พาร์ค ปิ่นเกล้า แขวงบางยี่ขัน กทม. 10700', branch: 'สาขาปิ่นเกล้า', store_code: 'STORE-PKL' },
            { name: 'คุณชลธิชา เจริญรัตน์', phone: '087-556-2233', address: '88/19 ม.พฤกษาวิลล์ แจ้งวัฒนะ ต.ปากเกร็ด อ.ปากเกร็ด นนทบุรี', branch: 'สาขาแจ้งวัฒนะ', store_code: 'STORE-CWT' },
            { name: 'คุณภาณุพงศ์ ประเสริฐวิทย์', phone: '088-778-3344', address: '66/14 ม.เดอะ ซิตี้ พระราม 5-นครอินทร์ ต.บางขุนกอง อ.บางกรวย นนทบุรี', branch: 'สาขาราชพฤกษ์', store_code: 'STORE-RP' },
            { name: 'คุณเกศรินทร์ เตชะสุวรรณ', phone: '089-667-8899', address: '19/40 ทาวน์โฮม โกลเด้น นีโอ ลาดพร้าว แขวงคลองเจ้าคุณสิงห์ กทม. 10310', branch: 'สาขาลาดพร้าว', store_code: 'STORE-LDP' },
            { name: 'คุณอรรถพล มหิทธาภรณ์', phone: '081-334-5566', address: '223/88 ม.ลัดดารมย์ Elegance ถ.กาญจนาภิเษก แขวงบางแคเหนือ กทม. 10160', branch: 'สาขากัลปพฤกษ์', store_code: 'STORE-KP' },
            { name: 'คุณปิยะดา ไตรปิฎก', phone: '082-445-6677', address: '45/18 คอนโด ไนท์บริดจ์ สเปซ พระราม 9 แขวงห้วยขวาง กทม. 10310', branch: 'สาขาพระราม 9', store_code: 'STORE-RM9' },
            { name: 'คุณณัฐดนัย กุลธนาสาร', phone: '083-556-7788', address: '78/11 ม.บริทาเนีย บางนา กม.12 ต.บางพลีใหญ่ อ.บางพลี สมุทรปราการ', branch: 'สาขาบางนา', store_code: 'STORE-BNA' },
            { name: 'คุณสลิลทิพย์ วรศิลป์', phone: '084-667-8899', address: '90/15 ม.มัณฑนา อ่อนนุช-วงแหวน แขวงดอกไม้ เขตประเวศ กทม. 10250', branch: 'สาขาพัฒนาการ', store_code: 'STORE-PTN' },
            { name: 'คุณกิตติธัช ธนทรัพย์ไพศาล', phone: '085-778-9900', address: '33/77 ม.เพอร์เฟค เพลส สุขุมวิท 77 ต.ราชาเทวะ อ.บางพลี สมุทรปราการ', branch: 'สาขาสุวรรณภูมิ', store_code: 'STORE-SWN' },
            { name: 'คุณกานต์พิชชา รัศมีจันทร์', phone: '086-889-0011', address: '108/9 คอนโด โนเบิล รีโว สีลม แขวงสีลม เขตบางรัก กทม. 10500', branch: 'สาขาสีลม', store_code: 'STORE-SLM' },
            { name: 'คุณธราดล อิทธิไพศาล', phone: '087-990-1122', address: '54/12 ม.คาซ่า วิลล์ รามอินทรา-หทัยราษฎร์ ต.บึงคำพร้อย อ.ลำลูกกา ปทุมธานี', branch: 'สาขารามอินทรา', store_code: 'STORE-RAM' },
            { name: 'คุณพิมพ์พิชชา วรเกียรติ', phone: '088-001-2233', address: '67/88 ม.บางกอก บูเลอวาร์ด พระราม 2 ถ.พระราม 2 แขวงแสมดำ กทม. 10150', branch: 'สาขาพระราม 2', store_code: 'STORE-RM2' },
            { name: 'คุณสิทธิชัย ภัทรพลากุล', phone: '089-112-3344', address: '12/34 ม.ศุภาลัย การ์เด้นวิลล์ ติวานนท์-ปทุมธานี ต.บางกะดี อ.เมือง ปทุมธานี', branch: 'สาขาปทุมธานี', store_code: 'STORE-PTM' }
        ];
        // Standard Curated High-Res Construction Photos for Q Jobs (All 5 Standard Photo Slots)
        const qPhotoPresets = [
            {
                before: 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=800&q=80',
                during1: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?auto=format&fit=crop&w=800&q=80',
                during2: 'https://images.unsplash.com/photo-1581092335397-9583fe92d232?auto=format&fit=crop&w=800&q=80',
                testing: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?auto=format&fit=crop&w=800&q=80',
                after: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=800&q=80',
            },
            {
                before: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?auto=format&fit=crop&w=800&q=80',
                during1: 'https://images.unsplash.com/photo-1581092580497-e0d23cbdf1dc?auto=format&fit=crop&w=800&q=80',
                during2: 'https://images.unsplash.com/photo-1581092162384-8987c1d64718?auto=format&fit=crop&w=800&q=80',
                testing: 'https://images.unsplash.com/photo-1581092795360-fd1ca04f0952?auto=format&fit=crop&w=800&q=80',
                after: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
            },
            {
                before: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=800&q=80',
                during1: 'https://images.unsplash.com/photo-1541888946425-d0fbb1861564?auto=format&fit=crop&w=800&q=80',
                during2: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?auto=format&fit=crop&w=800&q=80',
                testing: 'https://images.unsplash.com/photo-1581093458791-9f3c3900df4b?auto=format&fit=crop&w=800&q=80',
                after: 'https://images.unsplash.com/photo-1600565193348-f74bd3c7ccdf?auto=format&fit=crop&w=800&q=80',
            }
        ];
        // =========================================================================
        // 2. BUILD 20 RENOVATE JOBS (งาน R) — ALL WITH FULL BOQ & GANTT TASKS
        // =========================================================================
        console.log('[SEED-40] Generating 20 Renovate Jobs (งาน R) with complete BOQ and Gantt Tasks...');
        const rProjectsCatalog = [
            {
                sub_type: 'ปรับปรุงห้องน้ำชั้น 2 และทำระบบกันซึม 3 ชั้น',
                services: ['งานปรับปรุงห้องน้ำชั้น 2', 'งานระบบกันซึม 3 ชั้น', 'งานปูกระเบื้องแกรนิตโต้'],
                area_name: 'ห้องน้ำชั้น 2 (Bathroom 2F)',
                items: [
                    { name: 'งานรื้อถอนสุขภัณฑ์เดิม กระเบื้องพื้น-ผนัง พร้อมขนทิ้ง', qty: 20, unit: 'ตร.ม.', price: 250, days: 2, tech: 'สมศักดิ์ ช่างเอก (ทีมรื้อถอน)' },
                    { name: 'งานเดินท่อประปา PPR น้ำดี-น้ำทิ้ง และวางแนวระบายน้ำ', qty: 1, unit: 'จุด', price: 6500, days: 2, tech: 'ชาญชัย ช่างประปา' },
                    { name: 'งานทากันซึมซีเมนต์ยืดหยุ่น Ceraflex 3 ชั้น พร้อมเทสขังน้ำ', qty: 24, unit: 'ตร.ม.', price: 420, days: 2, tech: 'มานพ ช่างเทคนิค' },
                    { name: 'งานปูกระเบื้องพื้นกันลื่น R11 และผนัง 60x60 cm', qty: 28, unit: 'ตร.ม.', price: 650, days: 4, tech: 'มานพ ช่างกระเบื้อง' },
                    { name: 'งานติดตั้งสุขภัณฑ์ Cotto, อ่างล้างหน้า, ฉากกั้นกระจกนิรภัย', qty: 1, unit: 'ชุด', price: 8500, days: 2, tech: 'อนุชา ช่างติดตั้ง' }
                ]
            },
            {
                sub_type: 'ต่อเติมเคาน์เตอร์ครัว คสล. และบิวท์อินตู้แขวน',
                services: ['งานต่อเติมห้องครัว คสล.', 'งานบิวท์อินเคาน์เตอร์ครัว', 'งานระบบท่อดักไขมัน'],
                area_name: 'ห้องครัวหลังบ้าน (Kitchen Area)',
                items: [
                    { name: 'งานสกัดพื้นเดิม ก่ออิฐมวลเบา หล่อเคาน์เตอร์คอนกรีต คสล.', qty: 6, unit: 'เมตร', price: 3800, days: 3, tech: 'สมบัติ ช่างปูน' },
                    { name: 'งานปูท็อปหินแกรนิตดำแอฟริกา พร้อมเจาะช่องเตาและอ่างซิงค์', qty: 6, unit: 'เมตร', price: 2400, days: 2, tech: 'ธวัชชัย ช่างหิน' },
                    { name: 'งานเดินท่อน้ำดี ท่อน้ำทิ้ง และติดตั้งถังดักไขมันใต้ซิงค์', qty: 1, unit: 'ระบบ', price: 5500, days: 2, tech: 'ชาญชัย ช่างประปา' },
                    { name: 'งานติดตั้งบานซิงค์ ตู้แขวนบิวท์อิน และลิ้นชัก Soft-close', qty: 1, unit: 'ชุด', price: 16500, days: 3, tech: 'วิศรุต ช่างไม้' },
                    { name: 'งานติดตั้งฮูดดูดควัน ท่อระบายอากาศสแตนเลส และเตาแก๊สฝัง', qty: 1, unit: 'ชุด', price: 4500, days: 1, tech: 'อนุชา ช่างติดตั้ง' }
                ]
            },
            {
                sub_type: 'รีโนเวทห้องนั่งเล่น ปูพื้นไม้ SPC และฝ้าเพดานหลืบไฟซ่อน',
                services: ['งานปูพื้นไม้ SPC ลายไม้โอ๊ค', 'งานฝ้าเพดานหลืบไฟซ่อน LED', 'งานทาสีห้องนั่งเล่น'],
                area_name: 'ห้องนั่งเล่นชั้น 1 (Living Room)',
                items: [
                    { name: 'งานปรับระดับพื้น Self-leveling ก่อนปูพื้น SPC หนา 5mm', qty: 45, unit: 'ตร.ม.', price: 220, days: 2, tech: 'สมศักดิ์ ช่างเอก' },
                    { name: 'งานติดตั้งพื้นไม้ SPC Click-lock พร้อมโฟมรอง EVA หนา 1mm', qty: 45, unit: 'ตร.ม.', price: 590, days: 3, tech: 'สมบัติ ช่างพื้น' },
                    { name: 'งานโครงคร่าวฝ้าฉาบเรียบ ซ่อนรางไฟ LED Strip รอบห้อง', qty: 35, unit: 'ตร.ม.', price: 750, days: 3, tech: 'พงษ์พันธ์ ช่างฝ้า' },
                    { name: 'งานเดินสายไฟ ร้อยท่อขาว พร้อมสวิตช์ Dimmer ไฟซ่อน', qty: 8, unit: 'จุด', price: 650, days: 2, tech: 'ชาญชัย ช่างไฟฟ้า' },
                    { name: 'งานทาสีรองพื้นปูนเก่าและทาสีทับหน้ากึ่งเงา TOA Supershield', qty: 120, unit: 'ตร.ม.', price: 140, days: 3, tech: 'มานพ ช่างสี' }
                ]
            },
            {
                sub_type: 'กั้นห้องนอนกระจกโครงอลูมิเนียม Black Powder Coat และติดแอร์',
                services: ['งานกั้นห้องกระจกอลูมิเนียม', 'งานติดตั้งแอร์ Inverter 24000 BTU', 'งานม่านม้วนกันแสง'],
                area_name: 'ห้องนอนต่อเติมชั้น 2 (Master Bedroom)',
                items: [
                    { name: 'งานติดตั้งโครงอลูมิเนียมหนา 1.5mm อบดำ Powder Coated', qty: 18, unit: 'ตร.ม.', price: 1800, days: 2, tech: 'วิชัย ช่างอลูมิเนียม' },
                    { name: 'งานติดตั้งกระจกนิรภัย Laminate หนา 8mm ตัดแสง UV', qty: 18, unit: 'ตร.ม.', price: 1200, days: 2, tech: 'วิชัย ช่างกระจก' },
                    { name: 'งานติดตั้งประตูบานเลื่อน 3 ตอน พร้อมชุดรางเลื่อน Soft-close', qty: 1, unit: 'ชุด', price: 8500, days: 1, tech: 'สมบัติ ช่างเอก' },
                    { name: 'งานติดตั้งแอร์ Daikin Inverter 24000 BTU พร้อมท่อทองแดง', qty: 1, unit: 'เครื่อง', price: 4500, days: 1, tech: 'อนุชา ช่างแอร์' }
                ]
            }
        ];
        // Status breakdown for 20 Renovate Jobs:
        // ALL 20: NEW (รอรับงาน - มี BOQ ครบถ้วน เพื่อแปลงเข้า Gantt เริ่มต้นใหม่)
        const rStatuses = [
            'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW',
            'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW'
        ];
        let rInserted = 0;
        const baseDate = new Date('2026-09-29T08:00:00.000Z');
        for (let i = 0; i < 20; i++) {
            const cust = customers[i];
            const template = rProjectsCatalog[i % rProjectsCatalog.length];
            const status = rStatuses[i];
            const jobIdx = i + 1;
            const jobNo = `JOB-R26090${String(jobIdx).padStart(2, '0')}`;
            const bookingNo = `BK-R2609-${String(jobIdx).padStart(3, '0')}`;
            const ticketNo = status !== 'NEW' ? `TKT-R2609-${String(jobIdx).padStart(3, '0')}` : null;
            const areaId = `AREA_R_${jobIdx}_1`;
            // Build BOQ Items
            let boqSubtotal = 0;
            const boqItems = template.items.map((item, itIdx) => {
                const total = item.qty * item.price;
                boqSubtotal += total;
                return {
                    id: `boq_r_${jobIdx}_${itIdx + 1}`,
                    item_code: `BOQ-R${String(jobIdx).padStart(2, '0')}-0${itIdx + 1}`,
                    name: item.name,
                    description: item.name,
                    task_name: item.name,
                    category: template.area_name,
                    area_name: template.area_name,
                    area_id: areaId,
                    qty: item.qty,
                    unit: item.unit,
                    unit_price: item.price,
                    price: item.price,
                    labor_cost: Math.round(total * 0.45),
                    material_cost: Math.round(total * 0.55),
                    total_amount: total,
                    amount: total,
                    duration_days: item.days,
                    assigned_tech: item.tech
                };
            });
            const boqDiscount = i % 3 === 0 ? 1500 : 0;
            const boqGrandTotal = Math.max(0, boqSubtotal - boqDiscount);
            // Build Tasks for Gantt Chart (Mapped 1-to-1 from BOQ items)
            let currentDayOffset = 0;
            const tasks = boqItems.map((boq, itIdx) => {
                const taskStartDate = new Date(baseDate.getTime() + (currentDayOffset * 86400000));
                const taskEndDate = new Date(taskStartDate.getTime() + ((boq.duration_days - 1) * 86400000));
                currentDayOffset += boq.duration_days;
                let taskStatus = 'PLANNED';
                let progressPercent = 0;
                if (status === 'COMPLETED') {
                    taskStatus = 'PASSED';
                    progressPercent = 100;
                }
                else if (status === 'IN_PROGRESS') {
                    if (itIdx === 0) {
                        taskStatus = 'PASSED';
                        progressPercent = 100;
                    }
                    else if (itIdx === 1) {
                        taskStatus = 'IN_PROGRESS';
                        progressPercent = 50;
                    }
                    else {
                        taskStatus = 'PLANNED';
                        progressPercent = 0;
                    }
                }
                return {
                    id: `T_R_${jobIdx}_${itIdx + 1}`,
                    job_id: jobIdx,
                    job_no: jobNo,
                    booking_no: bookingNo,
                    customer_name: cust.name,
                    service_type: template.sub_type,
                    area_id: areaId,
                    area_name: template.area_name,
                    assigned_qc: 'วิชัย ตรวจดี (ช่าง QC Lead)',
                    task_name: boq.name,
                    assigned_tech: boq.assigned_tech,
                    tech: boq.assigned_tech,
                    plan_start_date: taskStartDate.toISOString().slice(0, 10),
                    plan_end_date: taskEndDate.toISOString().slice(0, 10),
                    duration_days: boq.duration_days,
                    status: taskStatus,
                    progress_percent: progressPercent,
                    unit: boq.unit,
                    qty: boq.qty,
                    unit_price: boq.unit_price,
                    total_price: boq.total_amount
                };
            });
            const areas = [
                {
                    id: areaId,
                    name: template.area_name,
                    assigned_qc: 'วิชัย ตรวจดี (ช่าง QC Lead)',
                    status: status === 'COMPLETED' ? 'PASSED' : status === 'IN_PROGRESS' ? 'IN_PROGRESS' : 'PLANNED',
                    created_at: baseDate.toISOString()
                }
            ];
            const customerObj = {
                name: cust.name,
                phone: cust.phone,
                address: cust.address,
                branch: cust.branch,
                store_code: cust.store_code
            };
            const overallProgress = status === 'COMPLETED' ? 100 : status === 'IN_PROGRESS' ? 35 : 0;
            const pmtAccepted = status !== 'NEW';
            const planDate = baseDate.toISOString().slice(0, 10);
            const createdAt = new Date(baseDate.getTime() - (20 - i) * 3600000).toISOString();
            const photoPreset = qPhotoPresets[i % qPhotoPresets.length];
            const uploadTime = new Date(baseDate.getTime() - (20 - i) * 3600000).toISOString();
            const rPhotos = [
                {
                    id: `photo_r_${jobIdx}_before`,
                    slot_id: 'before',
                    tag: 'before',
                    label: '1. ก่อนเริ่มงาน',
                    url: photoPreset.before,
                    name: `before_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: 'สมศักดิ์ สายตรวจ (AE) (รับงานต้นทาง Step 1)',
                    gps_verified: true,
                    note: 'สภาพพื้นที่หน้างานจริงก่อนเริ่มรีโนเวท ตรวจสอบโครงสร้างเดิมเรียบร้อย'
                },
                {
                    id: `photo_r_${jobIdx}_during1`,
                    slot_id: 'progress1',
                    tag: 'progress1',
                    label: '2. ระหว่างทำ #1',
                    url: photoPreset.during1,
                    name: `during1_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: 'สมศักดิ์ สายตรวจ (AE) (รับงานต้นทาง Step 1)',
                    gps_verified: true,
                    note: 'สภาพพื้นที่และจุดเตรียมงานก่อสร้าง/รื้อถอน'
                },
                {
                    id: `photo_r_${jobIdx}_during2`,
                    slot_id: 'progress2',
                    tag: 'progress2',
                    label: '3. ระหว่างทำ #2',
                    url: photoPreset.during2,
                    name: `during2_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: 'สมศักดิ์ สายตรวจ (AE) (รับงานต้นทาง Step 1)',
                    gps_verified: true,
                    note: 'จุดเชื่อมต่องานระบบและแนวท่อ'
                },
                {
                    id: `photo_r_${jobIdx}_testing`,
                    slot_id: 'testing',
                    tag: 'testing',
                    label: '4. ตรวจสอบ/ทดสอบ',
                    url: photoPreset.testing,
                    name: `testing_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: 'สมศักดิ์ สายตรวจ (AE) (รับงานต้นทาง Step 1)',
                    gps_verified: true,
                    note: 'การตรวจสอบจุดสำคัญก่อนเริ่มงานตาม BOQ'
                },
                {
                    id: `photo_r_${jobIdx}_after`,
                    slot_id: 'after',
                    tag: 'after',
                    label: '5. หลังทำเสร็จ',
                    url: photoPreset.after,
                    name: `after_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: 'สมศักดิ์ สายตรวจ (AE) (รับงานต้นทาง Step 1)',
                    gps_verified: true,
                    note: 'ภาพพื้นที่อ้างอิงเปรียบเทียบมาตรฐาน'
                }
            ];
            await client.query(`
        INSERT INTO core_jobs (
          id, job_no, external_ref_id, booking_no, ticket_no, customer_id, customer_name, customer_phone,
          customer_address, status, job_type, property_type, project_type, project_sub_type, store_code,
          agent_name, assigned_tech, plan_date, services, overall_progress, special_instructions, additional_notes,
          customer_data, tasks, photos, boq_items, boq_discount, boq_subtotal, boq_grand_total, pmt_accepted,
          pmt_accepted_at, step3_confirmed, areas, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35
        );
      `, [
                jobIdx,
                jobNo,
                `INT-R-2026-${String(jobIdx).padStart(3, '0')}`,
                bookingNo,
                ticketNo,
                jobIdx,
                cust.name,
                cust.phone,
                cust.address,
                status,
                'R', // job_type: R
                'บ้านเดี่ยว 2 ชั้น',
                'Renovate',
                template.sub_type,
                cust.store_code,
                'สมศักดิ์ สายตรวจ (AE)',
                'Team A (สมศักดิ์)',
                planDate,
                JSON.stringify(template.services),
                overallProgress,
                'พื้นที่พร้อมเริ่มงาน ตรวจสอบจุดขนย้ายเศษวัสดุ และประสานงานนิติบุคคลเรียบร้อย',
                'มีรายการ BOQ แนบครบถ้วน พร้อมดึงเข้าระบบ Gantt-chart และกระจายงานสู่ทีมช่าง',
                JSON.stringify(customerObj),
                JSON.stringify((status === 'NEW' || !pmtAccepted) ? [] : tasks),
                JSON.stringify(rPhotos), // R jobs have 5 intake photos received from Step 1
                JSON.stringify(boqItems),
                boqDiscount,
                boqSubtotal,
                boqGrandTotal,
                pmtAccepted,
                pmtAccepted ? createdAt : null,
                pmtAccepted,
                JSON.stringify((status === 'NEW' || !pmtAccepted) ? [] : areas),
                createdAt,
                createdAt
            ]);
            rInserted++;
        }
        // =========================================================================
        // 3. BUILD 20 QUICK SERVICE JOBS (งาน Q) — ALL WITH FULL QC PHOTOS ATTACHED
        // =========================================================================
        console.log('[SEED-40] Generating 20 Quick Service Jobs (งาน Q) with complete QC Photos attached...');
        const qServicesCatalog = [
            {
                sub_type: 'บริการ Q - ติดตั้งแอร์ติดผนัง Inverter 18000 BTU พร้อมรางครอบท่อ',
                services: ['บริการ Q - ติดตั้งแอร์ติดผนัง Inverter 18000 BTU พร้อมรางครอบท่อ'],
                tech: 'วิชัย ช่างแอร์ (ทีม Q-01)',
                notes: 'ติดตั้งแอร์และแวคคั่มระบบน้ำยา 30 นาที วัดกระแสไฟ 4.8A ปกติ ลมเย็นฉ่ำ'
            },
            {
                sub_type: 'บริการ Q - ติดตั้งเครื่องทำน้ำอุ่น Stiebel Eltron 4500W พร้อมสายดิน',
                services: ['บริการ Q - ติดตั้งเครื่องทำน้ำอุ่น Stiebel Eltron 4500W พร้อมสายดิน'],
                tech: 'ประเสริฐ ช่างไฟฟ้า (ทีม Q-02)',
                notes: 'ตอกหลักดินทองแดง 2.4 เมตร วัดค่าความต้านทานดินได้ 3.2 โอห์ม ปลอดภัย 100%'
            },
            {
                sub_type: 'บริการ Q - ติดตั้งปั๊มน้ำอัตโนมัติ Mitsubishi 250W + ถัง DOS 1000L',
                services: ['บริการ Q - ติดตั้งปั๊มน้ำอัตโนมัติ Mitsubishi 250W + ถัง DOS 1000L'],
                tech: 'ชาญชัย ช่างประปา (ทีม Q-03)',
                notes: 'ติดตั้งบนฐาน คสล. พร้อมเช็ควาล์วและท่อบายพาสสแตนเลส แรงดันน้ำคงที่'
            },
            {
                sub_type: 'บริการ Q - ติดตั้งเครื่องกรองน้ำดื่ม RO 400 GPD แบบไร้ถังแรงดัน',
                services: ['บริการ Q - ติดตั้งเครื่องกรองน้ำดื่ม RO 400 GPD แบบไร้ถังแรงดัน'],
                tech: 'มานพ ช่างเทคนิค (ทีม Q-04)',
                notes: 'เจาะเคาน์เตอร์หินแกรนิตเรียบร้อย วัดค่าน้ำ TDS ขาออกได้ 8 ppm สะอาดบริสุทธิ์'
            },
            {
                sub_type: 'บริการ Q - ติดตั้ง Digital Door Lock บานเลื่อนสแกนหน้า 3D',
                services: ['บริการ Q - ติดตั้ง Digital Door Lock บานเลื่อนสแกนหน้า 3D'],
                tech: 'สมบัติ ช่างระบบ (ทีม Q-05)',
                notes: 'ติดตั้งชุดล็อคมอร์ตไลท์ สแกนใบหน้าและลายนิ้วมือผ่านฉลุย พร้อมผูกแอปมือถือ'
            }
        ];
        // Status breakdown for 20 Quick Jobs:
        // ALL 20: NEW (รอรับงาน - รูปหน้างานจาก QC/ช่างส่งมาพร้อมส่งเข้าระบบ PMT เริ่มต้นใหม่)
        const qStatuses = [
            'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW',
            'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW', 'NEW'
        ];
        let qInserted = 0;
        for (let i = 0; i < 20; i++) {
            const custIdx = 20 + i;
            const cust = customers[custIdx];
            const template = qServicesCatalog[i % qServicesCatalog.length];
            const status = qStatuses[i];
            const jobIdx = 20 + i + 1; // ID 21 to 40
            const jobNo = `JOB-Q26090${String(i + 1).padStart(2, '0')}`;
            const bookingNo = `BK-Q2609-${String(i + 1).padStart(3, '0')}`;
            const ticketNo = status !== 'NEW' ? `TKT-Q2609-${String(i + 1).padStart(3, '0')}` : null;
            const photoPreset = qPhotoPresets[i % qPhotoPresets.length];
            // Build 5 QC / Site Photos (MANDATORY FOR Q JOBS)
            const uploadTime = new Date(baseDate.getTime() - (30 - i) * 1800000).toISOString();
            const photos = [
                {
                    id: `photo_q_${jobIdx}_before`,
                    slot_id: 'before',
                    tag: 'before',
                    label: '1. ก่อนเริ่มงาน',
                    url: photoPreset.before,
                    name: `before_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: `${template.tech} (รายงานหน้างาน)`,
                    gps_verified: true,
                    note: 'สภาพพื้นที่หน้างานจริงก่อนเริ่มติดตั้ง ตรวจสอบจุดจ่ายไฟและท่อน้ำเรียบร้อย'
                },
                {
                    id: `photo_q_${jobIdx}_during1`,
                    slot_id: 'progress1',
                    tag: 'progress1',
                    label: '2. ระหว่างทำ #1',
                    url: photoPreset.during1,
                    name: `during1_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: `${template.tech} (รายงานหน้างาน)`,
                    gps_verified: true,
                    note: 'การเจาะยึด Plate ขาแขวน และเดินท่อร้อยสายไฟตามมาตรฐานความปลอดภัย'
                },
                {
                    id: `photo_q_${jobIdx}_during2`,
                    slot_id: 'progress2',
                    tag: 'progress2',
                    label: '3. ระหว่างทำ #2',
                    url: photoPreset.during2,
                    name: `during2_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: `${template.tech} (รายงานหน้างาน)`,
                    gps_verified: true,
                    note: 'การเชื่อมต่อท่อทองแดง ขันประแจปอนด์ และต่อสายดินเข้าตู้เบรกเกอร์'
                },
                {
                    id: `photo_q_${jobIdx}_test`,
                    slot_id: 'test',
                    tag: 'test',
                    label: '4. ความปลอดภัย & ทดสอบ',
                    url: photoPreset.testing,
                    name: `test_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: `${template.tech} (รายงานหน้างาน)`,
                    gps_verified: true,
                    note: 'ทดสอบระบบไฟฟ้า วัดแรงดัน 220V และกดทดสอบปุ่ม Test ELCB/RCBO ตัดไฟรั่วปกติ'
                },
                {
                    id: `photo_q_${jobIdx}_after`,
                    slot_id: 'after',
                    tag: 'after',
                    label: '5. งานเสร็จสมบูรณ์',
                    url: photoPreset.after,
                    name: `after_${jobNo}.jpg`,
                    uploaded_at: uploadTime,
                    uploaded_by: `${template.tech} (รายงานหน้างาน)`,
                    gps_verified: true,
                    note: 'ทำความสะอาดหน้างานเรียบร้อย อุปกรณ์ทำงานสมบูรณ์ 100% ส่งมอบให้ลูกค้า'
                }
            ];
            const customerObj = {
                name: cust.name,
                phone: cust.phone,
                address: cust.address,
                branch: cust.branch,
                store_code: cust.store_code
            };
            const overallProgress = status === 'COMPLETED' ? 100 : status === 'WAIT_QC' ? 80 : 0;
            const pmtAccepted = status !== 'NEW';
            const planDate = new Date(baseDate.getTime() + (i * 43200000)).toISOString().slice(0, 10);
            const createdAt = new Date(baseDate.getTime() - (20 - i) * 1800000).toISOString();
            await client.query(`
        INSERT INTO core_jobs (
          id, job_no, external_ref_id, booking_no, ticket_no, customer_id, customer_name, customer_phone,
          customer_address, status, job_type, property_type, project_type, project_sub_type, store_code,
          agent_name, assigned_tech, plan_date, services, overall_progress, special_instructions, additional_notes,
          customer_data, tasks, photos, boq_items, boq_discount, boq_subtotal, boq_grand_total, pmt_accepted,
          pmt_accepted_at, step3_confirmed, areas, qc_score, qc_passed_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8,
          $9, $10, $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20, $21, $22,
          $23, $24, $25, $26, $27, $28, $29, $30,
          $31, $32, $33, $34, $35, $36, $37
        );
      `, [
                jobIdx,
                jobNo,
                `INT-Q-2026-${String(i + 1).padStart(3, '0')}`,
                bookingNo,
                ticketNo,
                jobIdx,
                cust.name,
                cust.phone,
                cust.address,
                status,
                'Q', // job_type: Q
                'บ้านเดี่ยว / คอนโด',
                'Quick Service',
                template.sub_type,
                cust.store_code,
                'วิชัย ตรวจดี (ช่าง QC Lead)',
                template.tech,
                planDate,
                JSON.stringify(template.services),
                overallProgress,
                'ทีมช่างเข้าติดตั้งตามนัดหมาย และส่งภาพถ่าย 5 ขั้นตอนครบถ้วนเข้าระบบ PMT',
                template.notes,
                JSON.stringify(customerObj),
                JSON.stringify([]), // Fast-track: Q jobs bypass Gantt conversion
                JSON.stringify(photos), // MANDATORY: 5 QC photos attached
                JSON.stringify([]), // Q jobs don't have multi-item BOQ
                0,
                2500,
                2500,
                pmtAccepted,
                pmtAccepted ? createdAt : null,
                pmtAccepted,
                JSON.stringify([]),
                status === 'COMPLETED' ? 5.0 : null,
                status === 'COMPLETED' ? createdAt : null,
                createdAt,
                createdAt
            ]);
            qInserted++;
        }
        // Reset sequence to 41
        try {
            await client.query(`SELECT setval('core_jobs_id_seq', 40, true);`);
        }
        catch { }
        await client.query('COMMIT');
        console.log(`[SEED-40 SUCCESS] Seeded ${rInserted} Renovate (R) jobs and ${qInserted} Quick (Q) jobs.`);
        console.log(`[SEED-40 SUCCESS] Total clean records in core_jobs: ${rInserted + qInserted}. All old data wiped.`);
        return rInserted + qInserted;
    }
    catch (err) {
        await client.query('ROLLBACK');
        console.error('[SEED-40 ERROR] Failed to seed 40 mock orders:', err.message);
        throw err;
    }
    finally {
        client.release();
    }
}
// =============================================================================
// DAILY WORK LOGS & TECHNICIAN PHOTOS DB REPOSITORY
// =============================================================================
async function dbLoadDailyWorkLogs(jobId, taskId) {
    try {
        let sql = 'SELECT * FROM core_daily_work_logs';
        const params = [];
        const where = [];
        if (jobId) {
            where.push(`(
        job_id = $${params.length + 1} 
        OR job_no = $${params.length + 1} 
        OR job_id IN (SELECT job_no FROM core_jobs WHERE id::text = $${params.length + 1}) 
        OR job_no IN (SELECT job_no FROM core_jobs WHERE id::text = $${params.length + 1})
        OR job_id IN (SELECT id::text FROM core_jobs WHERE job_no = $${params.length + 1})
        OR job_no IN (SELECT job_no FROM core_jobs WHERE job_no = $${params.length + 1})
      )`);
            params.push(String(jobId));
        }
        if (taskId) {
            where.push(`(task_id = $${params.length + 1} OR task_name ILIKE $${params.length + 1})`);
            params.push(String(taskId));
        }
        if (where.length > 0) {
            sql += ' WHERE ' + where.join(' AND ');
        }
        sql += ' ORDER BY log_date DESC, id DESC';
        const res = await exports.pool.query(sql, params);
        return res.rows.map(row => ({
            ...row,
            photos: Array.isArray(row.photos) ? row.photos : []
        }));
    }
    catch (err) {
        console.error('[DB] Error loading daily work logs:', err.message);
        return [];
    }
}
async function dbSaveDailyWorkLog(log) {
    try {
        await exports.pool.query(`INSERT INTO core_daily_work_logs (
        id, job_id, job_no, task_id, task_name, log_date, start_time, end_time,
        work_hours, day_number, total_days, technician, recorded_by, reporter_role,
        progress_percent, work_description, additional_details, issues_encountered, solutions_applied,
        materials_used, photos, is_completed, is_final_day, supervisor_approved, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25
      ) ON CONFLICT (id) DO UPDATE SET
        job_id = EXCLUDED.job_id,
        job_no = EXCLUDED.job_no,
        task_id = EXCLUDED.task_id,
        task_name = EXCLUDED.task_name,
        log_date = EXCLUDED.log_date,
        start_time = EXCLUDED.start_time,
        end_time = EXCLUDED.end_time,
        work_hours = EXCLUDED.work_hours,
        day_number = EXCLUDED.day_number,
        total_days = EXCLUDED.total_days,
        technician = EXCLUDED.technician,
        recorded_by = EXCLUDED.recorded_by,
        reporter_role = EXCLUDED.reporter_role,
        progress_percent = EXCLUDED.progress_percent,
        work_description = EXCLUDED.work_description,
        additional_details = EXCLUDED.additional_details,
        issues_encountered = EXCLUDED.issues_encountered,
        solutions_applied = EXCLUDED.solutions_applied,
        materials_used = EXCLUDED.materials_used,
        photos = EXCLUDED.photos,
        is_completed = EXCLUDED.is_completed,
        is_final_day = EXCLUDED.is_final_day,
        supervisor_approved = EXCLUDED.supervisor_approved,
        updated_at = CURRENT_TIMESTAMP`, [
            log.id,
            String(log.job_id),
            log.job_no || null,
            String(log.task_id),
            log.task_name || '',
            log.log_date,
            log.start_time || '08:30',
            log.end_time || '17:00',
            log.work_hours || '8.5 ชม.',
            Number(log.day_number) || 1,
            Number(log.total_days) || 1,
            log.technician || '',
            log.recorded_by || '',
            log.reporter_role || 'TECH',
            Number(log.progress_percent) || 0,
            log.work_description || null,
            log.additional_details || null,
            log.issues_encountered || log.issues || null,
            log.solutions_applied || null,
            log.materials_used || null,
            JSON.stringify(log.photos || []),
            Boolean(log.is_completed),
            Boolean(log.is_final_day),
            Boolean(log.user_confirmed || log.supervisor_approved),
            log.created_at ? new Date(log.created_at) : new Date()
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving daily work log:', err.message);
    }
}
async function dbDeleteDailyWorkLog(id) {
    try {
        await exports.pool.query('DELETE FROM core_daily_work_logs WHERE id = $1', [id]);
    }
    catch (err) {
        console.error('[DB] Error deleting daily work log:', err.message);
    }
}
// =============================================================================
// QC BOOKINGS DB REPOSITORY
// =============================================================================
async function dbLoadQCBookings(jobId, status) {
    try {
        let sql = 'SELECT * FROM core_qc_bookings';
        const params = [];
        const where = [];
        if (jobId && jobId !== 'all') {
            where.push(`(job_id = $${params.length + 1} OR job_no = $${params.length + 1} OR job_id IN (SELECT job_no FROM core_jobs WHERE id::text = $${params.length + 1}) OR job_no IN (SELECT job_no FROM core_jobs WHERE id::text = $${params.length + 1}))`);
            params.push(String(jobId));
        }
        if (status && status !== 'all') {
            where.push(`status = $${params.length + 1}`);
            params.push(String(status));
        }
        if (where.length > 0) {
            sql += ' WHERE ' + where.join(' AND ');
        }
        sql += ' ORDER BY qc_booking_date ASC, booking_date DESC, id DESC';
        const res = await exports.pool.query(sql, params);
        return res.rows.map(row => ({
            ...row,
            checklist: Array.isArray(row.checklist) ? row.checklist : [],
            photos: Array.isArray(row.photos) ? row.photos : []
        }));
    }
    catch (err) {
        console.error('[DB] Error loading QC bookings:', err.message);
        return [];
    }
}
async function dbSaveQCBooking(booking) {
    try {
        await exports.pool.query(`INSERT INTO core_qc_bookings (
        id, job_id, job_no, customer_name, booking_date, time_slot, technician_name,
        qc_inspector, status, checklist, notes, photos, task_id, task_name,
        plan_start_date, plan_end_date, qc_booking_date, days_before, assigned_tech,
        assigned_qc_tech, confirmed_at, confirmed_by, remarks
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      ) ON CONFLICT (id) DO UPDATE SET
        job_id = EXCLUDED.job_id,
        job_no = EXCLUDED.job_no,
        customer_name = EXCLUDED.customer_name,
        booking_date = EXCLUDED.booking_date,
        time_slot = EXCLUDED.time_slot,
        technician_name = EXCLUDED.technician_name,
        qc_inspector = EXCLUDED.qc_inspector,
        status = EXCLUDED.status,
        checklist = EXCLUDED.checklist,
        notes = EXCLUDED.notes,
        photos = EXCLUDED.photos,
        task_id = EXCLUDED.task_id,
        task_name = EXCLUDED.task_name,
        plan_start_date = EXCLUDED.plan_start_date,
        plan_end_date = EXCLUDED.plan_end_date,
        qc_booking_date = EXCLUDED.qc_booking_date,
        days_before = EXCLUDED.days_before,
        assigned_tech = EXCLUDED.assigned_tech,
        assigned_qc_tech = EXCLUDED.assigned_qc_tech,
        confirmed_at = EXCLUDED.confirmed_at,
        confirmed_by = EXCLUDED.confirmed_by,
        remarks = EXCLUDED.remarks,
        updated_at = CURRENT_TIMESTAMP`, [
            booking.id,
            String(booking.job_id),
            booking.job_no || null,
            booking.customer_name || '',
            booking.booking_date || booking.qc_booking_date || new Date().toISOString().slice(0, 10),
            booking.time_slot || 'เช้า (09:00 - 12:00)',
            booking.technician_name || booking.assigned_tech || '',
            booking.qc_inspector || booking.assigned_qc_tech || '',
            booking.status || 'PENDING',
            JSON.stringify(booking.checklist || []),
            booking.notes || booking.remarks || null,
            JSON.stringify(booking.photos || []),
            booking.task_id ? String(booking.task_id) : null,
            booking.task_name || '',
            booking.plan_start_date || null,
            booking.plan_end_date || null,
            booking.qc_booking_date || null,
            Number(booking.days_before) || 5,
            booking.assigned_tech || '',
            booking.assigned_qc_tech || '',
            booking.confirmed_at ? new Date(booking.confirmed_at) : null,
            booking.confirmed_by || null,
            booking.remarks || null
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving QC booking:', err.message);
    }
}
async function dbDeleteQCBookingByTask(taskId) {
    try {
        await exports.pool.query('DELETE FROM core_qc_bookings WHERE task_id = $1 OR id = $1', [String(taskId)]);
    }
    catch (err) {
        console.error('[DB] Error deleting QC booking by task:', err.message);
    }
}
async function dbConfirmQCBooking(id, qcTech, confirmedBy, remarks, bookingDate) {
    try {
        const res = await exports.pool.query(`UPDATE core_qc_bookings 
       SET status = 'CONFIRMED', 
           confirmed_at = CURRENT_TIMESTAMP,
           assigned_qc_tech = COALESCE($2, assigned_qc_tech),
           confirmed_by = COALESCE($3, confirmed_by),
           remarks = COALESCE($4, remarks),
           qc_booking_date = COALESCE($5, qc_booking_date),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 OR task_id = $1 OR job_id = $1
       RETURNING *`, [id, qcTech || null, confirmedBy || null, remarks || null, bookingDate || null]);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB] Error confirming QC booking:', err.message);
        return null;
    }
}
async function dbRevertQCBooking(id) {
    try {
        const res = await exports.pool.query(`UPDATE core_qc_bookings 
       SET status = 'PENDING_CONFIRM', 
           confirmed_at = NULL,
           confirmed_by = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 OR task_id = $1 OR job_id = $1
       RETURNING *`, [id]);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB] Error reverting QC booking:', err.message);
        return null;
    }
}
// =============================================================================
// MA CONTRACTS & ROUNDS DB REPOSITORY
// =============================================================================
async function dbLoadMAContracts() {
    try {
        const res = await exports.pool.query(`
      SELECT c.*, 
        COUNT(r.id) FILTER (WHERE r.status = 'Completed') AS completed_rounds,
        COUNT(r.id) AS total_rounds_count
      FROM ma_contracts c
      LEFT JOIN ma_rounds r ON r.contract_id = c.id
      GROUP BY c.id
      ORDER BY c.contract_start_date DESC, c.created_at DESC
    `);
        return res.rows.map(row => ({
            ...row,
            service_items: Array.isArray(row.service_items) ? row.service_items : [],
            completed_rounds: Number(row.completed_rounds) || 0,
            total_rounds_count: Number(row.total_rounds_count) || Number(row.total_rounds) || 0
        }));
    }
    catch (err) {
        console.error('[DB] Error loading MA contracts:', err.message);
        return [];
    }
}
async function dbGetMAContract(id) {
    try {
        const contractRes = await exports.pool.query('SELECT * FROM ma_contracts WHERE id = $1 LIMIT 1', [id]);
        if (contractRes.rows.length === 0)
            return null;
        const contract = contractRes.rows[0];
        const roundsRes = await exports.pool.query('SELECT * FROM ma_rounds WHERE contract_id = $1 ORDER BY round_number ASC', [id]);
        const rounds = roundsRes.rows;
        const completedRounds = rounds.filter(r => r.status === 'Completed').length;
        return {
            ...contract,
            service_items: Array.isArray(contract.service_items) ? contract.service_items : [],
            total_rounds_count: rounds.length > 0 ? rounds.length : (contract.total_rounds || 0),
            completed_rounds: completedRounds,
            rounds
        };
    }
    catch (err) {
        console.error('[DB] Error getting MA contract:', err.message);
        return null;
    }
}
async function dbSaveMAContract(contract) {
    try {
        await exports.pool.query(`INSERT INTO ma_contracts (
        id, contract_no, customer_id, customer_site_id, customer_name, customer_phone,
        site_name, site_address, service_type, service_items, frequency_months,
        total_rounds, contract_start_date, contract_end_date, contract_value,
        status, notes, created_by
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
      ) ON CONFLICT (id) DO UPDATE SET
        contract_no = EXCLUDED.contract_no,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        site_name = EXCLUDED.site_name,
        site_address = EXCLUDED.site_address,
        service_type = EXCLUDED.service_type,
        service_items = EXCLUDED.service_items,
        frequency_months = EXCLUDED.frequency_months,
        total_rounds = EXCLUDED.total_rounds,
        contract_start_date = EXCLUDED.contract_start_date,
        contract_end_date = EXCLUDED.contract_end_date,
        contract_value = EXCLUDED.contract_value,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP`, [
            contract.id,
            contract.contract_no,
            contract.customer_id ? Number(contract.customer_id) : null,
            contract.customer_site_id ? Number(contract.customer_site_id) : null,
            contract.customer_name || '',
            contract.customer_phone || '',
            contract.site_name || '',
            contract.site_address || '',
            contract.service_type || '',
            JSON.stringify(contract.service_items || []),
            contract.frequency_months || 3,
            contract.total_rounds || 4,
            contract.contract_start_date,
            contract.contract_end_date || null,
            contract.contract_value || 0,
            contract.status || 'Active',
            contract.notes || null,
            contract.created_by || 'system'
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving MA contract:', err.message);
    }
}
async function dbDeleteMAContract(id) {
    try {
        await exports.pool.query('DELETE FROM ma_rounds WHERE contract_id = $1', [id]);
        await exports.pool.query('DELETE FROM ma_contracts WHERE id = $1', [id]);
    }
    catch (err) {
        console.error('[DB] Error deleting MA contract:', err.message);
    }
}
async function dbLoadMARounds(contractId) {
    try {
        let sql = 'SELECT * FROM ma_rounds';
        const params = [];
        if (contractId) {
            sql += ' WHERE contract_id = $1';
            params.push(contractId);
        }
        sql += ' ORDER BY scheduled_date ASC, round_number ASC';
        const res = await exports.pool.query(sql, params);
        return res.rows;
    }
    catch (err) {
        console.error('[DB] Error loading MA rounds:', err.message);
        return [];
    }
}
async function dbSaveMARound(round) {
    try {
        await exports.pool.query(`INSERT INTO ma_rounds (
        id, contract_id, project_id, round_number, scheduled_date, actual_date, status, technician_id, notes
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9
      ) ON CONFLICT (id) DO UPDATE SET
        contract_id = EXCLUDED.contract_id,
        project_id = EXCLUDED.project_id,
        round_number = EXCLUDED.round_number,
        scheduled_date = EXCLUDED.scheduled_date,
        actual_date = EXCLUDED.actual_date,
        status = EXCLUDED.status,
        technician_id = EXCLUDED.technician_id,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP`, [
            round.id,
            round.contract_id,
            round.project_id ? Number(round.project_id) : null,
            round.round_number || 1,
            round.scheduled_date,
            round.actual_date || null,
            round.status || 'Scheduled',
            round.technician_id || null,
            round.notes || null
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving MA round:', err.message);
    }
}
async function dbUpdateMARound(id, updates) {
    try {
        const setClauses = [];
        const values = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
            if (['status', 'scheduled_date', 'actual_date', 'notes', 'technician_id'].includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val);
            }
        }
        if (setClauses.length === 0)
            return;
        setClauses.push('updated_at = CURRENT_TIMESTAMP');
        values.push(id);
        await exports.pool.query(`UPDATE ma_rounds SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
    }
    catch (err) {
        console.error('[DB] Error updating MA round:', err.message);
    }
}
// =============================================================================
// INBOUND API LOGS DB REPOSITORY
// =============================================================================
async function dbSaveApiLog(log) {
    try {
        await exports.pool.query(`INSERT INTO inbound_api_logs (id, timestamp, method, path, ip, status, duration_ms, headers, body, response_body)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (id) DO UPDATE SET
         status = EXCLUDED.status,
         duration_ms = EXCLUDED.duration_ms,
         response_body = EXCLUDED.response_body`, [
            log.id,
            log.timestamp ? new Date(log.timestamp) : new Date(),
            log.method || 'GET',
            log.path || '',
            log.ip || '',
            Number(log.status) || 200,
            Number(log.duration_ms) || 0,
            JSON.stringify(log.headers || {}),
            JSON.stringify(log.body || null),
            JSON.stringify(log.response_body || null),
        ]);
    }
    catch (err) {
        // Avoid noisy recursion
    }
}
async function dbLoadApiLogs(filters) {
    try {
        let sql = 'SELECT * FROM inbound_api_logs';
        const params = [];
        const where = [];
        if (filters?.method && filters.method !== 'ALL') {
            where.push(`method = $${params.length + 1}`);
            params.push(filters.method.toUpperCase());
        }
        if (filters?.status && filters.status !== 'ALL') {
            if (filters.status === '2xx') {
                where.push(`status >= 200 AND status < 300`);
            }
            else if (filters.status === '4xx') {
                where.push(`status >= 400 AND status < 500`);
            }
            else if (filters.status === '5xx') {
                where.push(`status >= 500`);
            }
            else {
                const sc = Number(filters.status);
                if (!isNaN(sc)) {
                    where.push(`status = $${params.length + 1}`);
                    params.push(sc);
                }
            }
        }
        if (filters?.search) {
            const q = `%${filters.search.toLowerCase()}%`;
            where.push(`(LOWER(path) LIKE $${params.length + 1} OR LOWER(ip) LIKE $${params.length + 1} OR LOWER(method) LIKE $${params.length + 1})`);
            params.push(q);
        }
        if (where.length > 0) {
            sql += ' WHERE ' + where.join(' AND ');
        }
        sql += ' ORDER BY timestamp DESC';
        const limit = Math.min(Number(filters?.limit) || 200, 500);
        sql += ` LIMIT ${limit}`;
        const res = await exports.pool.query(sql, params);
        return res.rows.map(row => ({
            ...row,
            timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : new Date().toISOString()
        }));
    }
    catch (err) {
        console.error('[DB] Error loading api logs:', err.message);
        return [];
    }
}
async function dbDeleteApiLogs() {
    try {
        await exports.pool.query('DELETE FROM inbound_api_logs');
    }
    catch (err) {
        console.error('[DB] Error clearing api logs:', err.message);
    }
}
// =============================================================================
// STAGING SURVEY REPORTS DB REPOSITORY
// =============================================================================
async function dbSaveStagingReport(report) {
    try {
        await exports.pool.query(`INSERT INTO staging_survey_reports (
        id, source_job_id, job_number, booking_no, ticket_no, source_reference,
        customer_code, customer_name, customer_phone, store_code, agent_code,
        visit_date, checkin_at, checkout_at, photo_count, raw_payload,
        process_status, converted_job_id, retry_count, validation_errors, error_message,
        received_at, processed_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23
      ) ON CONFLICT (id) DO UPDATE SET
        source_job_id = EXCLUDED.source_job_id,
        job_number = EXCLUDED.job_number,
        booking_no = EXCLUDED.booking_no,
        ticket_no = EXCLUDED.ticket_no,
        source_reference = EXCLUDED.source_reference,
        customer_code = EXCLUDED.customer_code,
        customer_name = EXCLUDED.customer_name,
        customer_phone = EXCLUDED.customer_phone,
        store_code = EXCLUDED.store_code,
        agent_code = EXCLUDED.agent_code,
        visit_date = EXCLUDED.visit_date,
        checkin_at = EXCLUDED.checkin_at,
        checkout_at = EXCLUDED.checkout_at,
        photo_count = EXCLUDED.photo_count,
        raw_payload = EXCLUDED.raw_payload,
        process_status = EXCLUDED.process_status,
        converted_job_id = EXCLUDED.converted_job_id,
        retry_count = EXCLUDED.retry_count,
        validation_errors = EXCLUDED.validation_errors,
        error_message = EXCLUDED.error_message,
        processed_at = EXCLUDED.processed_at`, [
            report.id,
            report.source_job_id || null,
            report.job_number,
            report.booking_no || null,
            report.ticket_no || null,
            report.source_reference || null,
            report.customer_code || null,
            report.customer_name || '',
            report.customer_phone || '',
            report.store_code || null,
            report.agent_code || null,
            report.visit_date || null,
            report.checkin_at || null,
            report.checkout_at || null,
            Number(report.photo_count) || 0,
            JSON.stringify(report.raw_payload || {}),
            report.process_status || 'PENDING',
            report.converted_job_id ? Number(report.converted_job_id) : null,
            Number(report.retry_count) || 0,
            JSON.stringify(report.validation_errors || []),
            report.error_message || null,
            report.received_at ? new Date(report.received_at) : new Date(),
            report.processed_at ? new Date(report.processed_at) : null
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving staging survey report:', err.message);
    }
}
async function dbLoadStagingReports(filters) {
    try {
        let sql = 'SELECT * FROM staging_survey_reports';
        const params = [];
        const where = [];
        if (filters?.status) {
            where.push(`process_status = $${params.length + 1}`);
            params.push(filters.status);
        }
        if (filters?.search) {
            const q = `%${filters.search.toLowerCase()}%`;
            where.push(`(LOWER(job_number) LIKE $${params.length + 1} OR LOWER(customer_name) LIKE $${params.length + 1} OR LOWER(booking_no) LIKE $${params.length + 1})`);
            params.push(q);
        }
        if (where.length > 0) {
            sql += ' WHERE ' + where.join(' AND ');
        }
        sql += ' ORDER BY received_at DESC, id DESC';
        const res = await exports.pool.query(sql, params);
        return res.rows.map(row => ({
            ...row,
            id: Number(row.id),
            converted_job_id: row.converted_job_id ? Number(row.converted_job_id) : undefined,
            validation_errors: Array.isArray(row.validation_errors) ? row.validation_errors : undefined,
            received_at: row.received_at ? new Date(row.received_at).toISOString() : new Date().toISOString(),
            processed_at: row.processed_at ? new Date(row.processed_at).toISOString() : undefined
        }));
    }
    catch (err) {
        console.error('[DB] Error loading staging reports:', err.message);
        return [];
    }
}
async function dbGetStagingReport(id) {
    try {
        const res = await exports.pool.query('SELECT * FROM staging_survey_reports WHERE id::text = $1 OR source_job_id = $1 LIMIT 1', [String(id)]);
        if (res.rows.length === 0)
            return null;
        const row = res.rows[0];
        return {
            ...row,
            id: Number(row.id),
            converted_job_id: row.converted_job_id ? Number(row.converted_job_id) : undefined,
            validation_errors: Array.isArray(row.validation_errors) ? row.validation_errors : undefined,
            received_at: row.received_at ? new Date(row.received_at).toISOString() : new Date().toISOString(),
            processed_at: row.processed_at ? new Date(row.processed_at).toISOString() : undefined
        };
    }
    catch (err) {
        console.error('[DB] Error getting staging report:', err.message);
        return null;
    }
}
async function dbUpdateStagingReport(id, updates) {
    try {
        const setClauses = [];
        const values = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
            if (['process_status', 'error_message'].includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val);
            }
            else if (key === 'converted_job_id') {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val ? Number(val) : null);
            }
            else if (key === 'retry_count') {
                setClauses.push(`${key} = $${idx++}`);
                values.push(Number(val));
            }
            else if (key === 'validation_errors') {
                setClauses.push(`${key} = $${idx++}`);
                values.push(JSON.stringify(val));
            }
            else if (key === 'processed_at') {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val ? new Date(val) : null);
            }
        }
        if (setClauses.length === 0)
            return;
        values.push(String(id));
        await exports.pool.query(`UPDATE staging_survey_reports SET ${setClauses.join(', ')} WHERE id::text = $${idx}`, values);
    }
    catch (err) {
        console.error('[DB] Error updating staging report:', err.message);
    }
}
// =============================================================================
// CORE BLUEPRINTS (แบบแปลนโครงการ Step 2 Design)
// =============================================================================
async function dbLoadBlueprints(jobId) {
    try {
        let query = 'SELECT * FROM core_blueprints';
        const params = [];
        if (jobId && jobId !== 'all') {
            query += ' WHERE (job_id = $1 OR job_id IN (SELECT job_no FROM core_jobs WHERE id::text = $1))';
            params.push(String(jobId));
        }
        query += ' ORDER BY created_at DESC';
        const res = await exports.pool.query(query, params);
        return res.rows.map(row => ({
            id: row.id,
            jobId: row.job_id,
            job_id: row.job_id,
            customerName: row.customer_name || '',
            fileName: row.file_name,
            zone: row.zone || '',
            roomZone: row.room_zone || row.zone || '',
            version: row.version,
            fileSize: row.file_size || '',
            fileType: row.file_type || '',
            notes: row.notes || '',
            previewImg: row.preview_img || null,
            version_history: Array.isArray(row.version_history) ? row.version_history : [],
            uploadedAt: row.uploaded_at || '',
            createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
            created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
        }));
    }
    catch (err) {
        console.error('[DB] Error loading blueprints:', err.message);
        return [];
    }
}
async function dbSaveBlueprint(bp) {
    try {
        const id = bp.id || `BP-${Date.now()}`;
        const jobId = String(bp.jobId || bp.job_id || '');
        const customerName = bp.customerName || bp.customer_name || '';
        const fileName = bp.fileName || bp.file_name || 'blueprint.pdf';
        const zone = bp.zone || bp.roomZone || '';
        const roomZone = bp.roomZone || bp.zone || '';
        const version = bp.version || 'v1.0 (แบบร่าง)';
        const fileSize = bp.fileSize || bp.file_size || '';
        const fileType = bp.fileType || bp.file_type || 'pdf';
        const notes = bp.notes || '';
        const previewImg = bp.previewImg || bp.preview_img || null;
        const versionHistory = Array.isArray(bp.version_history) ? bp.version_history : [];
        const uploadedAt = bp.uploadedAt || bp.uploaded_at || '';
        await exports.pool.query(`INSERT INTO core_blueprints (
        id, job_id, customer_name, file_name, zone, room_zone, version, file_size, file_type, notes, preview_img, version_history, uploaded_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        job_id = EXCLUDED.job_id,
        customer_name = EXCLUDED.customer_name,
        file_name = EXCLUDED.file_name,
        zone = EXCLUDED.zone,
        room_zone = EXCLUDED.room_zone,
        version = EXCLUDED.version,
        file_size = EXCLUDED.file_size,
        file_type = EXCLUDED.file_type,
        notes = EXCLUDED.notes,
        preview_img = EXCLUDED.preview_img,
        version_history = EXCLUDED.version_history,
        uploaded_at = EXCLUDED.uploaded_at,
        updated_at = CURRENT_TIMESTAMP`, [
            id, jobId, customerName, fileName, zone, roomZone, version, fileSize, fileType,
            notes, previewImg, JSON.stringify(versionHistory), uploadedAt
        ]);
        return { ...bp, id };
    }
    catch (err) {
        console.error('[DB] Error saving blueprint:', err.message);
        throw err;
    }
}
async function dbUpdateBlueprint(id, updates) {
    try {
        const setClauses = [];
        const values = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
            if (['version', 'file_name', 'fileName', 'zone', 'room_zone', 'roomZone', 'notes', 'uploaded_at', 'uploadedAt', 'file_size', 'fileSize'].includes(key)) {
                const col = key === 'fileName' ? 'file_name' : (key === 'roomZone' ? 'room_zone' : (key === 'uploadedAt' ? 'uploaded_at' : (key === 'fileSize' ? 'file_size' : key)));
                setClauses.push(`${col} = $${idx++}`);
                values.push(val);
            }
            else if (key === 'previewImg' || key === 'preview_img') {
                setClauses.push(`preview_img = $${idx++}`);
                values.push(val);
            }
            else if (key === 'version_history') {
                setClauses.push(`version_history = $${idx++}`);
                values.push(JSON.stringify(val));
            }
        }
        if (setClauses.length === 0)
            return null;
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(String(id));
        const res = await exports.pool.query(`UPDATE core_blueprints SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`, values);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB] Error updating blueprint:', err.message);
        return null;
    }
}
async function dbDeleteBlueprint(id) {
    try {
        await exports.pool.query('DELETE FROM core_blueprints WHERE id = $1', [String(id)]);
        return true;
    }
    catch (err) {
        console.error('[DB] Error deleting blueprint:', err.message);
        return false;
    }
}
// =============================================================================
// CORE TICKETS (ตั๋วใบเสร็จ & สัญญาโครงการ Step 2 & 4)
// =============================================================================
async function dbLoadTickets(jobId) {
    try {
        let query = 'SELECT * FROM core_tickets';
        const params = [];
        if (jobId && jobId !== 'all') {
            query += ' WHERE job_id = $1';
            params.push(String(jobId));
        }
        query += ' ORDER BY created_at DESC';
        const res = await exports.pool.query(query, params);
        return res.rows.map(row => ({
            id: row.id,
            ticket_no: row.ticket_no,
            receipt_no: row.receipt_no || '',
            contract_no: row.contract_no || '',
            job_id: row.job_id,
            jobId: row.job_id,
            customer_name: row.customer_name || '',
            service: row.service || '',
            amount: Number(row.amount) || 0,
            payment_date: row.payment_date || '',
            payment_method: row.payment_method || '',
            slip_url: row.slip_url || '',
            slip_name: row.slip_name || '',
            contract_url: row.contract_url || '',
            contract_name: row.contract_name || '',
            status: row.status || 'VERIFIED',
            notes: row.notes || '',
            created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
        }));
    }
    catch (err) {
        console.error('[DB] Error loading tickets:', err.message);
        return [];
    }
}
async function dbSaveTicket(tkt) {
    try {
        const id = tkt.id || `TKT-${Date.now()}`;
        const ticketNo = tkt.ticket_no || `TK-${Date.now()}`;
        const receiptNo = tkt.receipt_no || '';
        const contractNo = tkt.contract_no || '';
        const jobId = String(tkt.job_id || tkt.jobId || '');
        const customerName = tkt.customer_name || tkt.customer || '';
        const service = tkt.service || '';
        const amount = Number(tkt.amount) || 0;
        const paymentDate = tkt.payment_date || '';
        const paymentMethod = tkt.payment_method || '';
        const slipUrl = tkt.slip_url || '';
        const slipName = tkt.slip_name || '';
        const contractUrl = tkt.contract_url || '';
        const contractName = tkt.contract_name || '';
        const status = tkt.status || 'VERIFIED';
        const notes = tkt.notes || '';
        await exports.pool.query(`INSERT INTO core_tickets (
        id, ticket_no, receipt_no, contract_no, job_id, customer_name, service, amount, payment_date, payment_method, slip_url, slip_name, contract_url, contract_name, status, notes, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        ticket_no = EXCLUDED.ticket_no,
        receipt_no = EXCLUDED.receipt_no,
        contract_no = EXCLUDED.contract_no,
        job_id = EXCLUDED.job_id,
        customer_name = EXCLUDED.customer_name,
        service = EXCLUDED.service,
        amount = EXCLUDED.amount,
        payment_date = EXCLUDED.payment_date,
        payment_method = EXCLUDED.payment_method,
        slip_url = EXCLUDED.slip_url,
        slip_name = EXCLUDED.slip_name,
        contract_url = EXCLUDED.contract_url,
        contract_name = EXCLUDED.contract_name,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        updated_at = CURRENT_TIMESTAMP`, [
            id, ticketNo, receiptNo, contractNo, jobId, customerName, service, amount,
            paymentDate, paymentMethod, slipUrl, slipName, contractUrl, contractName, status, notes
        ]);
        return { ...tkt, id, ticket_no: ticketNo };
    }
    catch (err) {
        console.error('[DB] Error saving ticket:', err.message);
        throw err;
    }
}
async function dbUpdateTicket(id, updates) {
    try {
        const setClauses = [];
        const values = [];
        let idx = 1;
        for (const [key, val] of Object.entries(updates)) {
            if (['ticket_no', 'receipt_no', 'contract_no', 'customer_name', 'service', 'payment_date', 'payment_method', 'slip_url', 'slip_name', 'contract_url', 'contract_name', 'status', 'notes'].includes(key)) {
                setClauses.push(`${key} = $${idx++}`);
                values.push(val);
            }
            else if (key === 'amount') {
                setClauses.push(`amount = $${idx++}`);
                values.push(Number(val) || 0);
            }
        }
        if (setClauses.length === 0)
            return null;
        setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
        values.push(String(id));
        const res = await exports.pool.query(`UPDATE core_tickets SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`, values);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB] Error updating ticket:', err.message);
        return null;
    }
}
async function dbDeleteTicket(id) {
    try {
        await exports.pool.query('DELETE FROM core_tickets WHERE id = $1', [String(id)]);
        return true;
    }
    catch (err) {
        console.error('[DB] Error deleting ticket:', err.message);
        return false;
    }
}
