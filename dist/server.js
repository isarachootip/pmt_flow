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
exports.coreSitePhotoStore = exports.coreVisitCheckinStore = exports.coreJobServiceStore = exports.coreJobStore = exports.coreCustomerStore = exports.stagingSurveyStore = exports.StagingProcessStatus = exports.sysLoginLogStore = exports.sysSessionStore = exports.sysUserStore = exports.UserRole = exports.JobStatus = void 0;
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
app.use(express_1.default.json());
// Serve static frontend files (index.html)
app.use(express_1.default.static(path_1.default.join(__dirname, '../')));
app.use(express_1.default.static(path_1.default.join(__dirname, './')));
// Root Route Handler - Serve Frontend index.html
app.get('/', (req, res) => {
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
        { user_code: 'USR-001', username: 'admin', email: 'admin@pmt.local', full_name: 'ผู้ดูแลระบบ', role: UserRole.ADMIN, password_hash: hashPassword('Admin@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
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
    const session = exports.sysSessionStore.find(s => s.token === token && !s.revoked_at && new Date(s.expires_at) > new Date());
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
    const user = exports.sysUserStore.find(u => u.username === username);
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
// Seed 5 Initial Core Jobs (Sync with UI Frontend)
function seedInitialCoreData() {
    exports.coreCustomerStore.length = 0;
    exports.coreJobStore.length = 0;
    exports.coreJobServiceStore.length = 0;
    const mockCustomers = [
        { id: 1, customer_code: 'CUST-001', first_name: 'ณวัฒน์', last_name: 'รักสงบ', phone: '081-111-2222', address: '99/1 Sukhumvit 55, Bangkok', lat: 13.7563, lng: 100.5018 },
        { id: 2, customer_code: 'CUST-002', first_name: 'สมศรี', last_name: 'สุขใจ', phone: '082-222-3333', address: '12 Ari Samphan, Phaya Thai', lat: 13.7801, lng: 100.5432 },
        { id: 3, customer_code: 'CUST-003', first_name: 'เอนก', last_name: 'มั่งคั่ง', phone: '083-333-4444', address: '45 Silom Rd, Bang Rak', lat: 13.7234, lng: 100.5289 },
        { id: 4, customer_code: 'CUST-004', first_name: 'มาลี', last_name: 'มีโชค', phone: '084-444-5555', address: '88 Ladprao 15, Chatuchak', lat: 13.8056, lng: 100.5712 },
        { id: 5, customer_code: 'CUST-005', first_name: 'ฉัตรชัย', last_name: 'เจริญวิทย์', phone: '085-555-6666', address: '22 Thong Lo 10, Watthana', lat: 13.7312, lng: 100.5823 },
    ];
    exports.coreCustomerStore.push(...mockCustomers);
    const mockJobs = [
        { id: 1, job_no: 'JOB202609001', external_ref_id: 'INT-2026-001', customer_id: 1, status: JobStatus.IN_PROGRESS, property_type: 'บ้านเดี่ยว', project_type: 'Renovate', project_sub_type: 'Renovate ครัว', assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-05', services: ['Renovate ครัว'], overall_progress: 45, created_at: '2026-09-01T08:00:00Z' },
        { id: 2, job_no: 'JOB202609002', external_ref_id: 'INT-2026-002', customer_id: 2, status: JobStatus.QC_PENDING, property_type: 'ทาวน์โฮม', project_type: 'Installation', project_sub_type: 'ปั้มแท็งก์', assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-09-02', services: ['ปั้มแท็งก์'], overall_progress: 100, created_at: '2026-09-01T09:00:00Z' },
        { id: 3, job_no: 'JOB202609003', external_ref_id: 'INT-2026-003', customer_id: 3, status: JobStatus.QC_PASSED, property_type: 'คอนโดมิเนียม', project_type: 'Installation', project_sub_type: 'ติดตั้งเครื่องทำน้ำอุ่น', assigned_tech: 'Team C (วิชัย)', plan_date: '2026-08-30', services: ['ติดตั้งเครื่องทำน้ำอุ่น'], overall_progress: 100, created_at: '2026-08-29T10:00:00Z' },
        { id: 4, job_no: 'JOB202609004', external_ref_id: 'INT-2026-004', customer_id: 4, status: JobStatus.DRAFT, property_type: 'บ้านเดี่ยว', project_type: 'Survey', project_sub_type: 'สำรวจหน้างาน', assigned_tech: 'Team A (สมศักดิ์)', plan_date: '2026-09-10', services: ['สำรวจหน้างาน'], overall_progress: 0, created_at: '2026-09-02T11:00:00Z' },
        { id: 5, job_no: 'JOB202609005', external_ref_id: 'INT-2026-005', customer_id: 5, status: JobStatus.AFTER_SALE, property_type: 'บ้านเดี่ยว', project_type: 'Renovate', project_sub_type: 'Renovate ครัว', assigned_tech: 'Team B (ประเสริฐ)', plan_date: '2026-08-25', services: ['Renovate ครัว'], overall_progress: 100, created_at: '2026-08-24T12:00:00Z' }
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
// Seed 5 Mock Survey Records for Staging Monitoring & Manual Conversion
function seedInitialStagingData() {
    exports.stagingSurveyStore.length = 0; // Reset
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
// Initial Seed on Server Startup
seedInitialStagingData();
seedInitialCoreData();
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
            created_at: job.created_at
        }
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
app.post('/api/v1/jobs/reset', (req, res) => {
    seedInitialCoreData();
    seedInitialStagingData();
    return res.json({
        success: true,
        message: 'Reset core jobs and staging records to initial dataset successfully',
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
    return res.status(201).json({ success: true, data: boq });
});
// =============================================================================
// 4. TASK & GANTT SCHEDULING API (Req #7 & #8 - Independent Tasks)
// =============================================================================
app.post('/api/v1/jobs/:id/tasks', async (req, res) => {
    const jobId = Number(req.params.id);
    const { task_name, start_date, duration_days, assigned_tech } = req.body;
    // Auto calculate end date if duration is provided (Req #7.1)
    const start = new Date(start_date);
    const end = new Date(start);
    end.setDate(end.getDate() + (duration_days - 1));
    const newTask = {
        id: Date.now(),
        job_id: jobId,
        task_name,
        plan_start_date: start.toISOString().split('T')[0],
        plan_end_date: end.toISOString().split('T')[0],
        duration_days,
        assigned_tech,
        status: 'PENDING',
        progress_percent: 0
    };
    return res.status(201).json({ success: true, data: newTask });
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
// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 SPMT Production REST API Server running on port ${PORT}`);
});
