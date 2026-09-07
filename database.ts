import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// PostgreSQL Connection Pool
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:EsQShpeaGvSr21I5ieQGJRmCELp78GSlQn6hQHAIjbTnY4c1aWw56JleGierEk2t@187.77.147.16:5432/spmt_db';

export const pool = new Pool({
  connectionString,
  ssl: false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  console.error('[DB POOL ERROR] Unexpected client error:', err.message);
});

export let isDatabaseConnected = false;

// Check and Initialize Database Tables
export async function initDatabase(): Promise<boolean> {
  try {
    const client = await pool.connect();
    isDatabaseConnected = true;
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
        ADD COLUMN IF NOT EXISTS qc_passed_at TIMESTAMP WITH TIME ZONE;

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
  } catch (err: any) {
    console.warn('[DB WARNING] Could not initialize PostgreSQL tables, running in-memory fallback:', err.message);
    isDatabaseConnected = false;
    return false;
  }
}

// =============================================================================
// USERS & AUTH DB REPOSITORY
// =============================================================================

export async function dbLoadUsers(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM sys_users ORDER BY id ASC');
    return res.rows;
  } catch (err: any) {
    console.error('[DB] Error loading users:', err.message);
    return [];
  }
}

export async function dbGetUser(usernameOrEmail: string): Promise<any | null> {
  if (!isDatabaseConnected) return null;
  try {
    const res = await pool.query(
      'SELECT * FROM sys_users WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1) LIMIT 1',
      [usernameOrEmail]
    );
    return res.rows[0] || null;
  } catch (err: any) {
    console.error('[DB] Error getting user:', err.message);
    return null;
  }
}

