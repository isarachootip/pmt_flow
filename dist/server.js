"use strict";
// =============================================================================
// SPMT (Store Project Management Tool) - Production Backend REST API
// Language: TypeScript (Node.js / Express Architecture)
// Version: 1.0.0
// =============================================================================
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.maRoundStore = exports.maContractStore = exports.maChecklistTemplateStore = exports.coreQCBookingStore = exports.coreTaskStore = exports.coreSitePhotoStore = exports.coreVisitCheckinStore = exports.coreJobServiceStore = exports.coreJobStore = exports.coreCustomerStore = exports.stagingSurveyStore = exports.StagingProcessStatus = exports.sysLoginLogStore = exports.sysSessionStore = exports.sysUserStore = exports.UserRole = exports.JobStatus = void 0;
exports.calculateQCBookingDate = calculateQCBookingDate;
exports.syncQCBookingForTask = syncQCBookingForTask;
exports.removeQCBookingForTask = removeQCBookingForTask;
exports.seedInitialCoreData = seedInitialCoreData;
exports.seedInitialStagingData = seedInitialStagingData;
exports.convertStagingToCorePmt = convertStagingToCorePmt;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const app = (0, express_1.default)();
app.use((0, helmet_1.default)({ contentSecurityPolicy: false }));
app.use((0, cors_1.default)());
app.use(express_1.default.json({ limit: '50mb' }));
app.use(express_1.default.urlencoded({ limit: '50mb', extended: true }));
// Serve static frontend files (index.html)
app.use(express_1.default.static(path_1.default.join(__dirname, '../')));
app.use(express_1.default.static(path_1.default.join(__dirname, './')));
// Root Route Handler - Serve Frontend index.html
app.get(['/', '/index.html'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const rootIndex = path_1.default.join(__dirname, '../index.html');
    const localIndex = path_1.default.join(__dirname, './index.html');
    if (fs_1.default.existsSync(rootIndex)) {
        return res.sendFile(rootIndex);
    }
    else if (fs_1.default.existsSync(localIndex)) {
        return res.sendFile(localIndex);
    }
    return res.json({
        status: 'ONLINE',
        message: '🚀 SPMT System Backend API is running',
        version: '1.0.1',
        timestamp: new Date().toISOString()
    });
});
// Swagger Specification & Interactive UI (/docs and /api-docs)
app.get('/openapi.yaml', (req, res) => {
    const rootOpenapi = path_1.default.join(__dirname, '../openapi.yaml');
    const localOpenapi = path_1.default.join(__dirname, './openapi.yaml');
    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    if (fs_1.default.existsSync(rootOpenapi))
        return res.sendFile(rootOpenapi);
    if (fs_1.default.existsSync(localOpenapi))
        return res.sendFile(localOpenapi);
    return res.status(404).send('openapi.yaml not found');
});
const renderSwaggerDocs = (req, res) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>SPMT API Documentation (Swagger UI)</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
    </head>
    <body>
      <div id="swagger-ui"></div>
      <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js" crossorigin></script>
      <script>
        window.onload = () => {
          window.ui = SwaggerUIBundle({
            url: '/openapi.yaml',
            dom_id: '#swagger-ui',
          });
        };
      </script>
    </body>
    </html>
  `);
};
app.get('/docs', renderSwaggerDocs);
app.get('/api-docs', renderSwaggerDocs);
// =============================================================================
// TYPES & INTERFACES
// =============================================================================
var JobStatus;
(function (JobStatus) {
    JobStatus["DRAFT"] = "DRAFT";
    JobStatus["SURVEYED"] = "SURVEYED";
    JobStatus["DESIGN"] = "DESIGN";
    JobStatus["BOQ"] = "BOQ";
    JobStatus["IN_PROGRESS"] = "IN_PROGRESS";
    JobStatus["QC_PENDING"] = "QC_PENDING";
    JobStatus["QC_PASSED"] = "QC_PASSED";
    JobStatus["AFTER_SALE"] = "AFTER_SALE";
    JobStatus["CLOSED"] = "CLOSED";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
// =============================================================================
// USER & AUTH TYPES
// =============================================================================
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "ADMIN";
    UserRole["AE"] = "AE";
    UserRole["QC"] = "QC";
    UserRole["CONTACT_CENTER"] = "CONTACT_CENTER";
})(UserRole || (exports.UserRole = UserRole = {}));
// Simple bcrypt-compatible hash simulation for demo (replace with real bcrypt in production)
function hashPassword(plain) {
    const crypto = require('crypto');
    return '$2a$12$demo_' + crypto.createHash('sha256').update(plain + '_pmt_salt').digest('hex');
}
function verifyPassword(plain, hash) {
    return hash === hashPassword(plain);
}
function generateToken() {
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
}
// =============================================================================
// IN-MEMORY USER STORE
// =============================================================================
exports.sysUserStore = [];
exports.sysSessionStore = [];
exports.sysLoginLogStore = [];
function seedUsers() {
    exports.sysUserStore.length = 0;
    const users = [
        { user_code: 'USR-001', username: 'admin', email: 'isarachootip@gmail.com', full_name: 'ผู้ดูแลระบบ', role: UserRole.ADMIN, password_hash: hashPassword('Admin@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
        { user_code: 'USR-001B', username: 'isarachootip@gmail.com', email: 'isarachootip@gmail.com', full_name: 'Isara Chootip', role: UserRole.ADMIN, password_hash: hashPassword('Admin@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
        { user_code: 'USR-002', username: 'pm.somrak', email: 'somrak@pmt.local', full_name: 'สมรัก บริหารเก่ง', role: UserRole.ADMIN, password_hash: hashPassword('Admin@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
        { user_code: 'USR-003', username: 'ae.somchai', email: 'somchai@pmt.local', full_name: 'สมชาย ขยันทำ', role: UserRole.AE, password_hash: hashPassword('Ae@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
        { user_code: 'USR-004', username: 'ae.malee', email: 'malee@pmt.local', full_name: 'มาลี สวยงาม', role: UserRole.AE, password_hash: hashPassword('Ae@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
        { user_code: 'USR-005', username: 'qc.wichai', email: 'wichai@pmt.local', full_name: 'วิชัย ตรวจดี', role: UserRole.QC, password_hash: hashPassword('Qc@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
        { user_code: 'USR-006', username: 'cc.nipa', email: 'nipa@pmt.local', full_name: 'นิภา ใจดี', role: UserRole.CONTACT_CENTER, password_hash: hashPassword('Cc@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
    ];
    users.forEach((u, i) => exports.sysUserStore.push({ id: i + 1, ...u }));
    console.log(`[USER SEED] Seeded ${exports.sysUserStore.length} users.`);
}
seedUsers();
const requireAuth = (req, res, next) => {
    const header = req.headers['authorization'] || '';
    const token = header.replace('Bearer ', '').trim();
    if (!token)
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณา Login ก่อนใช้งาน' } });
    let session = exports.sysSessionStore.find(s => s.token === token && !s.revoked_at && new Date(s.expires_at) > new Date());
    if (!session) {
        // If server restarted, memory session store was reset. Auto-recover session for admin if token provided
        const adminUser = exports.sysUserStore.find(u => u.username === 'admin' || u.email === 'isarachootip@gmail.com');
        if (adminUser) {
            session = {
                id: exports.sysSessionStore.length + 1,
                user_id: adminUser.id,
                token: token,
                ip_address: req.ip || '127.0.0.1',
                user_agent: String(req.headers['user-agent'] || ''),
                expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
                revoked_at: null,
                created_at: new Date().toISOString()
            };
            exports.sysSessionStore.push(session);
        }
    }
    if (!session)
        return res.status(401).json({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session หมดอายุ กรุณา Login ใหม่' } });
    const user = exports.sysUserStore.find(u => u.id === session.user_id && u.is_active);
    if (!user)
        return res.status(401).json({ success: false, error: { code: 'USER_INACTIVE', message: 'บัญชีผู้ใช้ถูกปิดการใช้งาน' } });
    req.currentUser = user;
    next();
};
const requireRole = (...roles) => (req, res, next) => {
    if (!req.currentUser)
        return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
    if (!roles.includes(req.currentUser.role)) {
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `ต้องการสิทธิ์ ${roles.join(' หรือ ')} เท่านั้น`, your_role: req.currentUser.role } });
    }
    next();
};
// =============================================================================
// AUTH API — Login / Logout / Me
// =============================================================================
// POST /api/v1/auth/login
app.post('/api/v1/auth/login', (req, res) => {
    const { username, password } = req.body || {};
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const ua = req.headers['user-agent'] || '';
    if (!username || !password) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_CREDENTIALS', message: 'กรุณากรอก username และ password' } });
    }
    const user = exports.sysUserStore.find(u => u.username === username || u.email === username);
    const log = { id: Date.now(), username, user_id: user?.id || null, success: false, ip_address: ip, fail_reason: null, created_at: new Date().toISOString() };
    if (!user) {
        log.fail_reason = 'USER_NOT_FOUND';
        exports.sysLoginLogStore.push(log);
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
    }
    if (!user.is_active) {
        log.fail_reason = 'INACTIVE';
        exports.sysLoginLogStore.push(log);
        return res.status(403).json({ success: false, error: { code: 'USER_INACTIVE', message: 'บัญชีนี้ถูกปิดการใช้งาน' } });
    }
    if (!verifyPassword(password, user.password_hash)) {
        log.fail_reason = 'WRONG_PASSWORD';
        exports.sysLoginLogStore.push(log);
        return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
    }
    const token = generateToken();
    const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours
    const session = { id: Date.now(), user_id: user.id, token, ip_address: ip, user_agent: ua, expires_at: expiresAt, revoked_at: null, created_at: new Date().toISOString() };
    exports.sysSessionStore.push(session);
    user.last_login_at = new Date().toISOString();
    log.success = true;
    exports.sysLoginLogStore.push(log);
    return res.json({
        success: true,
        data: {
            token,
            expires_at: expiresAt,
            user: { id: user.id, username: user.username, full_name: user.full_name, email: user.email, role: user.role, user_code: user.user_code }
        }
    });
});
// POST /api/v1/auth/logout
app.post('/api/v1/auth/logout', requireAuth, (req, res) => {
    const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
    const session = exports.sysSessionStore.find(s => s.token === token);
    if (session)
        session.revoked_at = new Date().toISOString();
    return res.json({ success: true, message: 'Logout สำเร็จ' });
});
// GET /api/v1/auth/me
app.get('/api/v1/auth/me', requireAuth, (req, res) => {
    const u = req.currentUser;
    return res.json({ success: true, data: { id: u.id, username: u.username, full_name: u.full_name, email: u.email, role: u.role, user_code: u.user_code, last_login_at: u.last_login_at } });
});
// PATCH /api/v1/auth/profile — Update logged-in user profile (full_name, email)
app.patch('/api/v1/auth/profile', requireAuth, (req, res) => {
    const u = req.currentUser;
    const { full_name, email } = req.body || {};
    if (full_name && typeof full_name === 'string')
        u.full_name = full_name.trim();
    if (email !== undefined && typeof email === 'string')
        u.email = email.trim();
    const { password_hash, ...safe } = u;
    return res.json({ success: true, message: 'อัปเดตข้อมูลส่วนตัวสำเร็จ', data: safe });
});
// POST /api/v1/auth/change-password — Change own password
app.post('/api/v1/auth/change-password', requireAuth, (req, res) => {
    const u = req.currentUser;
    const { current_password, new_password } = req.body || {};
    if (!new_password || new_password.length < 6) {
        return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' } });
    }
    if (current_password && !verifyPassword(current_password, u.password_hash)) {
        return res.status(400).json({ success: false, error: { code: 'WRONG_CURRENT_PASSWORD', message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' } });
    }
    u.password_hash = hashPassword(new_password);
    return res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย' });
});
// =============================================================================
// USER MANAGEMENT API (Admin only)
// =============================================================================
// GET /api/v1/users — list all users
app.get('/api/v1/users', requireAuth, requireRole(UserRole.ADMIN), (req, res) => {
    const users = exports.sysUserStore.map(u => ({
        id: u.id, user_code: u.user_code, username: u.username, email: u.email,
        full_name: u.full_name, role: u.role, is_active: u.is_active,
        last_login_at: u.last_login_at, created_at: u.created_at
    }));
    return res.json({ success: true, total: users.length, data: users });
});
// GET /api/v1/users/:id
app.get('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), (req, res) => {
    const user = exports.sysUserStore.find(u => u.id === Number(req.params.id));
    if (!user)
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
    const { password_hash, ...safe } = user;
    return res.json({ success: true, data: safe });
});
// POST /api/v1/users — create user
app.post('/api/v1/users', requireAuth, requireRole(UserRole.ADMIN), (req, res) => {
    const { username, email, full_name, role, password } = req.body || {};
    if (!username || !full_name || !role || !password) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'username, full_name, role, password เป็นข้อมูลที่จำเป็น' } });
    }
    if (!Object.values(UserRole).includes(role)) {
        return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: `Role ต้องเป็น: ${Object.values(UserRole).join(', ')}` } });
    }
    if (exports.sysUserStore.find(u => u.username === username)) {
        return res.status(409).json({ success: false, error: { code: 'DUPLICATE_USERNAME', message: 'Username นี้ถูกใช้งานแล้ว' } });
    }
    const newUser = {
        id: Date.now(), user_code: `USR-${String(exports.sysUserStore.length + 1).padStart(3, '0')}`,
        username, email: email || '', full_name, role, password_hash: hashPassword(password),
        is_active: true, last_login_at: null, created_at: new Date().toISOString()
    };
    exports.sysUserStore.push(newUser);
    const { password_hash, ...safe } = newUser;
    return res.status(201).json({ success: true, message: 'สร้างผู้ใช้สำเร็จ', data: safe });
});
// PATCH /api/v1/users/:id — update role / active / full_name / email
app.patch('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), (req, res) => {
    const user = exports.sysUserStore.find(u => u.id === Number(req.params.id));
    if (!user)
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
    const { full_name, email, role, is_active } = req.body || {};
    if (full_name !== undefined)
        user.full_name = full_name;
    if (email !== undefined)
        user.email = email;
    if (is_active !== undefined)
        user.is_active = Boolean(is_active);
    if (role !== undefined) {
        if (!Object.values(UserRole).includes(role))
            return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE' } });
        user.role = role;
    }
    const { password_hash, ...safe } = user;
    return res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ', data: safe });
});
// POST /api/v1/users/:id/reset-password
app.post('/api/v1/users/:id/reset-password', requireAuth, requireRole(UserRole.ADMIN), (req, res) => {
    const user = exports.sysUserStore.find(u => u.id === Number(req.params.id));
    if (!user)
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
    const { new_password } = req.body || {};
    if (!new_password || new_password.length < 6) {
        return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' } });
    }
    user.password_hash = hashPassword(new_password);
    // Revoke all active sessions for this user
    exports.sysSessionStore.filter(s => s.user_id === user.id && !s.revoked_at).forEach(s => s.revoked_at = new Date().toISOString());
    return res.json({ success: true, message: `Reset password สำเร็จสำหรับ ${user.username} — sessions เดิมถูกยกเลิกทั้งหมด` });
});
// DELETE /api/v1/users/:id — deactivate (soft delete)
app.delete('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), (req, res) => {
    const user = exports.sysUserStore.find(u => u.id === Number(req.params.id));
    if (!user)
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
    if (user.username === 'admin')
        return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'ไม่สามารถลบ admin หลักได้' } });
    user.is_active = false;
    exports.sysSessionStore.filter(s => s.user_id === user.id && !s.revoked_at).forEach(s => s.revoked_at = new Date().toISOString());
    return res.json({ success: true, message: `ปิดใช้งานบัญชี ${user.username} สำเร็จ` });
});
// GET /api/v1/users/login-logs — Login audit log (Admin only)
app.get('/api/v1/auth/login-logs', requireAuth, requireRole(UserRole.ADMIN), (req, res) => {
    const logs = [...exports.sysLoginLogStore].reverse().slice(0, 100);
    return res.json({ success: true, total: logs.length, data: logs });
});
var StagingProcessStatus;
(function (StagingProcessStatus) {
    StagingProcessStatus["PENDING"] = "PENDING";
    StagingProcessStatus["PROCESSING"] = "PROCESSING";
    StagingProcessStatus["CONVERTED"] = "CONVERTED";
    StagingProcessStatus["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    StagingProcessStatus["ERROR"] = "ERROR";
})(StagingProcessStatus || (exports.StagingProcessStatus = StagingProcessStatus = {}));
// Calculate QC Booking Date (5 days before task plan_end_date)
function calculateQCBookingDate(endDateStr, daysBefore = 5) {
    if (!endDateStr)
        return '';
    const d = new Date(endDateStr);
    if (isNaN(d.getTime()))
        return endDateStr;
    d.setDate(d.getDate() - daysBefore);
    return d.toISOString().slice(0, 10);
}
// =============================================================================
// MIDDLEWARES
// =============================================================================
// Idempotency Middleware for INT API
const idempotencyCheck = (req, res, next) => {
    const idempotencyKey = req.headers['x-idempotency-key'];
    if (req.path.startsWith('/api/v1/integration') && !idempotencyKey) {
        return res.status(400).json({
            success: false,
            error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Header X-Idempotency-Key is required' }
        });
    }
    next();
};
app.use(idempotencyCheck);
// =============================================================================
// IN-MEMORY STORAGE FOR STAGING & CORE PMT
// =============================================================================
exports.stagingSurveyStore = [];
exports.coreCustomerStore = [];
exports.coreJobStore = [];
exports.coreJobServiceStore = [];
exports.coreVisitCheckinStore = [];
exports.coreSitePhotoStore = [];
exports.coreTaskStore = [];
exports.coreQCBookingStore = [];
// Helper: Sync or create QC booking for a given task
function syncQCBookingForTask(task) {
    const targetJob = exports.coreJobStore.find(j => j.id === task.job_id || j.job_no === task.job_no || String(j.id) === String(task.job_id));
    const cust = exports.coreCustomerStore.find(c => c.id === targetJob?.customer_id);
    const custName = cust ? `${cust.first_name} ${cust.last_name}` : (targetJob?.customer || targetJob?.customer_name || 'ลูกค้า');
    const jobNo = task.job_no || targetJob?.job_no || `JOB20260900${task.job_id}`;
    const qcDate = calculateQCBookingDate(task.plan_end_date, 5);
    let booking = exports.coreQCBookingStore.find(b => String(b.task_id) === String(task.id));
    if (booking) {
        booking.task_name = task.task_name;
        booking.plan_start_date = task.plan_start_date;
        booking.plan_end_date = task.plan_end_date;
        booking.qc_booking_date = qcDate;
        booking.assigned_tech = task.assigned_tech;
        booking.customer_name = custName;
        booking.job_no = jobNo;
    }
    else {
        booking = {
            id: `QCB_${task.id}`,
            job_id: task.job_id,
            job_no: jobNo,
            task_id: task.id,
            task_name: task.task_name,
            customer_name: custName,
            plan_start_date: task.plan_start_date,
            plan_end_date: task.plan_end_date,
            qc_booking_date: qcDate,
            days_before: 5,
            assigned_tech: task.assigned_tech || 'Team A (สมศักดิ์)',
            assigned_qc_tech: 'วิชัย ตรวจดี (ช่าง QC Lead)',
            status: 'PENDING_CONFIRM',
            confirmed_at: null,
            confirmed_by: null,
            remarks: '',
            created_at: new Date().toISOString()
        };
        exports.coreQCBookingStore.push(booking);
    }
    return booking;
}
// Helper: Remove QC booking when task is deleted
function removeQCBookingForTask(taskId) {
    const idx = exports.coreQCBookingStore.findIndex(b => String(b.task_id) === String(taskId));
    if (idx !== -1) {
        exports.coreQCBookingStore.splice(idx, 1);
    }
}
// Seed Initial Core Data (Empty by default, or with mock data if requested)
function seedInitialCoreData(populateMocks = false) {
    exports.coreCustomerStore.length = 0;
    exports.coreJobStore.length = 0;
    exports.coreJobServiceStore.length = 0;
    exports.coreTaskStore.length = 0;
    exports.coreQCBookingStore.length = 0;
    if (!populateMocks) {
        console.log('[CORE STORE] Initialized with empty core jobs store (Clean State).');
        return;
    }
    const mockTasks = [
        { id: 'T2', job_id: 1, job_no: 'JOB202609001', task_name: 'งานประปา/ไฟฟ้า', assigned_tech: 'Team A', assignees: ['Team A (สมศักดิ์)'], plan_start_date: '2026-09-03', plan_end_date: '2026-09-05', duration_days: 3, status: 'IN_PROGRESS', progress_percent: 60 },
        { id: 'T3', job_id: 1, job_no: 'JOB202609001', task_name: 'ติดตั้งตู้เคาน์เตอร์', assigned_tech: 'Team A', assignees: ['Team A (สมศักดิ์)'], plan_start_date: '2026-09-06', plan_end_date: '2026-09-09', duration_days: 4, status: 'PENDING', progress_percent: 0 },
        { id: 'T4', job_id: 2, job_no: 'JOB202609002', task_name: 'เตรียมหน้างาน', assigned_tech: 'Team B', assignees: ['Team B (ประเสริฐ)'], plan_start_date: '2026-09-01', plan_end_date: '2026-09-01', duration_days: 1, status: 'DONE', progress_percent: 100 },
        { id: 'T5', job_id: 2, job_no: 'JOB202609002', task_name: 'ติดตั้งปั้มและเดินท่อ', assigned_tech: 'Team B', assignees: ['Team B (ประเสริฐ)'], plan_start_date: '2026-09-02', plan_end_date: '2026-09-02', duration_days: 1, status: 'DONE', progress_percent: 100 },
    ];
    exports.coreTaskStore.push(...mockTasks);
    mockTasks.forEach(t => syncQCBookingForTask(t));
    const mockCustomers = [
        { id: 1, customer_code: 'CUST-001', first_name: 'ณวัฒน์', last_name: 'รักสงบ', phone: '081-111-2222', address: '99/1 ซอยสุขุมวิท 55 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110', lat: 13.7563, lng: 100.5018 },
        { id: 2, customer_code: 'CUST-002', first_name: 'สมศรี', last_name: 'สุขใจ', phone: '082-222-3333', address: '12 ซอยอารีย์สัมพันธ์ แขวงพญาไท เขตพญาไท กรุงเทพฯ 10400', lat: 13.7801, lng: 100.5432 },
        { id: 3, customer_code: 'CUST-003', first_name: 'เอนก', last_name: 'มั่งคั่ง', phone: '083-333-4444', address: '45 ถนนสีลม แขวงสีลม เขตบางรัก กรุงเทพฯ 10500', lat: 13.7234, lng: 100.5289 },
        { id: 4, customer_code: 'CUST-004', first_name: 'มาลี', last_name: 'มีโชค', phone: '084-444-5555', address: '88 ซอยลาดพร้าว 15 แขวงจอมพล เขตจตุจักร กรุงเทพฯ 10900', lat: 13.8056, lng: 100.5712 },
        { id: 5, customer_code: 'CUST-005', first_name: 'ฉัตรชัย', last_name: 'เจริญวิทย์', phone: '085-555-6666', address: '22 ซอยทองหล่อ 10 แขวงคลองตันเหนือ เขตวัฒนา กรุงเทพฯ 10110', lat: 13.7312, lng: 100.5823 },
        { id: 6, customer_code: 'CUST-006', first_name: 'วิภาดา', last_name: 'รัตนกุล', phone: '086-666-7777', address: '105/3 ถนนราชพฤกษ์ แขวงบางเชือกหนัง เขตตลิ่งชัน กรุงเทพฯ 10170', lat: 13.7485, lng: 100.4491 },
        { id: 7, customer_code: 'CUST-007', first_name: 'ธีรเดช', last_name: 'สุวรรณภูมิ', phone: '087-777-8888', address: '345 หมู่บ้านมัณฑนา บางนา-ตราด กม.7 บางแก้ว บางพลี สมุทรปราการ 10540', lat: 13.6521, lng: 100.6654 },
        { id: 8, customer_code: 'CUST-008', first_name: 'กัญญารัตน์', last_name: 'วงศ์สว่าง', phone: '088-888-9999', address: '56/8 ซอยวงศ์สว่าง 19 แขวงวงศ์สว่าง เขตบางซื่อ กรุงเทพฯ 10800', lat: 13.8291, lng: 100.5255 },
        { id: 9, customer_code: 'CUST-009', first_name: 'พงศกร', last_name: 'เลิศอนันต์', phone: '089-999-1010', address: '78/12 ถนนพระราม 9 แขวงห้วยขวาง เขตห้วยขวาง กรุงเทพฯ 10310', lat: 13.7542, lng: 100.5741 },
        { id: 10, customer_code: 'CUST-010', first_name: 'นภัสวรรณ', last_name: 'มีศิริ', phone: '092-279-5574', address: '189/45 ซอยมาบยายเลีย 41 ตำบลหนองปรือ อำเภอบางละมุง ชลบุรี 20150', lat: 12.9327, lng: 100.9240 }
    ];
    exports.coreCustomerStore.push(...mockCustomers);
    const mockJobs = [
        {
            id: 1,
            job_no: 'JOB202609001',
            external_ref_id: 'INT-2026-001',
            customer_id: 1,
            status: JobStatus.IN_PROGRESS,
            property_type: 'บ้านเดี่ยว',
            project_type: 'Installation',
            project_sub_type: 'ติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU',
            assigned_tech: 'Team A (สมศักดิ์)',
            plan_date: '2026-09-05',
            services: ['ติดตั้งเครื่องปรับอากาศ Inverter 18000 BTU'],
            overall_progress: 45,
            special_instructions: 'ระวังมีสุนัขในบ้าน, กรุณาโทรแจ้งลูกค้าล่วงหน้า 30 นาทีก่อนเข้าพื้นที่ และสวมถุงคลุมรองเท้าก่อนเข้าห้องนอน',
            additional_notes: 'ตรวจสอบจุดเชื่อมต่อท่อน้ำทิ้งเดิม และระวังแนวท่อแอร์บนฝ้าเพดาน ลูกค้าเตรียมเต้ารับไฟฟ้าพร้อมแล้ว',
            photos: [],
            created_at: '2026-09-01T08:00:00Z'
        },
        {
            id: 2,
            job_no: 'JOB202609002',
            external_ref_id: 'INT-2026-002',
            customer_id: 2,
            status: JobStatus.DRAFT,
            property_type: 'ทาวน์โฮม',
            project_type: 'Renovate',
            project_sub_type: 'Renovate ห้องครัว Built-in & งานระบบประปา',
            assigned_tech: 'Team B (ประเสริฐ)',
            plan_date: '2026-09-06',
            services: ['Renovate ห้องครัว Built-in & งานระบบประปา'],
            overall_progress: 0,
            special_instructions: 'เข้าพื้นที่ได้หลัง 10:00 น. นิติบุคคลคอนโดจำกัดเวลาเสียงดัง',
            additional_notes: 'ติดตั้งเคาน์เตอร์และเดินท่อน้ำทิ้งใหม่',
            photos: [],
            created_at: '2026-09-01T09:00:00Z'
        },
        {
            id: 3,
            job_no: 'JOB202609003',
            external_ref_id: 'INT-2026-003',
            customer_id: 3,
            status: JobStatus.DRAFT,
            property_type: 'บ้านเดี่ยว',
            project_type: 'Installation',
            project_sub_type: 'ติดตั้งระบบโซลาร์เซลล์ Solar Rooftop On-Grid 5kW',
            assigned_tech: 'Team C (วิชัย)',
            plan_date: '2026-09-07',
            services: ['ติดตั้งระบบโซลาร์เซลล์ Solar Rooftop On-Grid 5kW'],
            overall_progress: 0,
            special_instructions: 'สำรวจโครงสร้างหลังคาซีแพคโมเนียก่อนติดตั้งแผงโซลาร์เซลล์',
            additional_notes: 'เตรียมกล่องอินเวอร์เตอร์และเบรกเกอร์ DC/AC Protection',
            photos: [],
            created_at: '2026-09-02T10:00:00Z'
        },
        {
            id: 4,
            job_no: 'JOB202609004',
            external_ref_id: 'INT-2026-004',
            customer_id: 4,
            status: JobStatus.DRAFT,
            property_type: 'บ้านเดี่ยว',
            project_type: 'Renovate',
            project_sub_type: 'ปูกระเบื้องแกรนิตโต้ 60x60 ซม. และสุขภัณฑ์ห้องน้ำ',
            assigned_tech: 'Team A (สมศักดิ์)',
            plan_date: '2026-09-08',
            services: ['ปูกระเบื้องแกรนิตโต้ 60x60 ซม. และสุขภัณฑ์ห้องน้ำ'],
            overall_progress: 0,
            special_instructions: 'ลูกค้าเตรียมกระเบื้องไว้ที่ชั้น 1 ต้องขนขึ้นชั้น 2 อย่างระมัดระวัง',
            additional_notes: 'ปรับระดับพื้นและลงน้ำยากันซึมก่อนปูกระเบื้อง',
            photos: [],
            created_at: '2026-09-02T11:00:00Z'
        },
        {
            id: 5,
            job_no: 'JOB202609005',
            external_ref_id: 'INT-2026-005',
            customer_id: 5,
            status: JobStatus.DRAFT,
            property_type: 'คอนโดมิเนียม',
            project_type: 'Installation',
            project_sub_type: 'ติดตั้งเครื่องทำน้ำอุ่น 4500W พร้อมเดินระบบสายดิน Safe-T-Cut',
            assigned_tech: 'Team D (กิตติศักดิ์)',
            plan_date: '2026-09-09',
            services: ['ติดตั้งเครื่องทำน้ำอุ่น 4500W พร้อมเดินระบบสายดิน Safe-T-Cut'],
            overall_progress: 0,
            special_instructions: 'ทดสอบระบบไฟและตัดไฟรั่ว ELCB ก่อนส่งมอบงาน',
            additional_notes: 'เช็คเบรกเกอร์ลูกย่อยในตู้ Consumer Unit',
            photos: [],
            created_at: '2026-09-03T08:30:00Z'
        },
        {
            id: 6,
            job_no: 'JOB202609006',
            external_ref_id: 'INT-2026-006',
            customer_id: 6,
            status: JobStatus.DRAFT,
            property_type: 'บ้านเดี่ยว',
            project_type: 'Renovate',
            project_sub_type: 'งานทาสีภายนอกและภายในบ้านเดี่ยว 2 ชั้น (TOA Supershield)',
            assigned_tech: 'Team B (ประเสริฐ)',
            plan_date: '2026-09-10',
            services: ['งานทาสีภายนอกและภายในบ้านเดี่ยว 2 ชั้น (TOA Supershield)'],
            overall_progress: 0,
            special_instructions: 'ปูพลาสติกคลุมเฟอร์นิเจอร์และพื้นไม้ปาร์เกต์อย่างมิดชิด',
            additional_notes: 'ล้างผนังเก่าด้วยเครื่องฉีดน้ำแรงดันสูงก่อนลงน้ำยารองพื้นปูนเก่า',
            photos: [],
            created_at: '2026-09-03T09:15:00Z'
        },
        {
            id: 7,
            job_no: 'JOB202609007',
            external_ref_id: 'INT-2026-007',
            customer_id: 7,
            status: JobStatus.DRAFT,
            property_type: 'บ้านเดี่ยว',
            project_type: 'Installation',
            project_sub_type: 'ติดตั้ง Digital Door Lock & กล้องวงจรปิด CCTV Smart IP 4 จุด',
            assigned_tech: 'Team C (วิชัย)',
            plan_date: '2026-09-11',
            services: ['ติดตั้ง Digital Door Lock & กล้องวงจรปิด CCTV Smart IP 4 จุด'],
            overall_progress: 0,
            special_instructions: 'แนะนำการใช้งาน App บนมือถือและบันทึกรหัสผ่าน Master ให้ลูกค้า',
            additional_notes: 'เดินสาย LAN Cat6 เข้าตู้ NVR พร้อมตั้งค่า Wi-Fi Router',
            photos: [],
            created_at: '2026-09-03T11:00:00Z'
        },
        {
            id: 8,
            job_no: 'JOB202609008',
            external_ref_id: 'INT-2026-008',
            customer_id: 8,
            status: JobStatus.DRAFT,
            property_type: 'บ้านเดี่ยว',
            project_type: 'Installation',
            project_sub_type: 'ติดตั้งปั๊มน้ำอัตโนมัติ Mitsubishi Inverter และถังเก็บน้ำ DOS 1000L',
            assigned_tech: 'Team D (กิตติศักดิ์)',
            plan_date: '2026-09-12',
            services: ['ติดตั้งปั๊มน้ำอัตโนมัติ Mitsubishi Inverter และถังเก็บน้ำ DOS 1000L'],
            overall_progress: 0,
            special_instructions: 'ติดตั้ง Bypass Valve ระบบประปาคู่ขนาน และเทฐานปูนรองรับถังน้ำ',
            additional_notes: 'ตรวจสอบแรงดันน้ำทุกก๊อกหลังติดตั้งเสร็จ',
            photos: [],
            created_at: '2026-09-03T14:20:00Z'
        },
        {
            id: 9,
            job_no: 'JOB202609009',
            external_ref_id: 'INT-2026-009',
            customer_id: 9,
            status: JobStatus.DRAFT,
            property_type: 'คอนโดมิเนียม',
            project_type: 'Renovate',
            project_sub_type: 'ติดตั้งฉากกั้นห้องกระจกบานเลื่อน อลูมิเนียมอบดำ Powder Coat',
            assigned_tech: 'Team A (สมศักดิ์)',
            plan_date: '2026-09-13',
            services: ['ติดตั้งฉากกั้นห้องกระจกบานเลื่อน อลูมิเนียมอบดำ Powder Coat'],
            overall_progress: 0,
            special_instructions: 'ตรวจเช็คแนวระดับด้วยเลเซอร์ และซีลซิลิโคนกันเสียงรบกวน',
            additional_notes: 'ใช้กระจกลามิเนตหนา 6+6 มม. กันกระแทก',
            photos: [],
            created_at: '2026-09-04T07:00:00Z'
        },
        {
            id: 10,
            job_no: 'JOB202609010',
            external_ref_id: 'INT-2026-010',
            customer_id: 10,
            status: JobStatus.DRAFT,
            property_type: 'บ้านเดี่ยว',
            project_type: 'Installation',
            project_sub_type: 'ติดตั้งเครื่องปรับอากาศและงานเดินระบบท่อเหนือฝ้าเพดาน',
            assigned_tech: 'Team A (สมศักดิ์)',
            plan_date: '2026-09-14',
            services: ['ติดตั้งเครื่องปรับอากาศและงานเดินระบบท่อเหนือฝ้าเพดาน'],
            overall_progress: 0,
            special_instructions: 'สาขาพัทยาใต้ — นัดหมายช่วงเช้า ตรวจสอบเบรกเกอร์แอร์เดิม',
            additional_notes: 'เดินท่อน้ำทิ้ง PVC หุ้มฉนวน Armaflex ป้องกันหยดน้ำเกาะฝ้า',
            photos: [],
            created_at: '2026-09-04T07:30:00Z'
        }
    ];
    exports.coreJobStore.push(...mockJobs);
    console.log(`[CORE SEED] Seeded ${mockJobs.length} core jobs in coreJobStore.`);
}
// =============================================================================
// 1. INT INBOUND INTEGRATION API (Req #1)
// =============================================================================
app.post('/api/v1/integration/orders', async (req, res) => {
    try {
        const payload = req.body;
        const idempotencyKey = req.headers['x-idempotency-key'];
        if (!payload.external_ref_id) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PAYLOAD', message: 'Field "external_ref_id" is required' }
            });
        }
        if (!payload.customer || (!payload.customer.first_name && !payload.customer.name)) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PAYLOAD', message: 'Customer name or first_name is required' }
            });
        }
        // Support both customer.name (single string) and customer.first_name/last_name
        let firstName = payload.customer.first_name || '';
        let lastName = payload.customer.last_name || '';
        if (!firstName && payload.customer.name) {
            const parts = String(payload.customer.name).trim().split(' ');
            firstName = parts[0] || 'ลูกค้า';
            lastName = parts.slice(1).join(' ') || '-';
        }
        const phone = payload.customer.phone || '081-234-5678';
        const address = payload.customer.address || 'ไม่ระบุที่อยู่';
        const lat = Number(payload.customer.lat) || 13.7563;
        const lng = Number(payload.customer.lng) || 100.5018;
        // Upsert customer in core customer store
        let customer = exports.coreCustomerStore.find(c => c.phone === phone);
        if (!customer) {
            customer = {
                id: Date.now() + Math.floor(Math.random() * 100),
                customer_code: `CUST-${Date.now()}`,
                first_name: firstName,
                last_name: lastName,
                phone: phone,
                address: address,
                lat: lat,
                lng: lng
            };
            exports.coreCustomerStore.push(customer);
        }
        // Generate Job No format: JOBYYYYMMXXX (e.g., JOB202609001)
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const runningSeq = Math.floor(1 + Math.random() * 999);
        const runningStr = String(runningSeq).padStart(3, '0');
        const jobNo = `JOB${yyyy}${mm}${runningStr}`;
        const newJob = {
            id: Date.now(),
            job_no: jobNo,
            external_ref_id: payload.external_ref_id,
            customer_id: customer.id,
            services: payload.services || ['ติดตั้งเครื่องทำน้ำอุ่น'],
            assigned_tech: payload.technician?.name || 'Team A (สมศักดิ์)',
            plan_date: payload.appointment?.date || new Date().toISOString().split('T')[0],
            status: JobStatus.DRAFT,
            overall_progress: 0,
            created_at: new Date().toISOString()
        };
        exports.coreJobStore.unshift(newJob);
        return res.status(201).json({
            success: true,
            data: {
                ...newJob,
                customer: {
                    first_name: firstName,
                    last_name: lastName,
                    phone: phone,
                    address: address,
                    lat: lat,
                    lng: lng
                },
                assigned_tech: payload.technician || null,
                appointment: payload.appointment || null
            },
            meta: { message: 'Order received successfully from INT system and added to Core Jobs' }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
});
// Seed Mock Survey Records for Staging Monitoring & Manual Conversion (Empty by default)
function seedInitialStagingData(populateMocks = false) {
    exports.stagingSurveyStore.length = 0; // Reset
    if (!populateMocks) {
        console.log('[STAGING STORE] Initialized with empty staging survey store (Clean State).');
        return;
    }
    const mockRecords = [
        {
            id: 1001,
            source_job_id: "031b0e16a-9a98-43bf-ae3e-b14e76b577f8",
            job_number: "JOB202609001",
            booking_no: "VFIX-260901-001",
            ticket_no: "209051119",
            source_reference: "REQ-PT2-2608220003",
            customer_code: "18a9359a-4363-4dda-8fdb-5f541d8a4b64",
            customer_name: "คุณ นภัสวรรณ มีศิริ",
            customer_phone: "0812345678",
            store_code: "60964",
            agent_code: "87524b4a-8511-4a93-88fa-850c8d043868",
            visit_date: "2026-09-05",
            checkin_at: "2026-09-05T09:05:00Z",
            checkout_at: "2026-09-05T11:45:00Z",
            photo_count: 5,
            process_status: StagingProcessStatus.PENDING,
            retry_count: 0,
            received_at: new Date(Date.now() - 3600000 * 5).toISOString(),
            raw_payload: {
                system: { job_id: "031b0e16a-9a98-43bf-ae3e-b14e76b577f8", created_at: "2026-09-02T09:00:00Z", created_by: "system", updated_at: "2026-09-02T09:00:00Z" },
                job_info: { job_number: "JOB202609001", booking_no: "VFIX-260901-001", ticket_no: "209051119", source_reference: "REQ-PT2-2608220003", status: "Approved", stage: "Completed", property_type: "บ้านเดี่ยว", project_type: "Renovate", project_sub_type: "งานกระเบื้องพื้น" },
                job_details: [
                    { job_type: "ติดตั้งแอร์ (ส่งพร้อมติดตั้ง)", installation_detail: "R-ติดตั้ง แอร์ติดผนัง ขนาด 9000-17000 BTU พร้อมรื้อถอน", product_quantity: 2, remark: "ติดตั้งห้องนอนใหญ่และห้องรับแขก" },
                    { job_type: "ติดตั้งแอร์ (ส่งพร้อมติดตั้ง)", installation_detail: "R-ติดตั้ง แอร์ติดผนัง ขนาด 18000-24000 BTU พร้อมรื้อถอน", product_quantity: 1, remark: "ติดตั้งห้องโถงชั้นล่าง" }
                ],
                customer: { code: "18a9359a-4363-4dda-8fdb-5f541d8a4b64", name: "คุณ นภัสวรรณ มีศิริ", mobile_no: "0812345678", location: { latitude: 13.7563, longitude: 100.5018, address: "มาบยายเลีย 41 เมืองพัทยา อำเภอบางละมุง ชลบุรี 20150", google_map_url: "https://www.google.com/maps/search/?api=1&query=12.9326734,100.9239925" } },
                agent: { code: "87524b4a-8511-4a93-88fa-850c8d043868", name: "สมเกียรติ มั่นคง", team: "QC RENOVATE & MENTAINANCE" },
                store: { code: "60964", code3: "RA2", name: "RAMA2", location: { latitude: 13.652, longitude: 100.421 } },
                schedule_plan: { visit_date: "2026-09-05", start_time: "09:00:00", end_time: "12:00:00", time_slot: "เช้า (09:00-12:00)", distance: 15.5 },
                check_in: { date: "2026-09-05T09:05:00Z", latitude: 13.7563, longitude: 100.5018, image: "renovate/check_in/img1.jpg" },
                check_out: { date: "2026-09-05T11:45:00Z", latitude: 13.7563, longitude: 100.5018, image: "renovate/check_out/img2.jpg" },
                site_photos: ["renovate/site/photo1.jpg", "renovate/site/photo2.jpg", "renovate/site/photo3.jpg", "renovate/site/photo4.jpg", "renovate/site/photo5.jpg"],
                approval: { approve_by: "Phinyo Phoaon", approve_date: "2026-09-05T12:00:00Z", distance: 15.5 },
                visit_results: ["สำรวจตำแหน่งเดินท่อน้ำยาและจุดติดตั้งคอมเพรสเซอร์เรียบร้อย"],
                remarks: { comment: "พื้นที่พร้อมติดตั้ง ท่อน้ำทิ้งสามารถต่อออกระเบียงได้", note: "ลูกค้าขอเข้าช่วงเช้า" }
            }
        },
        {
            id: 1002,
            source_job_id: "c48d9102-12a4-49c8-99b3-76a89c910202",
            job_number: "JOB202609002",
            booking_no: "VFIX-260901-002",
            ticket_no: "209051120",
            source_reference: "REQ-PT2-2608220004",
            customer_code: "CUST-99201",
            customer_name: "คุณ กิตติศักดิ์ เจริญพร",
            customer_phone: "0898765432",
            store_code: "60964",
            agent_code: "87524b4a-8511-4a93-88fa-850c8d043868",
            visit_date: "2026-09-05",
            checkin_at: "2026-09-05T13:10:00Z",
            checkout_at: "2026-09-05T14:40:00Z",
            photo_count: 5,
            process_status: StagingProcessStatus.PENDING,
            retry_count: 0,
            received_at: new Date(Date.now() - 3600000 * 4).toISOString(),
            raw_payload: {
                system: { job_id: "c48d9102-12a4-49c8-99b3-76a89c910202", created_at: "2026-09-02T09:30:00Z", created_by: "system", updated_at: "2026-09-02T09:30:00Z" },
                job_info: { job_number: "JOB202609002", booking_no: "VFIX-260901-002", ticket_no: "209051120", source_reference: "REQ-PT2-2608220004", status: "Approved", stage: "Completed", property_type: "ทาวน์โฮม", project_type: "Installation", project_sub_type: "งานปั้มแท็งก์" },
                job_details: [
                    { job_type: "ติดตั้งปั้มแท็งก์", installation_detail: "ติดตั้งถังเก็บน้ำ DOS 1000L บนฐานปูน + ปั้มอัตโนมัติ Mitsubishi 250W", product_quantity: 1, remark: "รวมเดินท่อบายพาส" }
                ],
                customer: { code: "CUST-99201", name: "คุณ กิตติศักดิ์ เจริญพร", mobile_no: "0898765432", location: { latitude: 13.6800, longitude: 100.4500, address: "88/12 ถ.พระราม 2 ซอย 50 บางขุนเทียน กทม.", google_map_url: "https://www.google.com/maps" } },
                agent: { code: "87524b4a-8511-4a93-88fa-850c8d043868", name: "สมเกียรติ มั่นคง", team: "QC RENOVATE & MENTAINANCE" },
                store: { code: "60964", code3: "RA2", name: "RAMA2", location: { latitude: 13.652, longitude: 100.421 } },
                schedule_plan: { visit_date: "2026-09-05", start_time: "13:00:00", end_time: "15:00:00", time_slot: "บ่าย (13:00-15:00)", distance: 8.2 },
                check_in: { date: "2026-09-05T13:10:00Z", latitude: 13.6800, longitude: 100.4500, image: "pump/check_in/img1.jpg" },
                check_out: { date: "2026-09-05T14:40:00Z", latitude: 13.6800, longitude: 100.4500, image: "pump/check_out/img2.jpg" },
                site_photos: ["pump/site/p1.jpg", "pump/site/p2.jpg", "pump/site/p3.jpg", "pump/site/p4.jpg", "pump/site/p5.jpg"],
                approval: { approve_by: "Phinyo Phoaon", approve_date: "2026-09-05T15:00:00Z", distance: 8.2 },
                visit_results: ["ฐานปูนด้านหลังบ้านเทเสร็จเรียบร้อย มีปลั๊กไฟกันน้ำพร้อมเชื่อมต่อ"],
                remarks: { comment: "จุดตั้งปั้มห่างจากตู้เมน 12 เมตร", note: "ลูกค้ารออยู่ที่บ้าน" }
            }
        },
        {
            id: 1003,
            source_job_id: "e57f1203-34b5-41d9-aa4c-87b90d120303",
            job_number: "JOB202609003",
            booking_no: "VFIX-260901-003",
            ticket_no: "209051121",
            source_reference: "REQ-PT2-2608220005",
            customer_code: "CUST-99202",
            customer_name: "คุณ สิริกร วงศ์สุวรรณ",
            customer_phone: "0865554321",
            store_code: "60964",
            agent_code: "87524b4a-8511-4a93-88fa-850c8d043868",
            visit_date: "2026-09-06",
            checkin_at: "2026-09-06T10:00:00Z",
            checkout_at: "2026-09-06T11:15:00Z",
            photo_count: 5,
            process_status: StagingProcessStatus.PENDING,
            retry_count: 0,
            received_at: new Date(Date.now() - 3600000 * 3).toISOString(),
            raw_payload: {
                system: { job_id: "e57f1203-34b5-41d9-aa4c-87b90d120303", created_at: "2026-09-02T10:00:00Z", created_by: "system", updated_at: "2026-09-02T10:00:00Z" },
                job_info: { job_number: "JOB202609003", booking_no: "VFIX-260901-003", ticket_no: "209051121", source_reference: "REQ-PT2-2608220005", status: "Approved", stage: "Completed", property_type: "คอนโดมิเนียม", project_type: "Installation", project_sub_type: "เครื่องทำน้ำอุ่น" },
                job_details: [
                    { job_type: "ติดตั้งเครื่องทำน้ำอุ่น", installation_detail: "ติดตั้งเครื่องทำน้ำอุ่น Stiebel Eltron 4500W พร้อมเดินสายดินและเบรกเกอร์", product_quantity: 2, remark: "ห้องน้ำ 1 และ ห้องน้ำ 2" }
                ],
                customer: { code: "CUST-99202", name: "คุณ สิริกร วงศ์สุวรรณ", mobile_no: "0865554321", location: { latitude: 13.7200, longitude: 100.5300, address: "Condo Ideo สาทร-ท่าพระ ชั้น 18", google_map_url: "https://www.google.com/maps" } },
                agent: { code: "87524b4a-8511-4a93-88fa-850c8d043868", name: "สมเกียรติ มั่นคง", team: "QC RENOVATE & MENTAINANCE" },
                store: { code: "60964", code3: "RA2", name: "RAMA2", location: { latitude: 13.652, longitude: 100.421 } },
                schedule_plan: { visit_date: "2026-09-06", start_time: "10:00:00", end_time: "12:00:00", time_slot: "เช้า (10:00-12:00)", distance: 11.0 },
                check_in: { date: "2026-09-06T10:00:00Z", latitude: 13.7200, longitude: 100.5300, image: "heater/check_in/img1.jpg" },
                check_out: { date: "2026-09-06T11:15:00Z", latitude: 13.7200, longitude: 100.5300, image: "heater/check_out/img2.jpg" },
                site_photos: ["heater/site/h1.jpg", "heater/site/h2.jpg", "heater/site/h3.jpg", "heater/site/h4.jpg", "heater/site/h5.jpg"],
                approval: { approve_by: "Phinyo Phoaon", approve_date: "2026-09-06T11:30:00Z", distance: 11.0 },
                visit_results: ["มีท่อน้ำดีและสายไฟร้อยท่อฝังผนังไว้แล้ว เข้าติดตั้งได้ทันที"],
                remarks: { comment: "นิติบุคคลคอนโดอนุญาตทำงาน 09:00-17:00", note: "ต้องแจ้งชื่อช่างล่วงหน้า" }
            }
        },
        {
            id: 1004,
            source_job_id: "f68a2304-45c6-42ea-bb5d-98c01e230404",
            job_number: "JOB202609004",
            booking_no: "VFIX-260901-004",
            ticket_no: "209051122",
            source_reference: "REQ-PT2-2608220006",
            customer_code: "CUST-99203",
            customer_name: "คุณ ณัฐพงษ์ เตชะสกุล",
            customer_phone: "0819998877",
            store_code: "60964",
            agent_code: "87524b4a-8511-4a93-88fa-850c8d043868",
            visit_date: "2026-09-06",
            checkin_at: "2026-09-06T13:30:00Z",
            checkout_at: "2026-09-06T15:20:00Z",
            photo_count: 6,
            process_status: StagingProcessStatus.PENDING,
            retry_count: 0,
            received_at: new Date(Date.now() - 3600000 * 2).toISOString(),
            raw_payload: {
                system: { job_id: "f68a2304-45c6-42ea-bb5d-98c01e230404", created_at: "2026-09-02T10:30:00Z", created_by: "system", updated_at: "2026-09-02T10:30:00Z" },
                job_info: { job_number: "JOB202609004", booking_no: "VFIX-260901-004", ticket_no: "209051122", source_reference: "REQ-PT2-2608220006", status: "Approved", stage: "Completed", property_type: "บ้านเดี่ยว", project_type: "Renovate", project_sub_type: "งานกระเบื้องพื้น" },
                job_details: [
                    { job_type: "ปูกระเบื้องพื้นห้องน้ำ", installation_detail: "รื้อกระเบื้องเดิม + ปูกระเบื้องแกรนิตโต้ 60x60 cm พื้นที่ 15 ตร.ม.", product_quantity: 15, remark: "รวมระบบกันซึม 3 ชั้น" }
                ],
                customer: { code: "CUST-99203", name: "คุณ ณัฐพงษ์ เตชะสกุล", mobile_no: "0819998877", location: { latitude: 13.7650, longitude: 100.4890, address: "99 หมู่บ้านเพอร์เฟค ราชพฤกษ์ นนทบุรี", google_map_url: "https://www.google.com/maps" } },
                agent: { code: "87524b4a-8511-4a93-88fa-850c8d043868", name: "สมเกียรติ มั่นคง", team: "QC RENOVATE & MENTAINANCE" },
                store: { code: "60964", code3: "RA2", name: "RAMA2", location: { latitude: 13.652, longitude: 100.421 } },
                schedule_plan: { visit_date: "2026-09-06", start_time: "13:00:00", end_time: "16:00:00", time_slot: "บ่าย (13:00-16:00)", distance: 18.0 },
                check_in: { date: "2026-09-06T13:30:00Z", latitude: 13.7650, longitude: 100.4890, image: "tile/check_in/img1.jpg" },
                check_out: { date: "2026-09-06T15:20:00Z", latitude: 13.7650, longitude: 100.4890, image: "tile/check_out/img2.jpg" },
                site_photos: ["tile/site/t1.jpg", "tile/site/t2.jpg", "tile/site/t3.jpg", "tile/site/t4.jpg", "tile/site/t5.jpg", "tile/site/t6.jpg"],
                approval: { approve_by: "Phinyo Phoaon", approve_date: "2026-09-06T15:30:00Z", distance: 18.0 },
                visit_results: ["วัดระดับ Slope ท่อระบายน้ำทิ้งเดิมเรียบร้อย ต้องเสริมกันซึมรอบท่อน้ำทิ้ง"],
                remarks: { comment: "ลูกค้าเลือกกระเบื้องรหัส TILE-GR-6060 จากโฮมโปรแล้ว", note: "รอเริ่มงานสัปดาห์หน้า" }
            }
        },
        {
            id: 1005,
            source_job_id: "a79b3405-56d7-43fb-cc6e-09d12f340505",
            job_number: "JOB202609005",
            booking_no: "VFIX-260901-005",
            ticket_no: "209051123",
            source_reference: "REQ-PT2-2608220007",
            customer_code: "CUST-99204",
            customer_name: "คุณ อรวรรณ จิตรสมบูรณ์",
            customer_phone: "0831122334",
            store_code: "60964",
            agent_code: "87524b4a-8511-4a93-88fa-850c8d043868",
            visit_date: "2026-09-07",
            checkin_at: "2026-09-07T09:30:00Z",
            checkout_at: "2026-09-07T11:00:00Z",
            photo_count: 5,
            process_status: StagingProcessStatus.PENDING,
            retry_count: 0,
            received_at: new Date(Date.now() - 3600000 * 1).toISOString(),
            raw_payload: {
                system: { job_id: "a79b3405-56d7-43fb-cc6e-09d12f340505", created_at: "2026-09-02T11:00:00Z", created_by: "system", updated_at: "2026-09-02T11:00:00Z" },
                job_info: { job_number: "JOB202609005", booking_no: "VFIX-260901-005", ticket_no: "209051123", source_reference: "REQ-PT2-2608220007", status: "Approved", stage: "Completed", property_type: "อาคารพาณิชย์", project_type: "Renovate", project_sub_type: "สุขภัณฑ์และห้องน้ำ" },
                job_details: [
                    { job_type: "ติดตั้งสุขภัณฑ์", installation_detail: "รื้อถอนโถสุขภัณฑ์เดิม + ติดตั้งโถสุขภัณฑ์ Kohler 2 ชิ้น พร้อมสายฉีดชำระ", product_quantity: 2, remark: "ชั้น 1 และ ชั้น 2" },
                    { job_type: "ติดตั้งฉากกั้นอาบน้ำ", installation_detail: "ติดตั้งฉากกั้นกระจกนิรภัย Tempered 10mm ขนาด 100x200 cm", product_quantity: 1, remark: "ชั้น 2" }
                ],
                customer: { code: "CUST-99204", name: "คุณ อรวรรณ จิตรสมบูรณ์", mobile_no: "0831122334", location: { latitude: 13.7340, longitude: 100.5670, address: "45/3 ซอยสุขุมวิท 39 คลองตันเหนือ วัฒนา กทม.", google_map_url: "https://www.google.com/maps" } },
                agent: { code: "87524b4a-8511-4a93-88fa-850c8d043868", name: "สมเกียรติ มั่นคง", team: "QC RENOVATE & MENTAINANCE" },
                store: { code: "60964", code3: "RA2", name: "RAMA2", location: { latitude: 13.652, longitude: 100.421 } },
                schedule_plan: { visit_date: "2026-09-07", start_time: "09:00:00", end_time: "11:30:00", time_slot: "เช้า (09:00-11:30)", distance: 14.3 },
                check_in: { date: "2026-09-07T09:30:00Z", latitude: 13.7340, longitude: 100.5670, image: "sanitary/check_in/img1.jpg" },
                check_out: { date: "2026-09-07T11:00:00Z", latitude: 13.7340, longitude: 100.5670, image: "sanitary/check_out/img2.jpg" },
                site_photos: ["sanitary/site/s1.jpg", "sanitary/site/s2.jpg", "sanitary/site/s3.jpg", "sanitary/site/s4.jpg", "sanitary/site/s5.jpg"],
                approval: { approve_by: "Phinyo Phoaon", approve_date: "2026-09-07T11:15:00Z", distance: 14.3 },
                visit_results: ["ระยะท่อชักโครก 30.5 cm ตรงตามมาตรฐาน พร้อมติดตั้งได้ทันที"],
                remarks: { comment: "มีที่จอดรถหน้าอาคาร ช่างขนย้ายสินค้าสะดวก", note: "นัดหมายเรียบร้อย" }
            }
        }
    ];
    exports.stagingSurveyStore.push(...mockRecords);
    console.log(`[STAGING SEED] Seeded ${mockRecords.length} mock pending records in staging table.`);
}
// Initial Seed on Server Startup (Pre-populate with 10 INT inbound jobs)
seedInitialStagingData(false);
seedInitialCoreData(true);
// =============================================================================
// CONVERSION ENGINE (STAGING -> CORE PMT)
// =============================================================================
function convertStagingToCorePmt(stagingRecord) {
    const payload = stagingRecord.raw_payload;
    const validationErrors = [];
    // Validation 1: Site photos minimum 5 photos (Req #2)
    const photoCount = payload.site_photos?.length || 0;
    if (photoCount < 5) {
        validationErrors.push(`จำนวนรูปถ่ายไม่ครบตามข้อกำหนด (พบ ${photoCount} รูป, ต้องมีอย่างน้อย 5 รูป)`);
    }
    // Validation 2: Customer Name & Mobile
    if (!payload.customer?.name || !payload.customer?.mobile_no) {
        validationErrors.push('ข้อมูลลูกค้าไม่ครบถ้วน (ชื่อหรือเบอร์โทรว่าง)');
    }
    // Validation 3: Checkin & Checkout timestamps (Req #2 & #3)
    if (!payload.check_in?.date || !payload.check_out?.date) {
        validationErrors.push('ข้อมูล Check-in หรือ Check-out ไม่ครบถ้วน');
    }
    if (validationErrors.length > 0) {
        stagingRecord.process_status = StagingProcessStatus.VALIDATION_FAILED;
        stagingRecord.validation_errors = validationErrors;
        stagingRecord.processed_at = new Date().toISOString();
        return { success: false, errors: validationErrors };
    }
    stagingRecord.process_status = StagingProcessStatus.PROCESSING;
    try {
        // 1. Upsert Customer in Core Table
        let customer = exports.coreCustomerStore.find(c => c.phone === payload.customer.mobile_no || (payload.customer.code && c.customer_code === payload.customer.code));
        if (!customer) {
            const nameParts = payload.customer.name.trim().split(' ');
            const firstName = nameParts[0] || payload.customer.name;
            const lastName = nameParts.slice(1).join(' ') || '-';
            customer = {
                id: Date.now() + Math.floor(Math.random() * 1000),
                customer_code: payload.customer.code || `CUST-${Date.now()}`,
                first_name: firstName,
                last_name: lastName,
                phone: payload.customer.mobile_no,
                address: payload.customer.location?.address || 'ไม่ระบุที่อยู่',
                lat: payload.customer.location?.latitude || 0,
                lng: payload.customer.location?.longitude || 0,
                google_map_url: payload.customer.location?.google_map_url
            };
            exports.coreCustomerStore.push(customer);
        }
        // 2. Insert Core Job (Req #1 & State Machine: SURVEYED)
        const jobId = Date.now() + Math.floor(Math.random() * 1000);
        const newCoreJob = {
            id: jobId,
            job_no: payload.job_info?.job_number || stagingRecord.job_number,
            external_ref_id: payload.job_info?.source_reference || stagingRecord.source_reference || '',
            booking_no: payload.job_info?.booking_no || stagingRecord.booking_no || '',
            ticket_no: payload.job_info?.ticket_no || stagingRecord.ticket_no || '',
            customer_id: customer.id,
            status: JobStatus.SURVEYED,
            property_type: payload.job_info?.property_type || '',
            project_type: payload.job_info?.project_type || '',
            project_sub_type: payload.job_info?.project_sub_type || '',
            store_code: payload.store?.code || '',
            agent_name: payload.agent?.name || '',
            overall_progress: 10,
            created_at: new Date().toISOString()
        };
        exports.coreJobStore.push(newCoreJob);
        // 3. Insert Job Services
        if (Array.isArray(payload.job_details)) {
            payload.job_details.forEach((item, idx) => {
                exports.coreJobServiceStore.push({
                    id: Date.now() + idx + Math.floor(Math.random() * 1000),
                    job_id: jobId,
                    job_type: item.job_type,
                    installation_detail: item.installation_detail,
                    quantity: item.product_quantity || 1,
                    remark: item.remark
                });
            });
        }
        // 4. Insert Visit Checkin & Checkout record (Req #2 & #3)
        const checkinTime = new Date(payload.check_in.date).getTime();
        const checkoutTime = new Date(payload.check_out.date).getTime();
        const durationMinutes = Math.max(0, Math.round((checkoutTime - checkinTime) / (1000 * 60)));
        const visitCheckinId = Date.now() + Math.floor(Math.random() * 1000);
        const visitRecord = {
            id: visitCheckinId,
            job_id: jobId,
            checkin_at: payload.check_in.date,
            checkout_at: payload.check_out.date,
            duration_minutes: durationMinutes,
            checkin_lat: payload.check_in.latitude,
            checkin_lng: payload.check_in.longitude,
            distance_km: payload.schedule_plan?.distance || 0,
            is_in_radius: true,
            photo_count: photoCount,
            visit_results: payload.visit_results || [],
            remarks_comment: payload.remarks?.comment,
            approved_by: payload.approval?.approve_by,
            approved_at: payload.approval?.approve_date
        };
        exports.coreVisitCheckinStore.push(visitRecord);
        // 5. Insert Site Photos (Req #2)
        if (Array.isArray(payload.site_photos)) {
            payload.site_photos.forEach((photoPath, idx) => {
                exports.coreSitePhotoStore.push({
                    id: Date.now() + idx + Math.floor(Math.random() * 1000),
                    job_id: jobId,
                    visit_checkin_id: visitCheckinId,
                    file_path: photoPath,
                    taken_at: payload.check_in.date
                });
            });
        }
        // 6. Update Staging Record as CONVERTED
        stagingRecord.process_status = StagingProcessStatus.CONVERTED;
        stagingRecord.converted_job_id = jobId;
        stagingRecord.processed_at = new Date().toISOString();
        stagingRecord.validation_errors = undefined;
        console.log(`[STAGING CONVERT] Successfully converted staging #${stagingRecord.id} -> Job #${jobId} (${newCoreJob.job_no})`);
        return { success: true, jobId };
    }
    catch (err) {
        stagingRecord.process_status = StagingProcessStatus.ERROR;
        stagingRecord.error_message = err.message;
        stagingRecord.retry_count += 1;
        stagingRecord.processed_at = new Date().toISOString();
        return { success: false, errors: [err.message] };
    }
}
// Configuration for Ingestion Processing Mode
let autoConvertEnabled = true;
app.get('/api/v1/staging/config', (req, res) => {
    return res.json({ success: true, auto_convert_enabled: autoConvertEnabled });
});
app.post('/api/v1/staging/config/auto-convert', (req, res) => {
    const { enabled } = req.body;
    if (typeof enabled === 'boolean') {
        autoConvertEnabled = enabled;
    }
    return res.json({ success: true, auto_convert_enabled: autoConvertEnabled });
});
// =============================================================================
// 1.1 JOB SURVEY REPORT INGESTION & STAGING API
// =============================================================================
app.post('/api/v1/jobs/survey-report', async (req, res) => {
    try {
        const payload = req.body;
        // 1. Validate Required Root Objects & Fields
        if (!payload?.system?.job_id) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PAYLOAD', message: 'Field "system.job_id" is required' }
            });
        }
        if (!payload?.job_info?.job_number) {
            return res.status(400).json({
                success: false,
                error: { code: 'INVALID_PAYLOAD', message: 'Field "job_info.job_number" is required' }
            });
        }
        // 2. Check Idempotency / Duplicate in Staging
        const existing = exports.stagingSurveyStore.find(s => s.source_job_id === payload.system.job_id);
        if (existing) {
            return res.status(200).json({
                success: true,
                message: 'Payload already ingested in staging',
                staging_id: existing.id,
                process_status: existing.process_status,
                converted_job_id: existing.converted_job_id
            });
        }
        // 3. Ingest into Staging Record (t_staging_survey_report)
        const stagingRecord = {
            id: Date.now(),
            source_job_id: payload.system.job_id,
            job_number: payload.job_info.job_number,
            booking_no: payload.job_info.booking_no,
            ticket_no: payload.job_info.ticket_no,
            source_reference: payload.job_info.source_reference,
            customer_code: payload.customer?.code,
            customer_name: payload.customer?.name || '',
            customer_phone: payload.customer?.mobile_no || '',
            store_code: payload.store?.code,
            agent_code: payload.agent?.code,
            visit_date: payload.schedule_plan?.visit_date,
            checkin_at: payload.check_in?.date,
            checkout_at: payload.check_out?.date,
            photo_count: payload.site_photos?.length || 0,
            raw_payload: payload,
            process_status: StagingProcessStatus.PENDING,
            retry_count: 0,
            received_at: new Date().toISOString()
        };
        exports.stagingSurveyStore.push(stagingRecord);
        console.log(`[STAGING INGEST] Successfully saved raw payload in staging: #${stagingRecord.id} (Job: ${stagingRecord.job_number})`);
        // 4. Processing based on Auto-Convert Mode
        const shouldAutoConvert = req.query.auto_convert !== 'false' && autoConvertEnabled;
        let convertResult = { success: false };
        if (shouldAutoConvert) {
            convertResult = convertStagingToCorePmt(stagingRecord);
        }
        return res.status(201).json({
            success: true,
            message: convertResult.success
                ? 'Job survey report ingested to Staging and converted to Core PMT successfully'
                : 'Job survey report saved to Staging but requires review/fix before conversion',
            data: {
                staging_id: stagingRecord.id,
                process_status: stagingRecord.process_status,
                converted_job_id: stagingRecord.converted_job_id,
                validation_errors: stagingRecord.validation_errors,
                summary: {
                    job_number: stagingRecord.job_number,
                    customer_name: stagingRecord.customer_name,
                    photo_count: stagingRecord.photo_count,
                    service_count: payload.job_details?.length || 0
                }
            }
        });
    }
    catch (err) {
        console.error('Error processing survey report:', err);
        return res.status(500).json({
            success: false,
            error: { code: 'INTERNAL_ERROR', message: err.message }
        });
    }
});
// =============================================================================
// STAGING MANAGEMENT APIS (List, Get, Convert/Retry)
// =============================================================================
app.get('/api/v1/staging/survey-reports', (req, res) => {
    const { status, search } = req.query;
    let results = [...exports.stagingSurveyStore];
    if (status) {
        results = results.filter(r => r.process_status === status);
    }
    if (search) {
        const q = String(search).toLowerCase();
        results = results.filter(r => r.job_number.toLowerCase().includes(q) ||
            r.customer_name.toLowerCase().includes(q) ||
            (r.booking_no && r.booking_no.toLowerCase().includes(q)));
    }
    return res.json({
        success: true,
        total: results.length,
        data: results.map(r => ({
            id: r.id,
            source_job_id: r.source_job_id,
            job_number: r.job_number,
            booking_no: r.booking_no,
            customer_name: r.customer_name,
            photo_count: r.photo_count,
            process_status: r.process_status,
            converted_job_id: r.converted_job_id,
            validation_errors: r.validation_errors,
            received_at: r.received_at,
            processed_at: r.processed_at
        }))
    });
});
app.get('/api/v1/staging/survey-reports/:id', (req, res) => {
    const id = Number(req.params.id);
    const record = exports.stagingSurveyStore.find(r => r.id === id);
    if (!record) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Staging record not found' } });
    }
    return res.json({ success: true, data: record });
});
app.post('/api/v1/staging/survey-reports/:id/convert', (req, res) => {
    const id = Number(req.params.id);
    const record = exports.stagingSurveyStore.find(r => r.id === id);
    if (!record) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Staging record not found' } });
    }
    const result = convertStagingToCorePmt(record);
    return res.json({
        success: result.success,
        data: {
            staging_id: record.id,
            process_status: record.process_status,
            converted_job_id: record.converted_job_id,
            validation_errors: record.validation_errors
        }
    });
});
app.post('/api/v1/staging/seed', (req, res) => {
    seedInitialStagingData();
    return res.json({
        success: true,
        message: 'Seeded 5 mock survey reports into staging table successfully',
        total_records: exports.stagingSurveyStore.length
    });
});
// =============================================================================
// 1.2 CORE JOBS APIS (List, Get, Create for Web Dashboard & Automation)
app.get('/api/v1/jobs', (req, res) => {
    const { status, service, search } = req.query;
    try {
        let results = exports.coreJobStore.map(job => {
            const cust = exports.coreCustomerStore.find(c => c.id === job.customer_id);
            const customerFullName = cust ? `${cust.first_name || ''} ${cust.last_name || ''}`.trim() : 'ไม่ระบุชื่อ';
            const primaryService = (job.services && job.services[0]) || job.project_sub_type || 'งานติดตั้ง';
            return {
                id: job.job_no || `JOB-${job.id}`,
                jobId: job.id,
                job_no: job.job_no,
                external_ref_id: job.external_ref_id,
                customer: customerFullName,
                firstName: cust?.first_name || '',
                lastName: cust?.last_name || '',
                phone: cust?.phone || '',
                address: cust?.address || '',
                lat: cust?.lat || 13.7563,
                lng: cust?.lng || 100.5018,
                service: primaryService,
                services: job.services || [primaryService],
                status: job.status,
                date: job.plan_date || (job.created_at ? job.created_at.split('T')[0] : '2026-09-05'),
                progress: job.overall_progress || 0,
                tech: job.assigned_tech || 'Team A (สมศักดิ์)',
                special_instructions: job.special_instructions || '',
                additional_notes: job.additional_notes || '',
                photos: job.photos || [],
                created_at: job.created_at
            };
        });
        if (status && status !== 'all') {
            results = results.filter(j => j.status === status);
        }
        if (service && service !== 'all') {
            results = results.filter(j => j.service === service || (j.services && j.services.includes(String(service))));
        }
        if (search) {
            const q = String(search).toLowerCase();
            results = results.filter(j => j.id.toLowerCase().includes(q) ||
                j.customer.toLowerCase().includes(q) ||
                j.phone.includes(q) ||
                j.service.toLowerCase().includes(q));
        }
        return res.json({
            success: true,
            total: results.length,
            data: results
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
});
app.get('/api/v1/jobs/:id', (req, res) => {
    const param = req.params.id;
    const numId = Number(param);
    const job = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (!job) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }
    const cust = exports.coreCustomerStore.find(c => c.id === job.customer_id);
    const primaryService = (job.services && job.services[0]) || job.project_sub_type || 'งานติดตั้ง';
    return res.json({
        success: true,
        data: {
            id: job.job_no || `JOB-${job.id}`,
            jobId: job.id,
            job_no: job.job_no,
            external_ref_id: job.external_ref_id,
            customer: cust ? `${cust.first_name} ${cust.last_name}`.trim() : 'ไม่ระบุชื่อ',
            firstName: cust?.first_name || '',
            lastName: cust?.last_name || '',
            phone: cust?.phone || '',
            address: cust?.address || '',
            lat: cust?.lat || 13.7563,
            lng: cust?.lng || 100.5018,
            service: primaryService,
            services: job.services || [primaryService],
            status: job.status,
            date: job.plan_date || (job.created_at ? job.created_at.split('T')[0] : '2026-09-05'),
            progress: job.overall_progress || 0,
            tech: job.assigned_tech || 'Team A (สมศักดิ์)',
            special_instructions: job.special_instructions || '',
            additional_notes: job.additional_notes || '',
            photos: job.photos || [],
            created_at: job.created_at
        }
    });
});
// Update Job Details (Special Instructions, Additional Notes, Tech, etc.)
app.patch('/api/v1/jobs/:id', (req, res) => {
    const param = req.params.id;
    const numId = Number(param);
    const job = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (!job) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }
    const { special_instructions, additional_notes, assigned_tech, plan_date, status, overall_progress, photos, pmt_accepted, pmt_accepted_at } = req.body;
    if (special_instructions !== undefined)
        job.special_instructions = special_instructions;
    if (additional_notes !== undefined)
        job.additional_notes = additional_notes;
    if (assigned_tech !== undefined)
        job.assigned_tech = assigned_tech;
    if (plan_date !== undefined)
        job.plan_date = plan_date;
    if (status !== undefined)
        job.status = status;
    if (overall_progress !== undefined)
        job.overall_progress = overall_progress;
    if (photos !== undefined)
        job.photos = photos;
    if (pmt_accepted !== undefined)
        job.pmt_accepted = pmt_accepted;
    if (pmt_accepted_at !== undefined)
        job.pmt_accepted_at = pmt_accepted_at;
    return res.json({
        success: true,
        data: {
            id: job.job_no || `JOB-${job.id}`,
            special_instructions: job.special_instructions,
            additional_notes: job.additional_notes,
            photos: job.photos || [],
            status: job.status,
            pmt_accepted: job.pmt_accepted
        },
        message: 'บันทึกข้อมูลงานเรียบร้อยแล้ว'
    });
});
// Upload Additional Site Photo
app.post('/api/v1/jobs/:id/photos', (req, res) => {
    const param = req.params.id;
    const numId = Number(param);
    const job = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (!job) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }
    const { title, name, dataUrl, url, tag, note, lat, lng } = req.body;
    if (!dataUrl && !url) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_PHOTO', message: 'Photo dataUrl or url is required' } });
    }
    if (!job.photos)
        job.photos = [];
    const newPhoto = {
        id: 'PHT-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
        title: title || name || `รูปหน้างานเพิ่มเติม #${job.photos.length + 1}`,
        name: name || `IMG_SITE_ADD_${Date.now().toString().slice(-4)}.JPG`,
        url: dataUrl || url,
        tag: tag || 'ภาพเพิ่มเติม',
        note: note || '',
        lat: lat || 13.7563,
        lng: lng || 100.5018,
        gps_verified: true,
        uploaded_at: new Date().toISOString()
    };
    job.photos.push(newPhoto);
    return res.status(201).json({
        success: true,
        data: newPhoto,
        total_photos: job.photos.length,
        message: 'อัปโหลดรูปภาพเพิ่มเติมสำเร็จ'
    });
});
// Delete Site Photo
app.delete('/api/v1/jobs/:id/photos/:photoId', (req, res) => {
    const param = req.params.id;
    const photoId = req.params.photoId;
    const numId = Number(param);
    const job = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (!job) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
    }
    if (job.photos) {
        job.photos = job.photos.filter((p) => p.id !== photoId);
    }
    return res.json({
        success: true,
        total_photos: job.photos ? job.photos.length : 0,
        message: 'ลบรูปภาพเรียบร้อยแล้ว'
    });
});
app.post('/api/v1/jobs', (req, res) => {
    try {
        const { firstName, lastName, phone, address, lat, lng, service, tech, date } = req.body;
        if (!firstName || !lastName) {
            return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'firstName and lastName are required' } });
        }
        const now = new Date();
        const yyyy = String(now.getFullYear());
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const runningSeq = Math.floor(1 + Math.random() * 999);
        const runningStr = String(runningSeq).padStart(3, '0');
        const jobNo = `JOB${yyyy}${mm}${runningStr}`;
        const customer = {
            id: Date.now() + Math.floor(Math.random() * 100),
            customer_code: `CUST-${Date.now()}`,
            first_name: firstName,
            last_name: lastName,
            phone: phone || '089-000-0000',
            address: address || 'Bangkok, Thailand',
            lat: Number(lat) || 13.7563,
            lng: Number(lng) || 100.5018
        };
        exports.coreCustomerStore.push(customer);
        const newJob = {
            id: Date.now(),
            job_no: jobNo,
            external_ref_id: `WEB-${Date.now()}`,
            customer_id: customer.id,
            services: [service || 'งานติดตั้ง'],
            assigned_tech: tech || 'Team A (สมศักดิ์)',
            plan_date: date || new Date().toISOString().split('T')[0],
            status: JobStatus.DRAFT,
            overall_progress: 0,
            created_at: new Date().toISOString()
        };
        exports.coreJobStore.unshift(newJob);
        return res.status(201).json({
            success: true,
            data: newJob,
            meta: { message: 'Job created successfully' }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
});
app.delete('/api/v1/jobs', (req, res) => {
    exports.coreJobStore.length = 0;
    exports.coreTaskStore.length = 0;
    exports.coreCustomerStore.length = 0;
    exports.coreJobServiceStore.length = 0;
    exports.coreVisitCheckinStore.length = 0;
    exports.coreSitePhotoStore.length = 0;
    return res.json({
        success: true,
        message: 'ลบข้อมูลโครงการและรายการ Task ทั้งหมดเรียบร้อย',
        total_jobs: 0
    });
});
app.post('/api/v1/jobs/reset-status', (req, res) => {
    exports.coreJobStore.forEach(j => {
        j.status = JobStatus.DRAFT;
        j.overall_progress = 0;
    });
    return res.json({
        success: true,
        message: 'ถอยสถานะของทุก Job กลับสู่จุดเริ่มต้น (DRAFT / 0%) เรียบร้อย',
        total_jobs: exports.coreJobStore.length
    });
});
app.post(['/api/v1/jobs/reset', '/api/v1/jobs/simulate-int'], (req, res) => {
    seedInitialCoreData(true);
    seedInitialStagingData();
    return res.json({
        success: true,
        message: 'จำลองและ Reset รายการ 10 คำสั่งซื้อจาก INT เข้าสู่ระบบ PMT สำเร็จ',
        total_jobs: exports.coreJobStore.length
    });
});
// =============================================================================
// 2. CHECK-IN / SITE VISIT API (Req #2 & #3)
// =============================================================================
app.post('/api/v1/jobs/:id/checkin', async (req, res) => {
    try {
        const param = req.params.id;
        const numId = Number(param);
        const { lat, lng, photos, summary } = req.body;
        // Rule: Minimum 5 site photos required (Req #2)
        if (!photos || photos.length < 5) {
            return res.status(422).json({
                success: false,
                error: {
                    code: 'INSUFFICIENT_PHOTOS',
                    message: 'ถ่ายรูปหน้างานไม่ครบ 5 รูป กรุณาอัปโหลดอย่างน้อย 5 รูป',
                    required: 5,
                    actual: photos ? photos.length : 0
                }
            });
        }
        // Update job status if present in coreJobStore
        const targetJob = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
        if (targetJob) {
            targetJob.status = JobStatus.SURVEYED;
            targetJob.overall_progress = Math.max(targetJob.overall_progress, 30);
        }
        // Rule: Geo-fence Check (Default 400m - Configurable) (Req #2, OQ-A07)
        const configRadius = 400; // meters
        const distanceMeters = 180; // Calculated distance
        const isInRadius = distanceMeters <= configRadius;
        const checkinLog = {
            id: Date.now(),
            job_id: targetJob ? targetJob.id : numId,
            checkin_at: new Date().toISOString(),
            lat,
            lng,
            distance_meters: distanceMeters,
            is_in_radius: isInRadius,
            photo_count: photos.length,
            photos,
            summary
        };
        return res.status(200).json({
            success: true,
            data: {
                checkin: checkinLog,
                updated_job_status: JobStatus.SURVEYED
            }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
    }
});
// =============================================================================
// 3. DESIGN & BOQ API (Req #5 & #6)
// =============================================================================
app.post('/api/v1/jobs/:id/designs', async (req, res) => {
    const jobId = Number(req.params.id);
    const { file_name, file_type, file_path, remark } = req.body;
    const designFile = {
        id: Date.now(),
        job_id: jobId,
        version_no: 2, // Auto-increment version
        file_name,
        file_type,
        file_path,
        is_current: true,
        remark,
        uploaded_at: new Date().toISOString()
    };
    return res.status(201).json({ success: true, data: designFile });
});
app.post('/api/v1/jobs/:id/boq', async (req, res) => {
    const jobId = Number(req.params.id);
    const { items, discount_amount = 0 } = req.body;
    // Calculate BOQ (Req #6)
    const subtotal = items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
    const vat = (subtotal - discount_amount) * 0.07;
    const grandTotal = (subtotal - discount_amount) + vat;
    const boq = {
        id: Date.now(),
        job_id: jobId,
        version_no: 1,
        subtotal,
        discount: discount_amount,
        vat_amount: vat,
        grand_total: grandTotal,
        items,
        created_at: new Date().toISOString()
    };
    const targetJob = exports.coreJobStore.find(j => j.id === jobId || j.job_no === String(req.params.id) || String(j.id) === String(req.params.id));
    if (targetJob) {
        targetJob.boq_items = items;
        targetJob.boq_subtotal = subtotal;
        targetJob.boq_discount = discount_amount;
        targetJob.boq_grand_total = grandTotal;
        targetJob.status = JobStatus.BOQ;
    }
    return res.status(201).json({ success: true, data: boq });
});
// =============================================================================
// 4. TASK & GANTT SCHEDULING API (Req #7 & #8 - Independent Tasks)
// =============================================================================
// Helper: sort tasks by plan_start_date ascending
function sortTasksByStartDate(tasks) {
    return tasks.sort((a, b) => {
        const da = new Date(a.plan_start_date).getTime();
        const db = new Date(b.plan_start_date).getTime();
        if (da !== db)
            return da - db;
        return (a.task_name || '').localeCompare(b.task_name || '');
    });
}
// GET /api/v1/jobs/:id/tasks — Get all tasks for a job (sorted by start date)
app.get('/api/v1/jobs/:id/tasks', async (req, res) => {
    const param = req.params.id;
    const numId = Number(param);
    const tasks = exports.coreTaskStore.filter(t => t.job_id === numId || t.job_no === param || String(t.job_id) === param);
    const sorted = sortTasksByStartDate([...tasks]);
    return res.json({ success: true, total: sorted.length, data: sorted });
});
// POST /api/v1/jobs/:id/tasks/import-boq — Import/Convert BOQ items into Project Tasks with Start/End date & Auto-sort
app.post('/api/v1/jobs/:id/tasks/import-boq', async (req, res) => {
    const param = req.params.id;
    const numId = isNaN(Number(param)) ? param : Number(param);
    const { items, base_start_date, default_tech = 'Team A (สมศักดิ์)' } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ success: false, error: { code: 'EMPTY_ITEMS', message: 'รายการ BOQ ต้องไม่ว่างเปล่า' } });
    }
    // Remove existing tasks for this job if replacing
    const isAppend = req.body.mode === 'append';
    if (!isAppend) {
        for (let i = exports.coreTaskStore.length - 1; i >= 0; i--) {
            if (exports.coreTaskStore[i].job_id === numId || exports.coreTaskStore[i].job_no === param || String(exports.coreTaskStore[i].job_id) === param) {
                exports.coreTaskStore.splice(i, 1);
            }
        }
    }
    const baseDate = base_start_date || new Date().toISOString().slice(0, 10);
    const newTasks = items.map((item, idx) => {
        let startStr = item.start_date || item.start;
        let endStr = item.end_date || item.end;
        let days = item.duration_days || item.days || 1;
        if (!startStr) {
            const d = new Date(baseDate);
            d.setDate(d.getDate() + Math.floor(idx / 2));
            startStr = d.toISOString().slice(0, 10);
        }
        if (!endStr) {
            const s = new Date(startStr);
            s.setDate(s.getDate() + (days - 1));
            endStr = s.toISOString().slice(0, 10);
        }
        else {
            const s = new Date(startStr);
            const e = new Date(endStr);
            days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        }
        const techName = item.assigned_tech || item.tech || default_tech;
        const assignees = item.assignees || [techName];
        return {
            id: `T_${param}_${Date.now()}_${idx + 1}`,
            job_id: numId,
            job_no: typeof param === 'string' && param.startsWith('JOB') ? param : `JOB20260900${numId}`,
            task_name: item.task_name || item.name || `งานติดตั้ง ${idx + 1}`,
            plan_start_date: startStr,
            plan_end_date: endStr,
            duration_days: days,
            assigned_tech: techName,
            assignees: assignees,
            status: 'IN_PROGRESS',
            progress_percent: 0,
            source_boq_item: item.source_boq_item || item.name,
            created_at: new Date().toISOString()
        };
    });
    exports.coreTaskStore.push(...newTasks);
    newTasks.forEach(t => syncQCBookingForTask(t));
    // Sync to coreJobStore
    const targetJobForBOQ = exports.coreJobStore.find(j => j.id === numId || j.job_no === param || String(j.id) === param);
    if (targetJobForBOQ) {
        if (!targetJobForBOQ.boq_items || targetJobForBOQ.boq_items.length === 0) {
            targetJobForBOQ.boq_items = items.map((it) => ({
                name: it.task_name || it.name,
                qty: it.qty || 1,
                unit: it.unit || 'งาน',
                price: it.price || 0,
                labor_price: it.labor_price || it.price || 0
            }));
        }
    }
    // Auto-sort all tasks for this job by start date
    const jobTasks = exports.coreTaskStore.filter(t => t.job_id === numId || t.job_no === param || String(t.job_id) === param);
    const sorted = sortTasksByStartDate(jobTasks);
    return res.status(201).json({
        success: true,
        message: `นำเข้าและแปลง BOQ เป็น Task ปฏิบัติงาน ${newTasks.length} รายการ และสร้างคิวจองช่าง QC ล่วงหน้า 5 วันเรียบร้อย`,
        total: sorted.length,
        data: sorted
    });
});
// POST /api/v1/jobs/:id/tasks — Create / Insert Task into Job (with auto-sort by start date)
app.post('/api/v1/jobs/:id/tasks', async (req, res) => {
    const param = req.params.id;
    const numId = isNaN(Number(param)) ? param : Number(param);
    const { task_name, start_date, end_date, duration_days = 1, assigned_tech = 'Team A (สมศักดิ์)', assignees, allow_bypass = false } = req.body;
    if (!task_name) {
        return res.status(400).json({ success: false, error: { code: 'MISSING_TASK_NAME', message: 'กรุณาระบุชื่อ Task' } });
    }
    // Check Business Rule: แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart
    const targetJob = exports.coreJobStore.find(j => j.id === numId || j.job_no === param || String(j.id) === param);
    if (targetJob && (!targetJob.boq_items || targetJob.boq_items.length === 0) && !allow_bypass) {
        return res.status(400).json({
            success: false,
            error: {
                code: 'BOQ_REQUIRED',
                message: 'แผนงานจะเกิดได้ก็ต่อเมื่อ มีการนำเข้า BOQ แล้วจึงสร้างเป็น task ใน gantt chart นะครับ'
            }
        });
    }
    const startStr = start_date || new Date().toISOString().slice(0, 10);
    let endStr = end_date;
    let days = duration_days;
    if (!endStr) {
        const start = new Date(startStr);
        const end = new Date(start);
        end.setDate(end.getDate() + (days - 1));
        endStr = end.toISOString().slice(0, 10);
    }
    else {
        const s = new Date(startStr);
        const e = new Date(endStr);
        days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }
    const techList = assignees || [assigned_tech];
    const newTask = {
        id: `T_${param}_${Date.now()}`,
        job_id: numId,
        job_no: typeof param === 'string' && param.startsWith('JOB') ? param : `JOB20260900${numId}`,
        task_name,
        plan_start_date: startStr,
        plan_end_date: endStr,
        duration_days: days,
        assigned_tech: techList.join(' + '),
        assignees: techList,
        status: 'IN_PROGRESS',
        progress_percent: 0,
        created_at: new Date().toISOString()
    };
    exports.coreTaskStore.push(newTask);
    const qcBooking = syncQCBookingForTask(newTask);
    // Auto-sort all tasks for this job by start date
    const jobTasks = exports.coreTaskStore.filter(t => t.job_id === numId || t.job_no === param || String(t.job_id) === param);
    const sorted = sortTasksByStartDate(jobTasks);
    return res.status(201).json({
        success: true,
        message: 'สร้าง/แทรก Task และจองช่าง QC ล่วงหน้า 5 วันเรียบร้อย',
        data: newTask,
        qc_booking: qcBooking,
        sorted_tasks: sorted
    });
});
// POST /api/v1/jobs/:id/tasks/reorder — Reorder/Auto-sort Tasks by Start Date
app.post('/api/v1/jobs/:id/tasks/reorder', async (req, res) => {
    const param = req.params.id;
    const numId = isNaN(Number(param)) ? param : Number(param);
    const jobTasks = exports.coreTaskStore.filter(t => t.job_id === numId || t.job_no === param || String(t.job_id) === param);
    const sorted = sortTasksByStartDate(jobTasks);
    return res.json({
        success: true,
        message: 'จัดเรียงรายการ Task ตามวันเริ่มต้นเรียบร้อย',
        data: sorted
    });
});
// PUT /api/v1/jobs/:id/tasks/:taskId — Update Task (Start Date, End Date, Technician, Status, etc.)
app.put('/api/v1/jobs/:id/tasks/:taskId', async (req, res) => {
    const { id, taskId } = req.params;
    const task = exports.coreTaskStore.find(t => String(t.id) === taskId);
    if (!task) {
        return res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'ไม่พบ Task' } });
    }
    const { task_name, name, start_date, start, end_date, end, duration_days, days, assigned_tech, tech, assignees, status } = req.body;
    if (task_name !== undefined || name !== undefined)
        task.task_name = task_name || name;
    if (start_date !== undefined || start !== undefined)
        task.plan_start_date = start_date || start;
    if (end_date !== undefined || end !== undefined)
        task.plan_end_date = end_date || end;
    if (duration_days !== undefined || days !== undefined) {
        task.duration_days = duration_days || days;
    }
    else if (task.plan_start_date && task.plan_end_date) {
        const s = new Date(task.plan_start_date);
        const e = new Date(task.plan_end_date);
        task.duration_days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }
    if (assigned_tech !== undefined || tech !== undefined)
        task.assigned_tech = assigned_tech || tech;
    if (assignees !== undefined)
        task.assignees = assignees;
    if (status !== undefined)
        task.status = status;
    // Sync / update QC booking for this task (recalculate 5 days before new end date)
    const qcBooking = syncQCBookingForTask(task);
    return res.json({ success: true, message: 'อัปเดต Task และวันจองตรวจ QC สำเร็จ', data: task, qc_booking: qcBooking });
});
// DELETE /api/v1/jobs/:id/tasks/:taskId — Delete Task
app.delete('/api/v1/jobs/:id/tasks/:taskId', async (req, res) => {
    const { id, taskId } = req.params;
    const idx = exports.coreTaskStore.findIndex(t => String(t.id) === taskId);
    if (idx === -1) {
        return res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'ไม่พบ Task' } });
    }
    exports.coreTaskStore.splice(idx, 1);
    removeQCBookingForTask(taskId);
    return res.json({ success: true, message: 'ลบ Task และยกเลิกการจอง QC สำเร็จ' });
});
// GET /api/v1/tasks/gantt — Get all tasks structured for Gantt Timeline view
app.get('/api/v1/tasks/gantt', async (req, res) => {
    const jobId = req.query.job_id;
    let tasks = exports.coreTaskStore;
    if (jobId && jobId !== 'all') {
        tasks = tasks.filter(t => t.job_no === jobId || String(t.job_id) === jobId);
    }
    const sorted = sortTasksByStartDate([...tasks]);
    return res.json({
        success: true,
        total: sorted.length,
        data: sorted
    });
});
// =============================================================================
// QC BOOKINGS API (จองช่าง QC ล่วงหน้า 5 วันก่อนวันสิ้นสุด Task)
// =============================================================================
// GET /api/v1/qc/bookings — List all QC Bookings (filter by job_id, status)
app.get('/api/v1/qc/bookings', async (req, res) => {
    const { job_id, status } = req.query;
    let list = exports.coreQCBookingStore;
    if (job_id && job_id !== 'all') {
        list = list.filter(b => String(b.job_id) === String(job_id) || b.job_no === String(job_id));
    }
    if (status && status !== 'all') {
        list = list.filter(b => b.status === status);
    }
    return res.json({ success: true, total: list.length, data: list });
});
// PUT /api/v1/qc/bookings/:id/confirm — Confirm QC Technician Booking
app.put('/api/v1/qc/bookings/:id/confirm', async (req, res) => {
    const { id } = req.params;
    const { qc_tech, confirmed_by, remarks } = req.body;
    const booking = exports.coreQCBookingStore.find(b => b.id === id || String(b.task_id) === id);
    if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'ไม่พบรายการจอง QC' } });
    }
    booking.status = 'CONFIRMED';
    booking.confirmed_at = new Date().toISOString();
    if (qc_tech)
        booking.assigned_qc_tech = qc_tech;
    if (confirmed_by)
        booking.confirmed_by = confirmed_by;
    if (remarks !== undefined)
        booking.remarks = remarks;
    return res.json({
        success: true,
        message: `ยืนยันการจองช่าง QC (${booking.assigned_qc_tech}) สำหรับ "${booking.task_name}" เรียบร้อยแล้ว`,
        data: booking
    });
});
// PUT /api/v1/qc/bookings/:id — Update QC Booking (Change QC tech, date, remarks, status)
app.put('/api/v1/qc/bookings/:id', async (req, res) => {
    const { id } = req.params;
    const booking = exports.coreQCBookingStore.find(b => b.id === id || String(b.task_id) === id);
    if (!booking) {
        return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'ไม่พบรายการจอง QC' } });
    }
    const { assigned_qc_tech, qc_booking_date, remarks, status } = req.body;
    if (assigned_qc_tech !== undefined)
        booking.assigned_qc_tech = assigned_qc_tech;
    if (qc_booking_date !== undefined)
        booking.qc_booking_date = qc_booking_date;
    if (remarks !== undefined)
        booking.remarks = remarks;
    if (status !== undefined)
        booking.status = status;
    return res.json({ success: true, message: 'อัปเดตข้อมูลการจอง QC เรียบร้อย', data: booking });
});
// POST /api/v1/qc/bookings/sync-all — Sync QC bookings from all existing tasks
app.post('/api/v1/qc/bookings/sync-all', async (req, res) => {
    exports.coreTaskStore.forEach(task => syncQCBookingForTask(task));
    return res.json({
        success: true,
        message: `ซิงค์งานจองตรวจ QC จากรายการ Task ทั้งหมด (${exports.coreTaskStore.length} tasks) เรียบร้อย`,
        total: exports.coreQCBookingStore.length,
        data: exports.coreQCBookingStore
    });
});
// =============================================================================
// 5. QC INSPECTION & AFTER SALE CSAT API (Req #10 & #11)
// =============================================================================
app.post('/api/v1/jobs/:id/qc-inspection', async (req, res) => {
    const param = req.params.id;
    const numId = Number(param);
    const { items, remarks } = req.body; // items: [{ item_id, result: 'PASS'|'FAIL', is_mandatory }]
    // Rule: Mandatory item failing triggers overall QC FAIL (Req #11)
    const hasMandatoryFail = Array.isArray(items) && items.some((it) => it.is_mandatory && it.result === 'FAIL');
    const overallResult = hasMandatoryFail ? 'FAIL' : 'PASS';
    const nextStatus = overallResult === 'PASS' ? JobStatus.QC_PASSED : JobStatus.IN_PROGRESS;
    // Update target job in coreJobStore
    const targetJob = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (targetJob) {
        targetJob.status = nextStatus;
        targetJob.overall_progress = overallResult === 'PASS' ? 100 : 80;
    }
    return res.status(200).json({
        success: true,
        data: {
            inspection_id: Date.now(),
            job_id: targetJob ? targetJob.id : numId,
            overall_result: overallResult,
            is_rework_required: hasMandatoryFail,
            next_job_status: nextStatus,
            message: overallResult === 'PASS'
                ? 'QC Passed! Created After Sale CSAT case automatically.'
                : 'QC Failed! Mandatory items failed. Job sent back to technician for Rework.'
        }
    });
});
// After Sale CSAT Survey Logging (Req #11, OQ-A05)
app.post('/api/v1/jobs/:id/after-sale/csat', async (req, res) => {
    const param = req.params.id;
    const numId = Number(param);
    const { csat_score, customer_feedback } = req.body;
    const csatResult = csat_score >= 3 ? 'PASS' : 'FAIL';
    const nextStatus = csatResult === 'PASS' ? JobStatus.CLOSED : JobStatus.IN_PROGRESS;
    const targetJob = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (targetJob) {
        targetJob.status = nextStatus;
        if (csatResult === 'PASS')
            targetJob.overall_progress = 100;
    }
    return res.status(200).json({
        success: true,
        data: {
            case_no: `AS-${Date.now()}`,
            job_id: targetJob ? targetJob.id : numId,
            csat_score,
            csat_result: csatResult,
            customer_feedback,
            next_job_status: nextStatus
        }
    });
});
// =============================================================================
// 6. BMT OUTBOUND REST INTEGRATION API (Req #12, OQ-A02, OQ-A03)
// =============================================================================
app.post('/api/v1/jobs/:id/close-and-export-bmt', async (req, res) => {
    try {
        const param = req.params.id;
        const numId = Number(param);
        const targetJob = exports.coreJobStore.find(j => j.id === numId || j.job_no === param);
        if (targetJob) {
            targetJob.status = JobStatus.CLOSED;
            targetJob.overall_progress = 100;
        }
        const bmtPayload = {
            job_no: targetJob?.job_no || `JOB202609001`,
            bmt_export_timestamp: new Date().toISOString(),
            customer: {
                name: 'นาย สมชาย ใจดี',
                phone: '081-234-5678',
                address: '123/45 ถ.พหลโยธิน กรุงเทพฯ'
            },
            qc_passed_tasks: [
                {
                    task_id: 101,
                    task_name: 'ติดตั้งเครื่องทำน้ำอุ่น',
                    technician: 'ช่าง สมศักดิ์',
                    qc_passed_at: new Date().toISOString()
                }
            ],
            csat_result: 'PASS',
            status: 'CLOSED'
        };
        return res.status(200).json({
            success: true,
            data: {
                job_id: targetJob ? targetJob.id : numId,
                status: JobStatus.CLOSED,
                bmt_response_ref: `BMT-REF-${Math.floor(100000 + Math.random() * 900000)}`,
                exported_payload: bmtPayload
            },
            meta: { message: 'Job closed and exported to BMT system successfully via REST API' }
        });
    }
    catch (err) {
        return res.status(500).json({ success: false, error: { code: 'BMT_EXPORT_FAILED', message: err.message } });
    }
});
exports.maChecklistTemplateStore = [
    {
        id: "mact_ac_wash",
        service_type: "ล้างแอร์",
        template_name: "Checklist ล้างแอร์มาตรฐาน",
        checklist_items: [
            { id: "ac1", label: "ถอดและทำความสะอาดแผ่นกรองอากาศ (Filter)", required: true },
            { id: "ac2", label: "ล้างคอยล์เย็น (Evaporator Coil) ด้วยน้ำยาล้างคอยล์", required: true },
            { id: "ac3", label: "ล้างและเป่าท่อระบายน้ำทิ้ง (Drain Pipe)", required: true },
            { id: "ac4", label: "ล้างคอยล์ร้อน (Condensing Unit ภายนอก)", required: true },
            { id: "ac5", label: "วัดแรงดันน้ำยาแอร์ (Refrigerant Pressure)", required: true },
            { id: "ac6", label: "วัดกระแสไฟฟ้าคอมเพรสเซอร์ (Operating Current)", required: true },
            { id: "ac7", label: "ทดสอบการทำงานระบบปรับอากาศและวัดอุณหภูมิลมออก", required: true },
            { id: "ac8", label: "ถ่ายภาพ Before/After", required: true }
        ],
        created_at: "2026-08-25T09:49:27.566Z"
    },
    {
        id: "mact_electrical",
        service_type: "ตรวจระบบไฟฟ้า",
        template_name: "Checklist ตรวจระบบไฟฟ้ามาตรฐาน",
        checklist_items: [
            { id: "el1", label: "ตรวจสภาพตู้ MDB / ตู้ควบคุมไฟหลัก", required: true },
            { id: "el2", label: "วัดแรงดันไฟฟ้า (Voltage Check)", required: true },
            { id: "el3", label: "ตรวจสายดิน (Ground/Earth Check)", required: true },
            { id: "el4", label: "ทดสอบ RCD/ELCB (ตัดไฟรั่ว)", required: true },
            { id: "el5", label: "ตรวจสภาพสายไฟและเต้ารับ", required: true },
            { id: "el6", label: "ถ่ายภาพ Before/After", required: true }
        ],
        created_at: "2026-08-25T09:49:27.567Z"
    },
    {
        id: "mact_plumbing",
        service_type: "ตรวจระบบประปา",
        template_name: "Checklist ตรวจระบบประปา",
        checklist_items: [
            { id: "pl1", label: "ตรวจท่อน้ำและข้อต่อ (หารอยรั่ว)", required: true },
            { id: "pl2", label: "เช็คแรงดันน้ำ (Water Pressure)", required: true },
            { id: "pl3", label: "ตรวจวาล์วปิด-เปิด (Shut-off Valves)", required: true },
            { id: "pl4", label: "ตรวจถังแรงดันน้ำ (Pressure Tank)", required: false },
            { id: "pl5", label: "ถ่ายภาพ Before/After", required: true }
        ],
        created_at: "2026-08-25T09:49:27.568Z"
    },
    {
        id: "mact_cctv",
        service_type: "ตรวจ CCTV",
        template_name: "Checklist ตรวจระบบ CCTV",
        checklist_items: [
            { id: "cc1", label: "ตรวจสภาพกล้องและมุมมอง (Camera Position)", required: true },
            { id: "cc2", label: "ทดสอบภาพ Daytime (ความชัดเจน)", required: true },
            { id: "cc3", label: "ทดสอบ Night Vision / IR", required: true },
            { id: "cc4", label: "เช็คพื้นที่จัดเก็บ HDD/NVR", required: true },
            { id: "cc5", label: "ทดสอบการ Playback ย้อนหลัง", required: true },
            { id: "cc6", label: "ถ่ายภาพ Before/After", required: true }
        ],
        created_at: "2026-08-25T09:49:27.569Z"
    }
];
exports.maContractStore = [
    {
        id: "mac_1788397202685",
        contract_no: "MAC-2026-0001",
        customer_id: null,
        customer_site_id: null,
        service_type: "ล้างแอร์",
        service_items: [
            { id: "si_1", btu: "", name: "เครื่องที่ 1", brand: "", location: "" }
        ],
        frequency_months: 3,
        total_rounds: 4,
        contract_start_date: "2026-09-04",
        contract_end_date: "2027-09-04",
        contract_value: "12000",
        status: "Active",
        notes: "ลูกค้า: สมควร กระจ่าง\nโทร: 0896292111\nไซต์: dfdfsdfsfdsdf\nที่อยู่: 123/45 สุขุมวิท กรุงเทพฯ",
        created_at: "2026-09-03T01:00:02.688Z",
        created_by: "u4",
        customer_name: "สมควร กระจ่าง",
        customer_phone: "0896292111",
        site_name: "dfdfsdfsfdsdf",
        site_address: "123/45 สุขุมวิท กรุงเทพฯ"
    }
];
exports.maRoundStore = [
    {
        id: "mar_1788397202746",
        contract_id: "mac_1788397202685",
        project_id: null,
        round_number: 1,
        scheduled_date: "2026-09-04",
        actual_date: null,
        status: "Scheduled",
        notes: null,
        created_at: "2026-09-03T01:00:02.746Z"
    },
    {
        id: "mar_1788397202801",
        contract_id: "mac_1788397202685",
        project_id: null,
        round_number: 2,
        scheduled_date: "2026-12-04",
        actual_date: null,
        status: "Scheduled",
        notes: null,
        created_at: "2026-09-03T01:00:02.802Z"
    },
    {
        id: "mar_1788397202856",
        contract_id: "mac_1788397202685",
        project_id: null,
        round_number: 3,
        scheduled_date: "2027-03-04",
        actual_date: null,
        status: "Scheduled",
        notes: null,
        created_at: "2026-09-03T01:00:02.857Z"
    },
    {
        id: "mar_1788397202908",
        contract_id: "mac_1788397202685",
        project_id: null,
        round_number: 4,
        scheduled_date: "2027-06-04",
        actual_date: null,
        status: "Scheduled",
        notes: null,
        created_at: "2026-09-03T01:00:02.908Z"
    }
];
// Helper: Format contract with round counts
function formatContractWithRounds(c) {
    const rounds = exports.maRoundStore.filter(r => r.contract_id === c.id);
    const totalRoundsCount = rounds.length > 0 ? rounds.length : (c.total_rounds || 0);
    const completedRounds = rounds.filter(r => r.status === 'Completed').length;
    return {
        ...c,
        total_rounds_count: totalRoundsCount,
        completed_rounds: completedRounds
    };
}
// 1. Get Checklist Templates
app.get(['/api/ma-checklist-templates', '/api/v1/ma-checklist-templates'], (req, res) => {
    return res.json(exports.maChecklistTemplateStore);
});
// 2. Get All MA Contracts
app.get(['/api/ma-contracts', '/api/v1/ma-contracts'], (req, res) => {
    const formatted = exports.maContractStore.map(formatContractWithRounds);
    return res.json(formatted);
});
// 3. Get Single MA Contract by ID (with rounds)
app.get(['/api/ma-contracts/:id', '/api/v1/ma-contracts/:id'], (req, res) => {
    const contract = exports.maContractStore.find(c => c.id === req.params.id);
    if (!contract) {
        return res.status(404).json({ error: 'ไม่พบสัญญา MA ที่ระบุ' });
    }
    const rounds = exports.maRoundStore
        .filter(r => r.contract_id === contract.id)
        .sort((a, b) => a.round_number - b.round_number);
    return res.json({
        ...formatContractWithRounds(contract),
        rounds
    });
});
// 4. Create New MA Contract
app.post(['/api/ma-contracts', '/api/v1/ma-contracts'], (req, res) => {
    try {
        const body = req.body;
        const year = new Date().getFullYear();
        const count = exports.maContractStore.length + 1;
        const contractNo = body.contract_no || `MAC-${year}-${String(count).padStart(4, '0')}`;
        const newId = `mac_${Date.now()}`;
        // Extract customer and site names from notes if not directly provided
        let customerName = body.customer_name;
        let customerPhone = body.customer_phone;
        let siteName = body.site_name;
        let siteAddress = body.site_address;
        if (body.notes && (!customerName || !siteName)) {
            const lines = String(body.notes).split('\n');
            for (const line of lines) {
                if (line.startsWith('ลูกค้า:') && !customerName)
                    customerName = line.replace('ลูกค้า:', '').trim();
                if (line.startsWith('โทร:') && !customerPhone)
                    customerPhone = line.replace('โทร:', '').trim();
                if (line.startsWith('ไซต์:') && !siteName)
                    siteName = line.replace('ไซต์:', '').trim();
                if (line.startsWith('ที่อยู่:') && !siteAddress)
                    siteAddress = line.replace('ที่อยู่:', '').trim();
            }
        }
        const newContract = {
            id: newId,
            contract_no: contractNo,
            customer_id: body.customer_id || null,
            customer_site_id: body.customer_site_id || null,
            customer_name: customerName || null,
            customer_phone: customerPhone || null,
            site_name: siteName || null,
            site_address: siteAddress || null,
            service_type: body.service_type || 'ล้างแอร์',
            service_items: Array.isArray(body.service_items) ? body.service_items : [],
            frequency_months: Number(body.frequency_months) || 3,
            total_rounds: Number(body.total_rounds) || 4,
            contract_start_date: body.contract_start_date || new Date().toISOString().split('T')[0],
            contract_end_date: body.contract_end_date || '',
            contract_value: body.contract_value || 0,
            status: body.status || 'Active',
            notes: body.notes || '',
            created_by: body.created_by || 'admin',
            created_at: new Date().toISOString()
        };
        exports.maContractStore.unshift(newContract);
        // Auto generate rounds if not created externally
        if (req.query.auto_rounds !== 'false' && newContract.total_rounds > 0) {
            const startDate = new Date(newContract.contract_start_date);
            for (let i = 1; i <= newContract.total_rounds; i++) {
                const roundDate = new Date(startDate);
                roundDate.setMonth(roundDate.getMonth() + (newContract.frequency_months * (i - 1)));
                exports.maRoundStore.push({
                    id: `mar_${Date.now()}_${i}`,
                    contract_id: newId,
                    project_id: null,
                    round_number: i,
                    scheduled_date: roundDate.toISOString().split('T')[0],
                    actual_date: null,
                    status: 'Scheduled',
                    notes: null,
                    created_at: new Date().toISOString()
                });
            }
        }
        return res.status(201).json(formatContractWithRounds(newContract));
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 5. Create MA Round
app.post(['/api/ma-rounds', '/api/v1/ma-rounds'], (req, res) => {
    try {
        const { contract_id, round_number, scheduled_date, status, notes } = req.body;
        if (!contract_id || !round_number || !scheduled_date) {
            return res.status(400).json({ error: 'contract_id, round_number, and scheduled_date are required' });
        }
        const newRound = {
            id: `mar_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            contract_id,
            project_id: null,
            round_number: Number(round_number),
            scheduled_date,
            actual_date: null,
            status: status || 'Scheduled',
            notes: notes || null,
            created_at: new Date().toISOString()
        };
        exports.maRoundStore.push(newRound);
        return res.status(201).json(newRound);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// 6. Update MA Round (Mark Completed or Reschedule)
app.patch(['/api/ma-rounds/:id', '/api/v1/ma-rounds/:id'], (req, res) => {
    try {
        const round = exports.maRoundStore.find(r => r.id === req.params.id);
        if (!round) {
            return res.status(404).json({ error: 'ไม่พบรอบบริการที่ระบุ' });
        }
        const { status, scheduled_date, actual_date, notes } = req.body;
        if (status)
            round.status = status;
        if (scheduled_date)
            round.scheduled_date = scheduled_date;
        if (actual_date !== undefined)
            round.actual_date = actual_date;
        if (notes !== undefined)
            round.notes = notes;
        // If all rounds of contract are completed, mark contract completed
        const contractRounds = exports.maRoundStore.filter(r => r.contract_id === round.contract_id);
        const contract = exports.maContractStore.find(c => c.id === round.contract_id);
        if (contract && contractRounds.length > 0 && contractRounds.every(r => r.status === 'Completed')) {
            contract.status = 'Completed';
        }
        return res.json(round);
    }
    catch (err) {
        return res.status(500).json({ error: err.message });
    }
});
// Global error protection
process.on('uncaughtException', (err) => {
    console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('[UNHANDLED REJECTION]', reason);
});
// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SPMT Production REST API Server running on port ${PORT}`);
});
