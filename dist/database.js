"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDatabaseConnected = exports.pool = void 0;
exports.initDatabase = initDatabase;
exports.dbLoadUsers = dbLoadUsers;
exports.dbGetUser = dbGetUser;
exports.dbSaveUser = dbSaveUser;
exports.dbUpdateUser = dbUpdateUser;
exports.dbDeleteUser = dbDeleteUser;
exports.dbSaveLoginLog = dbSaveLoginLog;
exports.dbLoadLoginLogs = dbLoadLoginLogs;
exports.mapDbJobRow = mapDbJobRow;
exports.dbLoadJobs = dbLoadJobs;
exports.dbGetJob = dbGetJob;
exports.dbSaveJob = dbSaveJob;
exports.dbUpdateJob = dbUpdateJob;
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
exports.dbLoadMAContracts = dbLoadMAContracts;
exports.dbGetMAContract = dbGetMAContract;
exports.dbSaveMAContract = dbSaveMAContract;
exports.dbDeleteMAContract = dbDeleteMAContract;
exports.dbLoadMARounds = dbLoadMARounds;
exports.dbSaveMARound = dbSaveMARound;
exports.dbUpdateMARound = dbUpdateMARound;
const pg_1 = require("pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// PostgreSQL Connection Pool
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:EsQShpeaGvSr21I5ieQGJRmCELp78GSlQn6hQHAIjbTnY4c1aWw56JleGierEk2t@187.77.147.16:5432/spmt_db';
exports.pool = new pg_1.Pool({
    connectionString,
    ssl: false,
    max: 20,
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
      CREATE TABLE IF NOT EXISTS core_jobs (
        id SERIAL PRIMARY KEY,
        job_no VARCHAR(50) UNIQUE NOT NULL,
        external_ref_id VARCHAR(100),
        booking_no VARCHAR(100),
        ticket_no VARCHAR(100),
        customer_id INT,
        status VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        job_type VARCHAR(50) DEFAULT 'quick',
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

      ALTER TABLE core_jobs 
        ADD COLUMN IF NOT EXISTS boq_items JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS boq_discount NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS boq_subtotal NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS boq_grand_total NUMERIC DEFAULT 0,
        ADD COLUMN IF NOT EXISTS pmt_accepted BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS pmt_accepted_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS step3_confirmed BOOLEAN DEFAULT FALSE,
        ADD COLUMN IF NOT EXISTS qc_inspection_type VARCHAR(50),
        ADD COLUMN IF NOT EXISTS qc_passed_at TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS csat_score NUMERIC DEFAULT NULL,
        ADD COLUMN IF NOT EXISTS csat_remarks TEXT,
        ADD COLUMN IF NOT EXISTS csat_photos JSONB DEFAULT '[]'::jsonb,
        ADD COLUMN IF NOT EXISTS csat_surveyor VARCHAR(150),
        ADD COLUMN IF NOT EXISTS csat_evaluated_at TIMESTAMP WITH TIME ZONE;

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
    `);
        // 2. Ensure default users exist in sys_users
        await client.query(`
      INSERT INTO sys_users (user_code, username, email, full_name, role, password_hash, is_active)
      VALUES 
        ('USR-001B', 'isarachootip@gmail.com', 'isarachootip@gmail.com', 'Isara Chootip', 'ADMIN', '$2a$12$demo_df4740268cae8dd415b3c396825c0ff1800f16f0b48db929c426639bcf469bfd', true)
      ON CONFLICT (username) DO NOTHING;
    `);
        client.release();
        console.log('[DB] Core tables verified / created in spmt_db.');
        return true;
    }
    catch (err) {
        console.warn('[DB WARNING] Could not initialize PostgreSQL tables, running in-memory fallback:', err.message);
        exports.isDatabaseConnected = false;
        return false;
    }
}
// =============================================================================
// USERS & AUTH DB REPOSITORY
// =============================================================================
async function dbLoadUsers() {
    if (!exports.isDatabaseConnected)
        return [];
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
    if (!exports.isDatabaseConnected)
        return null;
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
    if (!exports.isDatabaseConnected)
        return;
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
    if (!exports.isDatabaseConnected)
        return;
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
    if (!exports.isDatabaseConnected)
        return;
    try {
        await exports.pool.query('DELETE FROM sys_users WHERE id::text = $1 OR user_code = $1', [String(id)]);
    }
    catch (err) {
        console.error('[DB] Error deleting user:', err.message);
    }
}
async function dbSaveLoginLog(log) {
    if (!exports.isDatabaseConnected)
        return;
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
    if (!exports.isDatabaseConnected)
        return [];
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
    const primaryService = (Array.isArray(row.services) && row.services[0]) || row.project_sub_type || 'งานติดตั้ง';
    return {
        ...row,
        id: row.job_no || `JOB-${row.id}`,
        jobId: row.id,
        job_no: row.job_no,
        external_ref_id: row.external_ref_id,
        customer: customerFullName,
        customer_data: cust,
        firstName: cust.first_name || (customerFullName.replace(/^คุณ/, '').trim().split(' ')[0] || ''),
        lastName: cust.last_name || (customerFullName.replace(/^คุณ/, '').trim().split(' ').slice(1).join(' ') || ''),
        phone: cust.phone || '',
        address: cust.address || '',
        lat: cust.lat || 13.7563,
        lng: cust.lng || 100.5018,
        service: primaryService,
        services: Array.isArray(row.services) ? row.services : [primaryService],
        status: row.status || 'DRAFT',
        date: row.plan_date || (row.created_at ? new Date(row.created_at).toISOString().split('T')[0] : '2026-09-08'),
        progress: row.overall_progress || 0,
        tech: row.assigned_tech || 'Team A (สมศักดิ์)',
        special_instructions: row.special_instructions || '',
        additional_notes: row.additional_notes || '',
        photos: Array.isArray(row.photos) ? row.photos : [],
        tasks: Array.isArray(row.tasks) ? row.tasks : [],
        boq_items: Array.isArray(row.boq_items) ? row.boq_items : [],
        boq_discount: Number(row.boq_discount) || 0,
        boq_subtotal: Number(row.boq_subtotal) || 0,
        boq_grand_total: Number(row.boq_grand_total) || 0,
        pmt_accepted: row.pmt_accepted !== undefined ? row.pmt_accepted : (row.status !== 'DRAFT' && row.status !== 'NEW'),
        pmt_accepted_at: row.pmt_accepted_at || null,
        step3_confirmed: Boolean(row.step3_confirmed),
        qc_inspection_type: row.qc_inspection_type || null,
        qc_passed_at: row.qc_passed_at || null,
        csat_score: row.csat_score !== null && row.csat_score !== undefined ? Number(row.csat_score) : null,
        csat_remarks: row.csat_remarks || '',
        csat_photos: Array.isArray(row.csat_photos) ? row.csat_photos : [],
        csat_surveyor: row.csat_surveyor || '',
        csat_evaluated_at: row.csat_evaluated_at || null,
        job_type: row.job_type || 'quick',
        step_timestamps: row.step_timestamps || {},
        created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
    };
}
async function dbLoadJobs(filters) {
    if (!exports.isDatabaseConnected)
        return [];
    try {
        const res = await exports.pool.query('SELECT * FROM core_jobs ORDER BY created_at DESC, id DESC');
        let list = res.rows.map(mapDbJobRow);
        if (filters) {
            if (filters.status && filters.status !== 'all') {
                list = list.filter(j => j.status === filters.status);
            }
            if (filters.service && filters.service !== 'all') {
                list = list.filter(j => j.service === filters.service || (j.services && j.services.includes(filters.service)));
            }
            if (filters.search) {
                const q = String(filters.search).toLowerCase();
                list = list.filter(j => (j.id && j.id.toLowerCase().includes(q)) ||
                    (j.customer && j.customer.toLowerCase().includes(q)) ||
                    (j.phone && j.phone.includes(q)) ||
                    (j.service && j.service.toLowerCase().includes(q)));
            }
        }
        return list;
    }
    catch (err) {
        console.error('[DB] Error loading jobs:', err.message);
        return [];
    }
}
async function dbGetJob(jobNoOrId) {
    if (!exports.isDatabaseConnected)
        return null;
    try {
        const target = String(jobNoOrId);
        const res = await exports.pool.query('SELECT * FROM core_jobs WHERE job_no = $1 OR (id::text = $1) LIMIT 1', [target]);
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
    if (!exports.isDatabaseConnected)
        return;
    try {
        const customerData = job.customer_data || job.customer || {};
        await exports.pool.query(`INSERT INTO core_jobs (
        job_no, external_ref_id, booking_no, ticket_no, customer_id, status, job_type,
        step_timestamps, property_type, project_type, project_sub_type, store_code,
        agent_name, assigned_tech, plan_date, services, overall_progress,
        special_instructions, additional_notes, customer_data, tasks, photos,
        boq_items, boq_discount, boq_subtotal, boq_grand_total, pmt_accepted, pmt_accepted_at, step3_confirmed
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29
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
        tasks = EXCLUDED.tasks,
        photos = EXCLUDED.photos,
        boq_items = EXCLUDED.boq_items,
        boq_discount = EXCLUDED.boq_discount,
        boq_subtotal = EXCLUDED.boq_subtotal,
        boq_grand_total = EXCLUDED.boq_grand_total,
        pmt_accepted = EXCLUDED.pmt_accepted,
        pmt_accepted_at = EXCLUDED.pmt_accepted_at,
        step3_confirmed = EXCLUDED.step3_confirmed,
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
            JSON.stringify(job.tasks || []),
            JSON.stringify(job.photos || []),
            JSON.stringify(job.boq_items || []),
            Number(job.boq_discount) || 0,
            Number(job.boq_subtotal) || 0,
            Number(job.boq_grand_total) || 0,
            Boolean(job.pmt_accepted),
            job.pmt_accepted_at ? new Date(job.pmt_accepted_at) : null,
            Boolean(job.step3_confirmed)
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving job:', err.message);
    }
}
async function dbUpdateJob(jobNoOrId, updates) {
    if (!exports.isDatabaseConnected)
        return null;
    try {
        const target = String(jobNoOrId);
        const setClauses = [];
        const values = [];
        let idx = 1;
        const jsonbFields = ['step_timestamps', 'services', 'customer_data', 'tasks', 'photos', 'boq_items', 'csat_photos'];
        const stringFields = [
            'external_ref_id', 'booking_no', 'ticket_no', 'status', 'job_type',
            'property_type', 'project_type', 'project_sub_type', 'store_code',
            'agent_name', 'assigned_tech', 'plan_date', 'special_instructions',
            'additional_notes', 'qc_inspection_type', 'csat_remarks', 'csat_surveyor'
        ];
        const numFields = ['customer_id', 'overall_progress', 'boq_discount', 'boq_subtotal', 'boq_grand_total', 'csat_score'];
        const boolFields = ['pmt_accepted', 'step3_confirmed'];
        const dateFields = ['pmt_accepted_at', 'qc_passed_at', 'csat_evaluated_at'];
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
        return await dbGetJob(jobNoOrId);
    }
    catch (err) {
        console.error('[DB] Error updating job:', err.message);
        return null;
    }
}
async function dbDeleteJob(jobNoOrId) {
    if (!exports.isDatabaseConnected)
        return;
    try {
        const isId = typeof jobNoOrId === 'number' || !isNaN(Number(jobNoOrId));
        const whereCol = isId ? 'id' : 'job_no';
        await exports.pool.query(`DELETE FROM core_jobs WHERE ${whereCol} = $1`, [jobNoOrId]);
    }
    catch (err) {
        console.error('[DB] Error deleting job:', err.message);
    }
}
async function dbResetJobStatus() {
    if (!exports.isDatabaseConnected)
        return 0;
    try {
        const res = await exports.pool.query(`
      UPDATE core_jobs 
      SET status = 'DRAFT', 
          overall_progress = 0, 
          pmt_accepted = false, 
          pmt_accepted_at = null,
          step3_confirmed = false,
          tasks = '[]'::jsonb,
          photos = '[]'::jsonb,
          boq_items = '[]'::jsonb,
          updated_at = CURRENT_TIMESTAMP;
    `);
        await exports.pool.query('DELETE FROM core_daily_work_logs;');
        await exports.pool.query('DELETE FROM core_qc_bookings;');
        return res.rowCount || 0;
    }
    catch (err) {
        console.error('[DB] Error resetting job status:', err.message);
        return 0;
    }
}
async function dbWipeAllTransactions() {
    if (!exports.isDatabaseConnected)
        return;
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
// 16 Mock Jobs Data Generator for INT simulation (8 Quick, 8 Renovate)
async function dbSeedMockJobs() {
    if (!exports.isDatabaseConnected)
        return 0;
    const mockCustomers = [
        { id: 1, customer_code: 'CUST-001', first_name: 'ภาคิน', last_name: 'วรโชติเมธี', phone: '081-912-3456', address: '88/15 หมู่บ้านเซนโทร รามอินทรา-จตุโชติ แขวงออเงิน เขตสายไหม กรุงเทพฯ 10220', lat: 13.8892, lng: 100.6721 },
        { id: 2, customer_code: 'CUST-002', first_name: 'ณัฐนพิน', last_name: 'รัตนวิบูลย์', phone: '092-823-4567', address: '142/36 โครงการ เดอะ แกรนด์ พระราม 2 ตำบลพันท้ายนรสิงห์ อำเภอเมืองสมุทรสาคร สมุทรสาคร 74000', lat: 13.5824, lng: 100.3789 },
        { id: 3, customer_code: 'CUST-003', first_name: 'ชวินท์', last_name: 'ก้องธนภัทร', phone: '086-734-5678', address: '29/88 คอนโด ไอดีโอ คิว จุฬา-สามย่าน ถนนพระราม 4 แขวงสี่พระยา เขตบางรัก กรุงเทพฯ 10500', lat: 13.7315, lng: 100.5284 },
        { id: 4, customer_code: 'CUST-004', first_name: 'ลภัสรดา', last_name: 'สิริวัฒนกุล', phone: '095-645-6789', address: '512/18 หมู่บ้านเศรษฐสิริ กรุงเทพกรีฑา แขวงหัวหมาก เขตบางกะปิ กรุงเทพฯ 10240', lat: 13.7512, lng: 100.6845 },
        { id: 5, customer_code: 'CUST-005', first_name: 'ภัทรดนัย', last_name: 'อัครโยธิน', phone: '083-556-7890', address: '63/4 ทาวน์โฮม บ้านกลางเมือง ลาดพร้าว-เสรีไทย แขวงคลองกุ่ม เขตบึงกุ่ม กรุงเทพฯ 10240', lat: 13.7845, lng: 100.6698 },
        { id: 6, customer_code: 'CUST-006', first_name: 'นภัสสร', last_name: 'บุญญานุวัตร', phone: '091-467-8901', address: '189/27 หมู่บ้านเพอร์เฟค เพลส รังสิต-ทางด่วนบางพูน ตำบลบ้านกลาง อำเภอเมืองปทุมธานี ปทุมธานี 12000', lat: 13.9921, lng: 100.5784 },
        { id: 7, customer_code: 'CUST-007', first_name: 'ภูมิภัทร', last_name: 'ชาญปรีชา', phone: '087-378-9012', address: '75/10 อาคารพาณิชย์ 4 ชั้น ถนนเพชรเกษม แขวงบางหว้า เขตภาษีเจริญ กรุงเทพฯ 10160', lat: 13.7145, lng: 100.4489 },
        { id: 8, customer_code: 'CUST-008', first_name: 'วริศรา', last_name: 'กิตติโภคิน', phone: '084-289-0123', address: '450/92 คอนโด แอชตัน สีลม ถนนสีลม แขวงสุริยวงศ์ เขตบางรัก กรุงเทพฯ 10500', lat: 13.7258, lng: 100.5267 },
        { id: 9, customer_code: 'CUST-009', first_name: 'เอกภาพ', last_name: 'พงษ์ศิริพาณิชย์', phone: '098-190-1234', address: '310/55 หมู่บ้านมัณฑนา ราชพฤกษ์-นครอินทร์ ตำบลบางขุนกอง อำเภอบางกรวย นนทบุรี 11130', lat: 13.8245, lng: 100.4412 },
        { id: 10, customer_code: 'CUST-010', first_name: 'กัญญารัตน์', last_name: 'โสภณพิทักษ์', phone: '089-091-2345', address: '99/124 หมู่บ้านสราญสิริ ชัยพฤกษ์-แจ้งวัฒนะ ตำบลบางพลับ อำเภอปากเกร็ด นนทบุรี 11120', lat: 13.9245, lng: 100.4789 },
        { id: 11, customer_code: 'CUST-011', first_name: 'ธนพล', last_name: 'วรเกียรติกุล', phone: '085-902-3456', address: '204/18 โครงการ แกรนด์ บางกอก บูเลอวาร์ด สาทร-กัลปพฤกษ์ แขวงบางแค เขตบางแค กรุงเทพฯ 10160', lat: 13.6985, lng: 100.4125 },
        { id: 12, customer_code: 'CUST-012', first_name: 'นันทิกานต์', last_name: 'เตชะไพบูลย์', phone: '093-813-4567', address: '77/205 คอนโด เดอะ ริทซ์-คาร์ลตัน เรสซิเดนเซส บางกอก ถนนนราธิวาสราชนครินทร์ แขวงสีลม เขตบางรัก กรุงเทพฯ 10500', lat: 13.7234, lng: 100.5298 },
        { id: 13, customer_code: 'CUST-013', first_name: 'ปัณณธร', last_name: 'พัฒนประเสริฐ', phone: '082-724-5678', address: '120/45 หมู่บ้านวิลเลจจิโอ ประชาอุทิศ 90 ตำบลแหลมฟ้าผ่า อำเภอพระสมุทรเจดีย์ สมุทรปราการ 10290', lat: 13.5982, lng: 100.5124 },
        { id: 14, customer_code: 'CUST-014', first_name: 'มนัสชนก', last_name: 'ศรีวิชัยพฤกษ์', phone: '096-635-6789', address: '38/66 ทาวน์โฮม พาทิโอ แจ้งวัฒนะ-เมืองทองธานี ตำบลคลองเกลือ อำเภอปากเกร็ด นนทบุรี 11120', lat: 13.9124, lng: 100.5489 },
        { id: 15, customer_code: 'CUST-015', first_name: 'รัชชานนท์', last_name: 'เมธาบวรกุล', phone: '080-546-7890', address: '155/12 หมู่บ้านบุราสิริ พัฒนาการ แขวงประเวศ เขตประเวศ กรุงเทพฯ 10250', lat: 13.7189, lng: 100.6712 },
        { id: 16, customer_code: 'CUST-016', first_name: 'พิชญ์สินี', last_name: 'อัครวิวัฒน์', phone: '094-457-8901', address: '620/14 อาคารโฮมออฟฟิศ 4 ชั้น ถนนนวลจันทร์ แขวงนวลจันทร์ เขตบึงกุ่ม กรุงเทพฯ 10230', lat: 13.8214, lng: 100.6458 }
    ];
    const mockJobs = [
        {
            id: 1, job_no: 'JOB202609001', external_ref_id: 'INT-2026-001', customer_id: 1, status: 'NEW', job_type: 'quick',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Installation',
            project_sub_type: 'ติดตั้งระบบโซลาร์เซลล์ On-Grid ขนาด 5kW พร้อม Microinverter Enphase และระบบ Smart Monitoring',
            assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-08',
            services: ['ติดตั้งระบบโซลาร์เซลล์ On-Grid ขนาด 5kW พร้อม Microinverter Enphase และระบบ Smart Monitoring'],
            overall_progress: 0,
            special_instructions: 'ตรวจเช็คโครงสร้างหลังคาซีแพคโมเนียก่อนขึ้นติดตั้งแผงโซลาร์ และประสานงานขอขนานไฟ กฟน.',
            additional_notes: 'สายไฟ DC Solar PV1-F ขนาด 4 sq.mm. พร้อมท่อร้อยสาย EMT และตู้ Combiner Box ป้องกันเสิร์จ AC/DC'
        },
        {
            id: 2, job_no: 'JOB202609002', external_ref_id: 'INT-2026-002', customer_id: 2, status: 'NEW', job_type: 'renovate',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Renovate',
            project_sub_type: 'รีโนเวทห้องครัวไทยด้านนอก สไตล์ Modern Loft เคาน์เตอร์ปูนเปลือยขัดมันพร้อมเตาแก๊สฝังและเครื่องดูดควัน 1600 m3/h',
            assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-08',
            services: ['รีโนเวทห้องครัวไทยด้านนอก สไตล์ Modern Loft เคาน์เตอร์ปูนเปลือยขัดมันพร้อมเตาแก๊สฝังและเครื่องดูดควัน 1600 m3/h'],
            overall_progress: 0,
            special_instructions: 'วางระบบท่อดักไขมันใต้ซิงค์ล้างจาน ต่อท่อระบายควันออกเหนือหลังคาไม่อยู่ในทิศทางลมพัดเข้าบ้านข้างเคียง',
            additional_notes: 'ปูกระเบื้องผนัง Subway Tile เช็ดล้างทำความสะอาดคราบน้ำมันง่าย พื้นกระเบื้องแกรนิตโต้ผิวด้านกันลื่น R10'
        },
        {
            id: 3, job_no: 'JOB202609003', external_ref_id: 'INT-2026-003', customer_id: 3, status: 'NEW', job_type: 'quick',
            property_type: 'คอนโดมิเนียม', project_type: 'Installation',
            project_sub_type: 'ติดตั้งเครื่องฟอกอากาศระบบ Fresh Air ฝังฝ้า พร้อมระบบท่อลมระบายอากาศลดฝุ่น PM2.5 และ CO2',
            assigned_tech: 'Team C (วิชัย)', plan_date: '2026-09-09',
            services: ['ติดตั้งเครื่องฟอกอากาศระบบ Fresh Air ฝังฝ้า พร้อมระบบท่อลมระบายอากาศลดฝุ่น PM2.5 และ CO2'],
            overall_progress: 0,
            special_instructions: 'เจาะช่องผนังภายนอกสำหรับท่อระบายลมต้องใช้หัวเพชร Coring กันฝุ่นฟุ้งกระจายในห้องชุด',
            additional_notes: 'ใช้เครื่องแลกเปลี่ยนความร้อน ERV อัตราการไหล 150 CMH ตัวกรอง HEPA H13 ดักฝุ่น 99.95%'
        },
        {
            id: 4, job_no: 'JOB202609004', external_ref_id: 'INT-2026-004', customer_id: 4, status: 'NEW', job_type: 'renovate',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Renovate',
            project_sub_type: 'ต่อเติมหลังคาโรงจอดรถโครงสร้างเหล็กกล่องกัลวาไนซ์ แผ่น Shinkolite ป้องกันรังสี UV พร้อมรางน้ำสแตนเลสซ่อนขอบ',
            assigned_tech: 'Team D (กิตติศักดิ์)', plan_date: '2026-09-09',
            services: ['ต่อเติมหลังคาโรงจอดรถโครงสร้างเหล็กกล่องกัลวาไนซ์ แผ่น Shinkolite ป้องกันรังสี UV พร้อมรางน้ำสแตนเลสซ่อนขอบ'],
            overall_progress: 0,
            special_instructions: 'ลงเสาเข็มสปันไมโครไพล์ Spun Micropile 4 จุด เพื่อป้องกันการทรุดเอียงในระยะยาว',
            additional_notes: 'แผ่นอะคริลิก Shinkolite รุ่น Heat Cut กรองความร้อนได้ 60% ยึดด้วยระบบ EPDM Rubber Gasket ป้องกันรั่วซึม 100%'
        },
        {
            id: 5, job_no: 'JOB202609005', external_ref_id: 'INT-2026-005', customer_id: 5, status: 'NEW', job_type: 'quick',
            property_type: 'ทาวน์โฮม 3 ชั้น', project_type: 'Installation',
            project_sub_type: 'ติดตั้งเครื่องกรองน้ำดื่มระบบ RO อุตสาหกรรมในครัวเรือน 400 GPD แบบไร้ถังแรงดัน พร้อมก๊อกน้ำ Smart Faucet',
            assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-10',
            services: ['ติดตั้งเครื่องกรองน้ำดื่มระบบ RO อุตสาหกรรมในครัวเรือน 400 GPD แบบไร้ถังแรงดัน พร้อมก๊อกน้ำ Smart Faucet'],
            overall_progress: 0,
            special_instructions: 'เจาะท็อปเคาน์เตอร์หินแกรนิตด้วยหัวเจาะกระเบื้องอย่างระมัดระวัง ตรวจเช็คค่าน้ำ TDS ขาเข้าและขาออก',
            additional_notes: 'แรงดันน้ำประปาขั้นต่ำ 2.5 บาร์ ติดตั้งระบบกรองคาร์บอนบล็อกและ Post-Carbon สกัดกลิ่นคลอรีนสมบูรณ์แบบ'
        },
        {
            id: 6, job_no: 'JOB202609006', external_ref_id: 'INT-2026-006', customer_id: 6, status: 'NEW', job_type: 'renovate',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Renovate',
            project_sub_type: 'รีโนเวทห้องน้ำ Master Bathroom สไตล์ Minimal Luxury รื้ออ่างเดิมติดตั้งอ่างอาบน้ำลอยตัวและกระจกกั้นโซนเปียกฉากทอง',
            assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-10',
            services: ['รีโนเวทห้องน้ำ Master Bathroom สไตล์ Minimal Luxury รื้ออ่างเดิมติดตั้งอ่างอาบน้ำลอยตัวและกระจกกั้นโซนเปียกฉากทอง'],
            overall_progress: 0,
            special_instructions: 'ทำระบบกันซึมสูตรซีเมนต์ 3 ชั้น รอแห้งตัวทดสอบขังน้ำ 48 ชั่วโมงก่อนปูกระเบื้องหินอ่อน Porcelain 60x120 ซม.',
            additional_notes: 'ท่อน้ำทิ้งดักกลิ่น P-Trap ทองเหลืองแท้ ผนังซ่อนไฟ LED Warm White 3000K พร้อมสวิตช์หรี่แสง'
        },
        {
            id: 7, job_no: 'JOB202609007', external_ref_id: 'INT-2026-007', customer_id: 7, status: 'NEW', job_type: 'quick',
            property_type: 'อาคารพาณิชย์ 4 ชั้น', project_type: 'Installation',
            project_sub_type: 'ติดตั้งระบบกล้องวงจรปิด IP Camera 4K AI Human Detection 8 จุด พร้อมเครื่องบันทึก NVR และตู้ Rack POE',
            assigned_tech: 'Team D (กิตติศักดิ์)', plan_date: '2026-09-11',
            services: ['ติดตั้งระบบกล้องวงจรปิด IP Camera 4K AI Human Detection 8 จุด พร้อมเครื่องบันทึก NVR และตู้ Rack POE'],
            overall_progress: 0,
            special_instructions: 'เดินสาย LAN Cat6 ชนิด Shielded ร้อยท่อขาวขนานแนวกำแพง เซ็ตอัพระบบดูออนไลน์ผ่านมือถือให้เจ้าของบ้าน',
            additional_notes: 'Harddisk เกรดกล้องวงจรปิด 6TB สำรองภาพได้ 30 วัน พร้อมระบบแจ้งเตือน Line Notify ทันทีเมื่อตรวจพบบุคคลแปลกหน้า'
        },
        {
            id: 8, job_no: 'JOB202609008', external_ref_id: 'INT-2026-008', customer_id: 8, status: 'NEW', job_type: 'renovate',
            property_type: 'คอนโดมิเนียม', project_type: 'Renovate',
            project_sub_type: 'รีโนเวทระเบียงห้องชุดคอนโด ปูพื้นกระเบื้องลายไม้กันน้ำ ติดตั้งระแนงบังตาอลูมิเนียมลายไม้และสวนแนวตั้งระบบรดน้ำอัตโนมัติ',
            assigned_tech: 'Team C (วิชัย)', plan_date: '2026-09-11',
            services: ['รีโนเวทระเบียงห้องชุดคอนโด ปูพื้นกระเบื้องลายไม้กันน้ำ ติดตั้งระแนงบังตาอลูมิเนียมลายไม้และสวนแนวตั้งระบบรดน้ำอัตโนมัติ'],
            overall_progress: 0,
            special_instructions: 'ตรวจสอบกฎระเบียบของนิติบุคคลคอนโดเรื่องสีระแนงและความสูงของต้นไม้ก่อนเริ่มติดตั้งจริง',
            additional_notes: 'ใช้วัสดุระแนงอลูมิเนียมเคลือบอบสี Powder Coat ทนแดด ทนฝน ไม่เป็นสนิม ติดตั้งระบบท่อน้ำหยดตั้งเวลา Smart Timer'
        },
        {
            id: 9, job_no: 'JOB202609009', external_ref_id: 'INT-2026-009', customer_id: 9, status: 'NEW', job_type: 'quick',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Installation',
            project_sub_type: 'ติดตั้งมอเตอร์ประตูรั้วรีโมทอัตโนมัติแบบ DC High-Speed รองรับเปิด-ปิดด้วยแอป Smart Home และระบบสำรองไฟ',
            assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-12',
            services: ['ติดตั้งมอเตอร์ประตูรั้วรีโมทอัตโนมัติแบบ DC High-Speed รองรับเปิด-ปิดด้วยแอป Smart Home และระบบสำรองไฟ'],
            overall_progress: 0,
            special_instructions: 'ทดสอบระบบเซนเซอร์กันหนีบ Safety Photocell 2 ระดับ ทั้งตอนเปิดและปิดประตูรั้ว',
            additional_notes: 'มอเตอร์รับน้ำหนักประตู 1,000 กก. ระบบ Slow-down นุ่มนวล แบตเตอรี่สำรองเปิดปิดได้ต่อเนื่อง 40 ครั้งขณะไฟดับ'
        },
        {
            id: 10, job_no: 'JOB202609010', external_ref_id: 'INT-2026-010', customer_id: 10, status: 'NEW', job_type: 'renovate',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Renovate',
            project_sub_type: 'รีโนเวทห้องนั่งเล่นและห้องรับแขก Built-in ผนังตกแต่งลายหินอ่อน Bookmatch ซ่อนไฟหลืบและตู้โชว์โครงอลูมิเนียมกระจกชาทอง',
            assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-12',
            services: ['รีโนเวทห้องนั่งเล่นและห้องรับแขก Built-in ผนังตกแต่งลายหินอ่อน Bookmatch ซ่อนไฟหลืบและตู้โชว์โครงอลูมิเนียมกระจกชาทอง'],
            overall_progress: 0,
            special_instructions: 'วัดระดับแนวดิ่งและแนวราบด้วยเลเซอร์ความแม่นยำสูง ปูผ้าใบคลุมเฟอร์นิเจอร์และพื้นไม้ปาร์เกต์เดิมอย่างหนาแน่น',
            additional_notes: 'แผ่นลายหินอ่อนอะคริลิกไฮกลอสไร้รอยต่อ บานพับ Soft Close แบรนด์ Blum รับประกันการใช้งาน 10 ปี'
        },
        {
            id: 11, job_no: 'JOB202609011', external_ref_id: 'INT-2026-011', customer_id: 11, status: 'NEW', job_type: 'quick',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Installation',
            project_sub_type: 'ติดตั้งเครื่องทำน้ำอุ่นระบบดิจิทัล 4500W พร้อมชุดฝักบัว Rain Shower ปรับระดับและระบบตัดไฟนิรภัย ELCB แบบคู่',
            assigned_tech: 'Team C (วิชัย)', plan_date: '2026-09-13',
            services: ['ติดตั้งเครื่องทำน้ำอุ่นระบบดิจิทัล 4500W พร้อมชุดฝักบัว Rain Shower ปรับระดับและระบบตัดไฟนิรภัย ELCB แบบคู่'],
            overall_progress: 0,
            special_instructions: 'ตรวจเช็คหลักดิน (Ground Rod) ยาว 2.4 เมตร วัดค่าความต้านทานดินไม่เกิน 5 โอห์มตามมาตรฐาน วสท.',
            additional_notes: 'เดินสายเมนทองแดง THW 4 sq.mm. เบรกเกอร์ควบคุม RCBO 20A แยกอิสระจากตู้โหลดเซ็นเตอร์'
        },
        {
            id: 12, job_no: 'JOB202609012', external_ref_id: 'INT-2026-012', customer_id: 12, status: 'NEW', job_type: 'renovate',
            property_type: 'คอนโดมิเนียม ดูเพล็กซ์', project_type: 'Renovate',
            project_sub_type: 'รีโนเวทห้องทำงานส่วนตัว Acoustic Home Studio บุผนังและฝ้าซับเสียง Rockwool พร้อมติดตั้งแผ่น Acoustic Diffuser ไม้แท้',
            assigned_tech: 'Team D (กิตติศักดิ์)', plan_date: '2026-09-13',
            services: ['รีโนเวทห้องทำงานส่วนตัว Acoustic Home Studio บุผนังและฝ้าซับเสียง Rockwool พร้อมติดตั้งแผ่น Acoustic Diffuser ไม้แท้'],
            overall_progress: 0,
            special_instructions: 'งานบุฉนวนต้องสวมชุดป้องกันมิดชิด ขนย้ายวัสดุขึ้นอาคารตามรอบเวลาของนิติบุคคล 10:00 - 15:00 น.',
            additional_notes: 'ลดเสียงก้องและกันเสียงรบกวนออกภายนอกได้ถึง STC 55 ประตูกันเสียงแบบ Double Seal และช่องแอร์ซ่อนแดมเปอร์ลดเสียงลม'
        },
        {
            id: 13, job_no: 'JOB202609013', external_ref_id: 'INT-2026-013', customer_id: 13, status: 'NEW', job_type: 'quick',
            property_type: 'ทาวน์โฮม 2 ชั้น', project_type: 'Installation',
            project_sub_type: 'ติดตั้งเครื่องปรับอากาศ Inverter 24,000 BTU เบอร์ 5 สามดาว พร้อมเดินท่อน้ำยาหุ้มฉนวน Aeroflex และรางครอบท่อพรีเมียม',
            assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-14',
            services: ['ติดตั้งเครื่องปรับอากาศ Inverter 24,000 BTU เบอร์ 5 สามดาว พร้อมเดินท่อน้ำยาหุ้มฉนวน Aeroflex และรางครอบท่อพรีเมียม'],
            overall_progress: 0,
            special_instructions: 'แวคคั่มระบบสูญญากาศนาน 30 นาที และตรวจสอบแรงดันน้ำยา R32 ให้ได้มาตรฐานก่อนส่งมอบงาน',
            additional_notes: 'ขาแขวนคอยล์ร้อนแบบมีแผ่นยางรองซับแรงสั่นสะเทือน ติดตั้งท่อน้ำทิ้ง PVC ต่อลงท่อระบายน้ำโดยตรง'
        },
        {
            id: 14, job_no: 'JOB202609014', external_ref_id: 'INT-2026-014', customer_id: 14, status: 'NEW', job_type: 'renovate',
            property_type: 'ทาวน์โฮม 2 ชั้น', project_type: 'Renovate',
            project_sub_type: 'ปรับปรุงพื้นที่รอบบ้าน เทคอนกรีตพิมพ์ลาย Stamped Concrete ลายหินธรรมชาติ European Fan พร้อมระบบระบายน้ำผิวดิน',
            assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-14',
            services: ['ปรับปรุงพื้นที่รอบบ้าน เทคอนกรีตพิมพ์ลาย Stamped Concrete ลายหินธรรมชาติ European Fan พร้อมระบบระบายน้ำผิวดิน'],
            overall_progress: 0,
            special_instructions: 'บดอัดดินและทรายหยาบหนา 15 ซม. ปูเหล็กวายเมชขนาด 4 มม. ระยะห่าง 15 ซม. เทคอนกรีตกำลังอัด 280 ksc',
            additional_notes: 'เคลือบน้ำยาอะคริลิกซีลเลอร์สูตรเงาพิเศษ 2 รอบ ป้องกันคราบตะไคร่น้ำและรังสียูวี รับประกันสีไม่ลอกร่อน 3 ปี'
        },
        {
            id: 15, job_no: 'JOB202609015', external_ref_id: 'INT-2026-015', customer_id: 15, status: 'NEW', job_type: 'quick',
            property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Installation',
            project_sub_type: 'ติดตั้งชุดสวิตช์และเต้ารับ Smart Switch Zigbee ทั้งหลัง ควบคุมแสงสว่างผ่านเสียงและตั้งเวลาซีนอัตโนมัติ',
            assigned_tech: 'Team D (กิตติศักดิ์)', plan_date: '2026-09-15',
            services: ['ติดตั้งชุดสวิตช์และเต้ารับ Smart Switch Zigbee ทั้งหลัง ควบคุมแสงสว่างผ่านเสียงและตั้งเวลาซีนอัตโนมัติ'],
            overall_progress: 0,
            special_instructions: 'เดินสายนิวทรัล (N-Line) เพิ่มเติมสำหรับสวิตช์อัจฉริยะทุกจุดเพื่อความเสถียรสูงสุดของสัญญาณ Zigbee',
            additional_notes: 'ติดตั้ง Zigbee 3.0 Gateway แบบต่อสาย LAN เข้า Router กลาง พร้อมจับคู่สมาร์ทโฟน 4 เครื่องในครอบครัว'
        },
        {
            id: 16, job_no: 'JOB202609016', external_ref_id: 'INT-2026-016', customer_id: 16, status: 'NEW', job_type: 'renovate',
            property_type: 'โฮมออฟฟิศ 4 ชั้น', project_type: 'Renovate',
            project_sub_type: 'รีโนเวทห้องประชุม Co-working Space ติดตั้งระบบผนังบานเลื่อนกระจกกั้นห้องเก็บเสียงและระบบจอ Smart Board พร้อมระบบไฟ Dimmer',
            assigned_tech: 'Team C (วิชัย)', plan_date: '2026-09-15',
            services: ['รีโนเวทห้องประชุม Co-working Space ติดตั้งระบบผนังบานเลื่อนกระจกกั้นห้องเก็บเสียงและระบบจอ Smart Board พร้อมระบบไฟ Dimmer'],
            overall_progress: 0,
            special_instructions: 'ทดสอบระบบรางแขวนบนเพดานโครงสร้างเหล็ก I-Beam รองรับน้ำหนักบานกระจกได้จุดละไม่น้อยกว่า 300 กก.',
            additional_notes: 'รางเลื่อนระบบ Soft-close รางคู่ ซีลขอบยางกันเสียงรบกวน ปลั๊กไฟ Pop-up ติดตั้งกลางโต๊ะประชุมเชื่อมระบบ HDMI/Type-C'
        }
    ];
    const baseTime = Date.now();
    for (let i = 0; i < mockJobs.length; i++) {
        const j = mockJobs[i];
        const cust = mockCustomers[i];
        const isoTime = new Date(baseTime - (mockJobs.length - 1 - i) * 12 * 60000).toISOString();
        const customerData = {
            id: cust.id,
            customer_code: cust.customer_code,
            name: `คุณ${cust.first_name} ${cust.last_name}`,
            first_name: cust.first_name,
            last_name: cust.last_name,
            phone: cust.phone,
            address: cust.address,
            lat: cust.lat,
            lng: cust.lng
        };
        await dbSaveJob({
            ...j,
            customer: customerData,
            customer_data: customerData,
            step_timestamps: { step1_order_at: isoTime },
            created_at: isoTime,
            tasks: [],
            photos: [],
            boq_items: [],
            pmt_accepted: false,
            overall_progress: 0
        });
    }
    console.log(`[DB SEED] Successfully seeded ${mockJobs.length} mock jobs into PostgreSQL core_jobs.`);
    return mockJobs.length;
}
// =============================================================================
// DAILY WORK LOGS & TECHNICIAN PHOTOS DB REPOSITORY
// =============================================================================
async function dbLoadDailyWorkLogs(jobId, taskId) {
    if (!exports.isDatabaseConnected)
        return [];
    try {
        let sql = 'SELECT * FROM core_daily_work_logs';
        const params = [];
        const where = [];
        if (jobId) {
            where.push(`(job_id = $${params.length + 1} OR job_no = $${params.length + 1})`);
            params.push(String(jobId));
        }
        if (taskId) {
            where.push(`task_id = $${params.length + 1}`);
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
    if (!exports.isDatabaseConnected)
        return;
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
            Boolean(log.supervisor_approved),
            log.created_at ? new Date(log.created_at) : new Date()
        ]);
    }
    catch (err) {
        console.error('[DB] Error saving daily work log:', err.message);
    }
}
async function dbDeleteDailyWorkLog(id) {
    if (!exports.isDatabaseConnected)
        return;
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
    if (!exports.isDatabaseConnected)
        return [];
    try {
        let sql = 'SELECT * FROM core_qc_bookings';
        const params = [];
        const where = [];
        if (jobId && jobId !== 'all') {
            where.push(`(job_id = $${params.length + 1} OR job_no = $${params.length + 1})`);
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
    if (!exports.isDatabaseConnected)
        return;
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
    if (!exports.isDatabaseConnected)
        return;
    try {
        await exports.pool.query('DELETE FROM core_qc_bookings WHERE task_id = $1 OR id = $1', [String(taskId)]);
    }
    catch (err) {
        console.error('[DB] Error deleting QC booking by task:', err.message);
    }
}
async function dbConfirmQCBooking(id, qcTech, confirmedBy, remarks) {
    if (!exports.isDatabaseConnected)
        return null;
    try {
        const res = await exports.pool.query(`UPDATE core_qc_bookings 
       SET status = 'CONFIRMED', 
           confirmed_at = CURRENT_TIMESTAMP,
           assigned_qc_tech = COALESCE($2, assigned_qc_tech),
           confirmed_by = COALESCE($3, confirmed_by),
           remarks = COALESCE($4, remarks),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 OR task_id = $1
       RETURNING *`, [id, qcTech || null, confirmedBy || null, remarks || null]);
        return res.rows[0] || null;
    }
    catch (err) {
        console.error('[DB] Error confirming QC booking:', err.message);
        return null;
    }
}
// =============================================================================
// MA CONTRACTS & ROUNDS DB REPOSITORY
// =============================================================================
async function dbLoadMAContracts() {
    if (!exports.isDatabaseConnected)
        return [];
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
    if (!exports.isDatabaseConnected)
        return null;
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
    if (!exports.isDatabaseConnected)
        return;
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
    if (!exports.isDatabaseConnected)
        return;
    try {
        await exports.pool.query('DELETE FROM ma_rounds WHERE contract_id = $1', [id]);
        await exports.pool.query('DELETE FROM ma_contracts WHERE id = $1', [id]);
    }
    catch (err) {
        console.error('[DB] Error deleting MA contract:', err.message);
    }
}
async function dbLoadMARounds(contractId) {
    if (!exports.isDatabaseConnected)
        return [];
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
    if (!exports.isDatabaseConnected)
        return;
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
    if (!exports.isDatabaseConnected)
        return;
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