export async function dbSaveUser(user: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO sys_users (user_code, username, email, full_name, role, password_hash, is_active, last_login_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (username) DO UPDATE SET
         user_code = EXCLUDED.user_code,
         email = EXCLUDED.email,
         full_name = EXCLUDED.full_name,
         role = EXCLUDED.role,
         password_hash = EXCLUDED.password_hash,
         is_active = EXCLUDED.is_active,
         last_login_at = EXCLUDED.last_login_at,
         updated_at = CURRENT_TIMESTAMP`,
      [
        user.user_code,
        user.username,
        user.email || null,
        user.full_name,
        user.role,
        user.password_hash,
        user.is_active ?? true,
        user.last_login_at ? new Date(user.last_login_at) : null,
        user.created_at ? new Date(user.created_at) : new Date(),
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving user:', err.message);
  }
}

export async function dbUpdateUser(id: number | string, fields: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(fields)) {
      if (['full_name', 'email', 'role', 'is_active', 'password_hash', 'last_login_at'].includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(key === 'last_login_at' && val ? new Date(val as string) : val);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await pool.query(`UPDATE sys_users SET ${setClauses.join(', ')} WHERE id = $${idx} OR user_code = $${idx}`, values);
  } catch (err: any) {
    console.error('[DB] Error updating user:', err.message);
  }
}

export async function dbDeleteUser(id: number | string): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query('DELETE FROM sys_users WHERE id = $1', [id]);
  } catch (err: any) {
    console.error('[DB] Error deleting user:', err.message);
  }
}

export async function dbSaveLoginLog(log: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO sys_login_log (username, user_id, success, ip_address, fail_reason, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        log.username,
        log.user_id ? Number(log.user_id) : null,
        log.success,
        log.ip_address || null,
        log.fail_reason || null,
        log.created_at ? new Date(log.created_at) : new Date(),
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving login log:', err.message);
  }
}

export async function dbLoadLoginLogs(limit: number = 100): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM sys_login_log ORDER BY created_at DESC LIMIT $1', [limit]);
    return res.rows;
  } catch (err: any) {
    console.error('[DB] Error loading login logs:', err.message);
    return [];
  }
}

// =============================================================================
// JOBS & PROJECTS DB REPOSITORY
// =============================================================================

export function mapDbJobRow(row: any): any {
  if (!row) return null;
  const cust = row.customer_data || {};
  let customerFullName = 'ไม่ระบุชื่อ';
  if (cust) {
    if (cust.name) {
      customerFullName = cust.name;
    } else if (cust.first_name || cust.last_name) {
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
    job_type: row.job_type || 'quick',
    step_timestamps: row.step_timestamps || {},
    created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

export async function dbLoadJobs(filters?: { status?: string; service?: string; search?: string }): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query('SELECT * FROM core_jobs ORDER BY created_at DESC, id DESC');
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
        list = list.filter(j =>
          (j.id && j.id.toLowerCase().includes(q)) ||
          (j.customer && j.customer.toLowerCase().includes(q)) ||
          (j.phone && j.phone.includes(q)) ||
          (j.service && j.service.toLowerCase().includes(q))
        );
      }
    }

    return list;
  } catch (err: any) {
    console.error('[DB] Error loading jobs:', err.message);
    return [];
  }
}

export async function dbGetJob(jobNoOrId: string | number): Promise<any | null> {
  if (!isDatabaseConnected) return null;
  try {
    const target = String(jobNoOrId);
    const res = await pool.query(
      'SELECT * FROM core_jobs WHERE job_no = $1 OR (id::text = $1) LIMIT 1',
      [target]
    );
    if (res.rows.length === 0) return null;
    return mapDbJobRow(res.rows[0]);
  } catch (err: any) {
    console.error('[DB] Error getting job:', err.message);
    return null;
  }
}

export async function dbSaveJob(job: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    const customerData = job.customer_data || job.customer || {};
    await pool.query(
      `INSERT INTO core_jobs (
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
        updated_at = CURRENT_TIMESTAMP`,
      [
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
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving job:', err.message);
  }
}

export async function dbUpdateJob(jobNoOrId: string | number, updates: any): Promise<any | null> {
  if (!isDatabaseConnected) return null;
  try {
    const target = String(jobNoOrId);
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    const jsonbFields = ['step_timestamps', 'services', 'customer_data', 'tasks', 'photos', 'boq_items'];
    const stringFields = [
      'external_ref_id', 'booking_no', 'ticket_no', 'status', 'job_type',
      'property_type', 'project_type', 'project_sub_type', 'store_code',
      'agent_name', 'assigned_tech', 'plan_date', 'special_instructions',
      'additional_notes', 'qc_inspection_type'
    ];
    const numFields = ['customer_id', 'overall_progress', 'boq_discount', 'boq_subtotal', 'boq_grand_total'];
    const boolFields = ['pmt_accepted', 'step3_confirmed'];
    const dateFields = ['pmt_accepted_at', 'qc_passed_at'];

    for (const [key, val] of Object.entries(updates)) {
      if (val === undefined) continue;
      if (jsonbFields.includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(JSON.stringify(val));
      } else if (key === 'customer') {
        setClauses.push(`customer_data = $${idx++}`);
        values.push(JSON.stringify(val));
      } else if (stringFields.includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(val);
      } else if (numFields.includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(Number(val));
      } else if (boolFields.includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(Boolean(val));
      } else if (dateFields.includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(val ? new Date(val as string) : null);
      }
    }

    if (setClauses.length === 0) return await dbGetJob(jobNoOrId);
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(target);

    await pool.query(
      `UPDATE core_jobs SET ${setClauses.join(', ')} WHERE job_no = $${idx} OR (id::text = $${idx})`,
      values
    );
    return await dbGetJob(jobNoOrId);
  } catch (err: any) {
    console.error('[DB] Error updating job:', err.message);
    return null;
  }
}

export async function dbDeleteJob(jobNoOrId: string | number): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    const isId = typeof jobNoOrId === 'number' || !isNaN(Number(jobNoOrId));
    const whereCol = isId ? 'id' : 'job_no';
    await pool.query(`DELETE FROM core_jobs WHERE ${whereCol} = $1`, [jobNoOrId]);
  } catch (err: any) {
    console.error('[DB] Error deleting job:', err.message);
  }
}

export async function dbResetJobStatus(): Promise<number> {
  if (!isDatabaseConnected) return 0;
  try {
    const res = await pool.query(`
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
    await pool.query('DELETE FROM core_daily_work_logs;');
    await pool.query('DELETE FROM core_qc_bookings;');
    return res.rowCount || 0;
  } catch (err: any) {
    console.error('[DB] Error resetting job status:', err.message);
    return 0;
  }
}

export async function dbWipeAllTransactions(): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(`
      TRUNCATE core_jobs, core_daily_work_logs, core_qc_bookings, ma_contracts, ma_rounds CASCADE;
    `);
    console.log('[DB] Wiped all transactions via TRUNCATE CASCADE.');
  } catch (err: any) {
    console.warn('[DB] TRUNCATE failed, falling back to DELETE:', err.message);
    await pool.query('DELETE FROM core_daily_work_logs;');
    await pool.query('DELETE FROM core_qc_bookings;');
    await pool.query('DELETE FROM ma_rounds;');
    await pool.query('DELETE FROM ma_contracts;');
    await pool.query('DELETE FROM core_jobs;');
  }
}

// 10 Mock Jobs Data Generator for INT simulation
export async function dbSeedMockJobs(): Promise<number> {
  if (!isDatabaseConnected) return 0;
  const mockCustomers = [
    { id: 1, customer_code: 'CUST-001', first_name: 'ธนกฤต', last_name: 'อัครเดชาภัทร', phone: '081-456-7890', address: '168/22 หมู่บ้านเพอร์เฟค มาสเตอร์พีซ ถนนกรุงเทพกรีฑาตัดใหม่ แขวงคลองสองต้นนุ่น เขตลาดกระบัง กรุงเทพฯ 10520', lat: 13.7380, lng: 100.7245 },
    { id: 2, customer_code: 'CUST-002', first_name: 'กุลนารี', last_name: 'ทรงเกียรติ', phone: '094-567-8901', address: '72/9 หมู่บ้านนันทวัน บางนา กม.8 ตำบลบางแก้ว อำเภอบางพลี สมุทรปราการ 10540', lat: 13.6521, lng: 100.6654 },
    { id: 3, customer_code: 'CUST-003', first_name: 'ปิยมาภรณ์', last_name: 'เกียรติไพบูลย์', phone: '086-789-1234', address: '88/182 โครงการ Life Asoke Hype ถนนอโศก-ดินแดง แขวงมักกะสัน เขตราชเทวี กรุงเทพฯ 10400', lat: 13.7542, lng: 100.5580 },
    { id: 4, customer_code: 'CUST-004', first_name: 'ชัชวาล', last_name: 'วัฒนปรีดา', phone: '083-901-2345', address: '98/44 หมู่บ้านอินดี้ บางใหญ่ ซอยคลองถนน ตำบลเสาธงหิน อำเภอบางใหญ่ นนทบุรี 11140', lat: 13.8821, lng: 100.4072 },
    { id: 5, customer_code: 'CUST-005', first_name: 'ศิรวิชญ์', last_name: 'เมธาอนันต์', phone: '089-321-4567', address: '55/12 หมู่บ้านบ้านกลางเมือง สาทร-สุขสวัสดิ์ แขวงบางปะกอก เขตราษฎร์บูรณะ กรุงเทพฯ 10140', lat: 13.6789, lng: 100.5050 },
    { id: 6, customer_code: 'CUST-006', first_name: 'พรรณพิไล', last_name: 'จารุวรรณ', phone: '091-234-5678', address: '214/8 หมู่บ้านลัดดารมย์ ราชพฤกษ์-รัตนาธิเบศร์ ตำบลบางรักน้อย อำเภอเมืองนนทบุรี นนทบุรี 11000', lat: 13.8745, lng: 100.4560 },
    { id: 7, customer_code: 'CUST-007', first_name: 'อรุณี', last_name: 'รัตนประเสริฐ', phone: '085-890-2345', address: '102/15 ซอยแจ้งวัฒนะ 14 แขวงทุ่งสองห้อง เขตหลักสี่ กรุงเทพฯ 10210', lat: 13.8912, lng: 100.5678 },
    { id: 8, customer_code: 'CUST-008', first_name: 'วรภัทร', last_name: 'ชาญวิชิต', phone: '082-345-6789', address: '333/58 โครงการ The Monument ทองหล่อ ซอยทองหล่อ แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110', lat: 13.7360, lng: 100.5830 },
    { id: 9, customer_code: 'CUST-009', first_name: 'ธีรภัทร', last_name: 'อัศวโภคิน', phone: '087-654-3210', address: '412/1-2 ถนนพระราม 3 แขวงบางคอแหลม เขตบางคอแหลม กรุงเทพฯ 10120', lat: 13.6934, lng: 100.5021 },
    { id: 10, customer_code: 'CUST-010', first_name: 'เบญจวรรณ', last_name: 'พัฒนศิริ', phone: '095-432-1098', address: '500/89 คอนโด ควินทิลเลียน ปิ่นเกล้า ถนนบรมราชชนนี แขวงอรุณอมรินทร์ เขตบางกอกน้อย กรุงเทพฯ 10700', lat: 13.7780, lng: 100.4780 }
  ];

  const mockJobs = [
    { 
      id: 1, job_no: 'JOB202609001', external_ref_id: 'INT-2026-001', customer_id: 1, status: 'NEW', job_type: 'quick',
      property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Installation', 
      project_sub_type: 'ติดตั้งเครื่องชาร์จรถยนต์ไฟฟ้า EV Charger 22kW พร้อมเดินสายเมนและตู้ Consumer แยก', 
      assigned_tech: 'Team C (วิชัย)', plan_date: '2026-09-08', 
      services: ['ติดตั้งเครื่องชาร์จรถยนต์ไฟฟ้า EV Charger 22kW พร้อมเดินสายเมนและตู้ Consumer แยก'], 
      overall_progress: 0, 
      special_instructions: 'ลูกค้าขอนัดเข้างานหลัง 09:30 น. กรุณาสวมรองเท้าเซฟตี้และปูผ้าใบคลุมพื้นโรงจอดรถ',
      additional_notes: 'ตรวจสอบมิเตอร์ไฟ กฟน. ขนาด 30(100)A แล้ว รองรับการเดินสายไฟขนาด 16 sq.mm. เข้าตู้ย่อย'
    },
    { 
      id: 2, job_no: 'JOB202609002', external_ref_id: 'INT-2026-002', customer_id: 2, status: 'NEW', job_type: 'renovate',
      property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทห้องน้ำผู้สูงอายุ Universal Design ปูกระเบื้อง R11 ติดตั้งราวจับและสุขภัณฑ์อัตโนมัติ', 
      assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-08', 
      services: ['รีโนเวทห้องน้ำผู้สูงอายุ Universal Design ปูกระเบื้อง R11 ติดตั้งราวจับและสุขภัณฑ์อัตโนมัติ'], 
      overall_progress: 0, 
      special_instructions: 'ปรับระดับพื้นห้องน้ำให้เป็นระนาบเดียวกับภายนอก (Zero Threshold) ป้องกันการสะดุด',
      additional_notes: 'สกัดพื้นเดิมทำระบบกันซึม 3 ชั้น ติดตั้ง Floor Drain รางยาวระบายน้ำรวดเร็ว'
    },
    { 
      id: 3, job_no: 'JOB202609003', external_ref_id: 'INT-2026-003', customer_id: 3, status: 'NEW', job_type: 'quick',
      property_type: 'คอนโดมิเนียม', project_type: 'Installation', 
      project_sub_type: 'ติดตั้ง Digital Door Lock ระบบสแกนใบหน้า 3D Face Recognition & Smart App', 
      assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-09', 
      services: ['ติดตั้ง Digital Door Lock ระบบสแกนใบหน้า 3D Face Recognition & Smart App'], 
      overall_progress: 0, 
      special_instructions: 'ติดต่อนิติบุคคลคอนโดแลกบัตรช่างก่อนขึ้นอาคาร ห้ามเจาะประตูส่งเสียงดังหลัง 16:00 น.',
      additional_notes: 'ประตูไม้สักหนา 45 มม. เช็คระยะ Backset 60 มม. ก่อนเจาะตลับกุญแจ Mortise Lock'
    },
    { 
      id: 4, job_no: 'JOB202609004', external_ref_id: 'INT-2026-004', customer_id: 4, status: 'NEW', job_type: 'renovate',
      property_type: 'ทาวน์โฮม 2 ชั้น', project_type: 'Renovate', 
      project_sub_type: 'ต่อเติมห้องครัวหลังบ้านและลานซักล้าง ลงเสาเข็มไมโครไพล์ i22 พร้อมปูกระเบื้องและก่อเคาน์เตอร์ปูน', 
      assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-09', 
      services: ['ต่อเติมห้องครัวหลังบ้านและลานซักล้าง ลงเสาเข็มไมโครไพล์ i22 พร้อมปูกระเบื้องและก่อเคาน์เตอร์ปูน'], 
      overall_progress: 0, 
      special_instructions: 'ตอกเสาเข็มไมโครไพล์ 4 ต้น ป้องกันโครงสร้างส่วนต่อเติมทรุดตัวดึงตัวบ้านหลัก',
      additional_notes: 'เว้น Joint โฟมรอยต่อระหว่างตัวบ้านกับส่วนต่อเติม 2 ซม. ยาแนวด้วยโพลียูรีเทน (PU) กันน้ำซึม'
    },
    { 
      id: 5, job_no: 'JOB202609005', external_ref_id: 'INT-2026-005', customer_id: 5, status: 'NEW', job_type: 'quick',
      property_type: 'ทาวน์โฮม 3 ชั้น', project_type: 'Installation', 
      project_sub_type: 'เปลี่ยนเครื่องทำน้ำร้อน 6000W แบบ Multipoint พร้อมเดินท่อน้ำร้อน PPR เชื่อมก๊อกผสม Rain Shower', 
      assigned_tech: 'Team D (กิตติศักดิ์)', plan_date: '2026-09-10', 
      services: ['เปลี่ยนเครื่องทำน้ำร้อน 6000W แบบ Multipoint พร้อมเดินท่อน้ำร้อน PPR เชื่อมก๊อกผสม Rain Shower'], 
      overall_progress: 0, 
      special_instructions: 'ตรวจเช็คสายดินและทดสอบเบรกเกอร์ ELCB 3 ครั้งก่อนส่งมอบงานให้ลูกค้าทดลองใช้งาน',
      additional_notes: 'ติดตั้งใต้อ่างล้างหน้าชั้น 2 ตรวจสอบแรงดันน้ำก่อนและหลังเปิดเครื่อง'
    },
    { 
      id: 6, job_no: 'JOB202609006', external_ref_id: 'INT-2026-006', customer_id: 6, status: 'NEW', job_type: 'renovate',
      property_type: 'บ้านเดี่ยว 2 ชั้น', project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทระเบียงสระว่ายน้ำ รื้อพื้นเดิมปูไม้เทียม WPC เกรดพรีเมียมพร้อมติดตั้งไฟ Solar Pathway', 
      assigned_tech: 'Team D (กิตติศักดิ์)', plan_date: '2026-09-10', 
      services: ['รีโนเวทระเบียงสระว่ายน้ำ รื้อพื้นเดิมปูไม้เทียม WPC เกรดพรีเมียมพร้อมติดตั้งไฟ Solar Pathway'], 
      overall_progress: 0, 
      special_instructions: 'ปรับสโลปทางระบายน้ำลงสู่รางรอบสระว่ายน้ำอย่างระมัดระวัง คลุมสระกันเศษฝุ่น',
      additional_notes: 'โครงตงเหล็กกัลวาไนซ์กันสนิม ยึดด้วยคลิปล็อคสแตนเลส 304 ไม้เทียมรับน้ำหนัก 500 กก./ตร.ม.'
    },
    { 
      id: 7, job_no: 'JOB202609007', external_ref_id: 'INT-2026-007', customer_id: 7, status: 'NEW', job_type: 'quick',
      property_type: 'บ้านเดี่ยว 1 ชั้น', project_type: 'Installation', 
      project_sub_type: 'ติดตั้งปั๊มน้ำ Inverter แรงดันคงที่ Grundfos พร้อมระบบกรองน้ำใช้ Big Blue 2 ขั้นตอน', 
      assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-11', 
      services: ['ติดตั้งปั๊มน้ำ Inverter แรงดันคงที่ Grundfos พร้อมระบบกรองน้ำใช้ Big Blue 2 ขั้นตอน'], 
      overall_progress: 0, 
      special_instructions: 'มีผู้สูงอายุพักผ่อนในบ้าน ทดสอบเสียงการทำงานของปั๊มน้ำและเช็คการรั่วซึมทุกจุด',
      additional_notes: 'ทำฐานยางรองลดแรงสั่นสะเทือน ติดตั้งบายพาสวาล์วคู่ขนานสำหรับกรณีฉุกเฉินไฟดับ'
    },
    { 
      id: 8, job_no: 'JOB202609008', external_ref_id: 'INT-2026-008', customer_id: 8, status: 'NEW', job_type: 'renovate',
      property_type: 'คอนโดมิเนียม ดูเพล็กซ์', project_type: 'Renovate', 
      project_sub_type: 'กั้นห้องกระจกบานเลื่อน Slim Frameless กระจกลามิเนต Acoustic เก็บเสียง สำหรับโฮมออฟฟิศ', 
      assigned_tech: 'Team C (วิชัย)', plan_date: '2026-09-11', 
      services: ['กั้นห้องกระจกบานเลื่อน Slim Frameless กระจกลามิเนต Acoustic เก็บเสียง สำหรับโฮมออฟฟิศ'], 
      overall_progress: 0, 
      special_instructions: 'ขนย้ายกระจกผ่านลิฟต์ขนของเฉพาะเวลา 10:00 - 15:00 น. เท่านั้น',
      additional_notes: 'ใช้โปรไฟล์อลูมิเนียมเกรดหนา 2.0 มม. กระจกลามิเนต 5+5 มม. ซีลสักหลาดและซิลิโคนอะคูสติก'
    },
    { 
      id: 9, job_no: 'JOB202609009', external_ref_id: 'INT-2026-009', customer_id: 9, status: 'NEW', job_type: 'renovate',
      property_type: 'อาคารพาณิชย์ 4 ชั้น', project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทฝ้าเพดานหลุมซ่อนไฟ LED พร้อมติดฉนวนกันความร้อน Stay Cool 150 มม. เหนือฝ้าชั้นดาดฟ้า', 
      assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-12', 
      services: ['รีโนเวทฝ้าเพดานหลุมซ่อนไฟ LED พร้อมติดฉนวนกันความร้อน Stay Cool 150 มม. เหนือฝ้าชั้นดาดฟ้า'], 
      overall_progress: 0, 
      special_instructions: 'สำรวจคราบน้ำและรอยแตกลายงาใต้พื้นดาดฟ้าก่อนตีโครงคร่าว C-Line ชนิดหนาพิเศษ',
      additional_notes: 'แผ่นยิปซัมขอบลาดตราช้างหนา 9 มม. งานฉาบรอยต่อ 3 เที่ยว ขัดเรียบพร้อมทาสีรองพื้นฝ้าเพดาน'
    },
    { 
      id: 10, job_no: 'JOB202609010', external_ref_id: 'INT-2026-010', customer_id: 10, status: 'NEW', job_type: 'renovate',
      property_type: 'คอนโดมิเนียม', project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทห้องนอนใหญ่ ออกแบบตกแต่ง Built-in ตู้เสื้อผ้า Walk-in Closet ไม้ MDF กันชื้นปิดผิวลามิเนต', 
      assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-12', 
      services: ['รีโนเวทห้องนอนใหญ่ ออกแบบตกแต่ง Built-in ตู้เสื้อผ้า Walk-in Closet ไม้ MDF กันชื้นปิดผิวลามิเนต'], 
      overall_progress: 0, 
      special_instructions: 'ติดตั้งระบบไฟ LED Strip ซ่อนในรางอลูมิเนียม พร้อมเซนเซอร์เปิดปิดอัตโนมัติเมื่อเปิดตู้',
      additional_notes: 'บานพับ Soft-close แบรนด์ Blum รางลิ้นชักรับน้ำหนัก 30 กก. ปิดรอยต่อชนฝ้าเพดานด้วยบัวบน'
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

export async function dbLoadDailyWorkLogs(jobId?: string, taskId?: string): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    let sql = 'SELECT * FROM core_daily_work_logs';
    const params: any[] = [];
    const where: string[] = [];
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
    const res = await pool.query(sql, params);
    return res.rows.map(row => ({
      ...row,
      photos: Array.isArray(row.photos) ? row.photos : []
    }));
  } catch (err: any) {
    console.error('[DB] Error loading daily work logs:', err.message);
    return [];
  }
}

export async function dbSaveDailyWorkLog(log: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO core_daily_work_logs (
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
        updated_at = CURRENT_TIMESTAMP`,
      [
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
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving daily work log:', err.message);
  }
}

export async function dbDeleteDailyWorkLog(id: string): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query('DELETE FROM core_daily_work_logs WHERE id = $1', [id]);
  } catch (err: any) {
    console.error('[DB] Error deleting daily work log:', err.message);
  }
}

// =============================================================================
// QC BOOKINGS DB REPOSITORY
// =============================================================================

export async function dbLoadQCBookings(jobId?: string, status?: string): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    let sql = 'SELECT * FROM core_qc_bookings';
    const params: any[] = [];
    const where: string[] = [];
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
    const res = await pool.query(sql, params);
    return res.rows.map(row => ({
      ...row,
      checklist: Array.isArray(row.checklist) ? row.checklist : [],
      photos: Array.isArray(row.photos) ? row.photos : []
    }));
  } catch (err: any) {
    console.error('[DB] Error loading QC bookings:', err.message);
    return [];
  }
}

export async function dbSaveQCBooking(booking: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO core_qc_bookings (
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
        updated_at = CURRENT_TIMESTAMP`,
      [
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
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving QC booking:', err.message);
  }
}

export async function dbDeleteQCBookingByTask(taskId: string | number): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query('DELETE FROM core_qc_bookings WHERE task_id = $1 OR id = $1', [String(taskId)]);
  } catch (err: any) {
    console.error('[DB] Error deleting QC booking by task:', err.message);
  }
}

export async function dbConfirmQCBooking(id: string, qcTech?: string, confirmedBy?: string, remarks?: string): Promise<any | null> {
  if (!isDatabaseConnected) return null;
  try {
    const res = await pool.query(
      `UPDATE core_qc_bookings 
       SET status = 'CONFIRMED', 
           confirmed_at = CURRENT_TIMESTAMP,
           assigned_qc_tech = COALESCE($2, assigned_qc_tech),
           confirmed_by = COALESCE($3, confirmed_by),
           remarks = COALESCE($4, remarks),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 OR task_id = $1
       RETURNING *`,
      [id, qcTech || null, confirmedBy || null, remarks || null]
    );
    return res.rows[0] || null;
  } catch (err: any) {
    console.error('[DB] Error confirming QC booking:', err.message);
    return null;
  }
}

// =============================================================================
// MA CONTRACTS & ROUNDS DB REPOSITORY
// =============================================================================

export async function dbLoadMAContracts(): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    const res = await pool.query(`
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
  } catch (err: any) {
    console.error('[DB] Error loading MA contracts:', err.message);
    return [];
  }
}

export async function dbGetMAContract(id: string): Promise<any | null> {
  if (!isDatabaseConnected) return null;
  try {
    const contractRes = await pool.query('SELECT * FROM ma_contracts WHERE id = $1 LIMIT 1', [id]);
    if (contractRes.rows.length === 0) return null;
    const contract = contractRes.rows[0];

    const roundsRes = await pool.query('SELECT * FROM ma_rounds WHERE contract_id = $1 ORDER BY round_number ASC', [id]);
    const rounds = roundsRes.rows;

    const completedRounds = rounds.filter(r => r.status === 'Completed').length;

    return {
      ...contract,
      service_items: Array.isArray(contract.service_items) ? contract.service_items : [],
      total_rounds_count: rounds.length > 0 ? rounds.length : (contract.total_rounds || 0),
      completed_rounds: completedRounds,
      rounds
    };
  } catch (err: any) {
    console.error('[DB] Error getting MA contract:', err.message);
    return null;
  }
}

export async function dbSaveMAContract(contract: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO ma_contracts (
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
        updated_at = CURRENT_TIMESTAMP`,
      [
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
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving MA contract:', err.message);
  }
}

export async function dbDeleteMAContract(id: string): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query('DELETE FROM ma_rounds WHERE contract_id = $1', [id]);
    await pool.query('DELETE FROM ma_contracts WHERE id = $1', [id]);
  } catch (err: any) {
    console.error('[DB] Error deleting MA contract:', err.message);
  }
}

export async function dbLoadMARounds(contractId?: string): Promise<any[]> {
  if (!isDatabaseConnected) return [];
  try {
    let sql = 'SELECT * FROM ma_rounds';
    const params: any[] = [];
    if (contractId) {
      sql += ' WHERE contract_id = $1';
      params.push(contractId);
    }
    sql += ' ORDER BY scheduled_date ASC, round_number ASC';
    const res = await pool.query(sql, params);
    return res.rows;
  } catch (err: any) {
    console.error('[DB] Error loading MA rounds:', err.message);
    return [];
  }
}

export async function dbSaveMARound(round: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    await pool.query(
      `INSERT INTO ma_rounds (
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
        updated_at = CURRENT_TIMESTAMP`,
      [
        round.id,
        round.contract_id,
        round.project_id ? Number(round.project_id) : null,
        round.round_number || 1,
        round.scheduled_date,
        round.actual_date || null,
        round.status || 'Scheduled',
        round.technician_id || null,
        round.notes || null
      ]
    );
  } catch (err: any) {
    console.error('[DB] Error saving MA round:', err.message);
  }
}

export async function dbUpdateMARound(id: string, updates: any): Promise<void> {
  if (!isDatabaseConnected) return;
  try {
    const setClauses: string[] = [];
    const values: any[] = [];
    let idx = 1;

    for (const [key, val] of Object.entries(updates)) {
      if (['status', 'scheduled_date', 'actual_date', 'notes', 'technician_id'].includes(key)) {
        setClauses.push(`${key} = $${idx++}`);
        values.push(val);
      }
    }
    if (setClauses.length === 0) return;
    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    await pool.query(`UPDATE ma_rounds SET ${setClauses.join(', ')} WHERE id = $${idx}`, values);
  } catch (err: any) {
    console.error('[DB] Error updating MA round:', err.message);
  }
}
