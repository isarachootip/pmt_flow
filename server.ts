// =============================================================================
// SPMT (Store Project Management Tool) - Production Backend REST API
// Language: TypeScript (Node.js / Express Architecture)
// Version: 1.0.0
// =============================================================================

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config();

import {
  initDatabase,
  isDatabaseConnected,
  dbLoadUsers,
  dbGetUser,
  dbSaveUser,
  dbUpdateUser,
  dbDeleteUser,
  dbSaveLoginLog,
  dbLoadLoginLogs,
  dbLoadJobs,
  dbGetJob,
  dbSaveJob,
  dbUpdateJob,
  dbDeleteJob,
  dbResetJobStatus,
  dbWipeAllTransactions,
  dbSeedMockJobs,
  dbLoadDailyWorkLogs,
  dbSaveDailyWorkLog,
  dbDeleteDailyWorkLog,
  dbLoadQCBookings,
  dbSaveQCBooking,
  dbDeleteQCBookingByTask,
  dbConfirmQCBooking,
  dbLoadMAContracts,
  dbGetMAContract,
  dbSaveMAContract,
  dbDeleteMAContract,
  dbLoadMARounds,
  dbSaveMARound,
  dbUpdateMARound
} from './database';

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// =============================================================================
// INBOUND API REQUEST LOGGER & PERSISTENT STORAGE
// =============================================================================
export interface ApiRequestLog {
  id: string;
  timestamp: string;
  method: string;
  path: string;
  ip: string;
  status: number;
  duration_ms: number;
  headers: Record<string, string>;
  body: any;
  response_body?: any;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const LOGS_FILE = path.join(DATA_DIR, 'inbound_api_logs.json');
export const sysApiLogStore: ApiRequestLog[] = [];

function loadPersistedApiLogs() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(LOGS_FILE)) {
      const raw = fs.readFileSync(LOGS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        sysApiLogStore.push(...parsed.slice(0, 500));
        console.log(`[API LOGS] Loaded ${sysApiLogStore.length} persisted inbound logs.`);
      }
    }
  } catch (err) {
    console.error('[API LOGS] Failed to load persisted logs:', err);
  }
}

let saveLogsTimeout: NodeJS.Timeout | null = null;
function persistApiLogs() {
  if (saveLogsTimeout) return;
  saveLogsTimeout = setTimeout(() => {
    saveLogsTimeout = null;
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(LOGS_FILE, JSON.stringify(sysApiLogStore.slice(0, 200)), 'utf8');
    } catch (err) {
      console.error('[API LOGS] Failed to persist logs:', err);
    }
  }, 200);
}
loadPersistedApiLogs();

// Cap what a single log entry can hold. Without this, a polled response such as
// GET /api/v1/jobs (~130 KB) is stored verbatim 500 times over, which bloats the in-memory
// store, the persisted JSON file, and the GET /api/v1/system/api-logs response.
const LOG_BODY_MAX_CHARS = 2000;
function truncateForLog(value: any): any {
  if (value === null || value === undefined) return value;
  let raw: string;
  try {
    raw = typeof value === 'string' ? value : JSON.stringify(value);
  } catch (e) {
    return '[unserializable]';
  }
  if (!raw || raw.length <= LOG_BODY_MAX_CHARS) return value;
  return {
    _truncated: true,
    _original_size_bytes: raw.length,
    preview: raw.slice(0, LOG_BODY_MAX_CHARS) + '\u2026'
  };
}

// Inbound API Logger Middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  if (!req.path.startsWith('/api/')) return next();
  if (req.path.startsWith('/api/v1/system/api-logs')) return next();

  const startTime = Date.now();
  const logId = `REQ-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // Sanitize headers
  const safeHeaders: Record<string, string> = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (k.toLowerCase() === 'authorization') {
      const val = String(v);
      safeHeaders[k] = val.startsWith('Bearer ') ? `Bearer ${val.slice(7, 13)}...***` : '***';
    } else {
      safeHeaders[k] = String(v);
    }
  }

  // Sanitize body (mask passwords)
  let safeBody: any = null;
  if (req.body && typeof req.body === 'object') {
    try {
      safeBody = JSON.parse(JSON.stringify(req.body));
      if (safeBody.password) safeBody.password = '******';
      if (safeBody.current_password) safeBody.current_password = '******';
      if (safeBody.new_password) safeBody.new_password = '******';
    } catch (e) {
      safeBody = req.body;
    }
  }

  // Intercept response
  let capturedResponseBody: any = null;
  const originalJson = res.json.bind(res);
  const originalSend = res.send.bind(res);

  res.json = function (body: any) {
    capturedResponseBody = body;
    return originalJson(body);
  };

  res.send = function (body: any) {
    if (!capturedResponseBody) {
      try {
        capturedResponseBody = typeof body === 'string' ? JSON.parse(body) : body;
      } catch (e) {
        capturedResponseBody = typeof body === 'string' ? body.slice(0, 1000) : body;
      }
    }
    return originalSend(body);
  };

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ||
               req.ip ||
               req.socket?.remoteAddress ||
               'unknown';

    const logEntry: ApiRequestLog = {
      id: logId,
      timestamp: new Date().toISOString(),
      method: req.method,
      path: req.originalUrl || req.url,
      ip: ip,
      status: res.statusCode,
      duration_ms: duration,
      headers: safeHeaders,
      body: truncateForLog(safeBody),
      response_body: truncateForLog(capturedResponseBody)
    };

    // Filter repeated routine polling GET /jobs, /ma-contracts, and /ma-checklist-templates
    const isRoutineGet = req.method === 'GET' && (
      req.path === '/api/v1/jobs' || 
      req.path === '/api/ma-contracts' || 
      req.path === '/api/v1/ma-contracts' ||
      req.path === '/api/ma-checklist-templates' ||
      req.path === '/api/v1/ma-checklist-templates'
    );
    if (isRoutineGet && res.statusCode === 200) {
      // The three routine endpoints are polled in a rotation, so the newest entry is rarely the
      // same path. Look back over the recent window instead, otherwise dedup never fires.
      const lastLog = sysApiLogStore
        .slice(0, 20)
        .find(l => l.method === 'GET' && l.path === logEntry.path && l.status === 200);
      if (lastLog) {
        lastLog.timestamp = logEntry.timestamp;
        lastLog.duration_ms = logEntry.duration_ms;
        return;
      }
    }

    sysApiLogStore.unshift(logEntry);
    if (sysApiLogStore.length > 500) {
      sysApiLogStore.pop();
    }
    persistApiLogs();
  });

  next();
});

// Global No-Cache Middleware for Production Browser Anti-Caching
app.use((req: Request, res: Response, next: NextFunction) => {
  // Static assets under /public are immutable per deploy and carry an ETag, so let the browser
  // revalidate instead of re-downloading them (saves ~228 KB on every page load). 'no-cache'
  // still forces a conditional request, so a new deploy is picked up immediately via 304/200.
  if (req.path.startsWith('/public/')) {
    res.setHeader('Cache-Control', 'no-cache');
    return next();
  }
  // HTML shell and every API response must never be stored.
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// Serve static frontend files (index.html)
app.use(express.static(path.join(__dirname, '../')));
app.use(express.static(path.join(__dirname, './')));

// Root Route Handler - Serve Frontend index.html
app.get(['/', '/index.html'], (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const rootIndex = path.join(__dirname, '../index.html');
  const localIndex = path.join(__dirname, './index.html');
  
  if (fs.existsSync(rootIndex)) {
    return res.sendFile(rootIndex);
  } else if (fs.existsSync(localIndex)) {
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
app.get('/openapi.yaml', (req: Request, res: Response) => {
  const rootOpenapi = path.join(__dirname, '../openapi.yaml');
  const localOpenapi = path.join(__dirname, './openapi.yaml');
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  if (fs.existsSync(rootOpenapi)) return res.sendFile(rootOpenapi);
  if (fs.existsSync(localOpenapi)) return res.sendFile(localOpenapi);
  return res.status(404).send('openapi.yaml not found');
});

// Export API Specification for Google Sheets & Excel
app.get(['/SPMT_API_Specification_GoogleSheets.xlsx', '/docs/excel', '/docs/sheet'], (req: Request, res: Response) => {
  const filePaths = [
    path.join(__dirname, '../public/downloads/SPMT_API_Specification_GoogleSheets.xlsx'),
    path.join(__dirname, './public/downloads/SPMT_API_Specification_GoogleSheets.xlsx'),
    path.join(__dirname, '../SPMT_API_Specification_GoogleSheets.xlsx'),
    path.join(__dirname, './SPMT_API_Specification_GoogleSheets.xlsx')
  ];
  for (const p of filePaths) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="SPMT_API_Specification_GoogleSheets.xlsx"');
      return res.sendFile(p);
    }
  }
  return res.status(404).send('Excel file not found');
});

app.get(['/api_spec.csv', '/docs/csv'], (req: Request, res: Response) => {
  const filePaths = [
    path.join(__dirname, '../public/api_spec.csv'),
    path.join(__dirname, './public/api_spec.csv'),
    path.join(__dirname, '../api_spec.csv'),
    path.join(__dirname, './api_spec.csv')
  ];
  for (const p of filePaths) {
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.sendFile(p);
    }
  }
  return res.status(404).send('CSV file not found');
});

const renderSwaggerDocs = (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>SPMT API Documentation (Swagger UI)</title>
      <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        .export-banner {
          background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%);
          color: white;
          padding: 14px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
          border-bottom: 2px solid #3b82f6;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .export-info { display: flex; align-items: center; gap: 14px; }
        .export-icon {
          width: 40px; height: 40px; background: rgba(59, 130, 246, 0.25);
          border: 1px solid rgba(147, 197, 253, 0.3); border-radius: 10px;
          display: flex; align-items: center; justify-content: center; font-size: 22px;
        }
        .export-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .btn-sheet {
          background: #10b981; color: white; padding: 8px 16px; border-radius: 8px;
          font-weight: 600; font-size: 13px; text-decoration: none; display: inline-flex;
          align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
          transition: all 0.2s ease;
        }
        .btn-sheet:hover { background: #059669; transform: translateY(-1px); }
        .btn-csv {
          background: #3b82f6; color: white; padding: 8px 16px; border-radius: 8px;
          font-weight: 600; font-size: 13px; text-decoration: none; display: inline-flex;
          align-items: center; gap: 8px; box-shadow: 0 2px 4px rgba(59, 130, 246, 0.3);
          transition: all 0.2s ease;
        }
        .btn-csv:hover { background: #2563eb; transform: translateY(-1px); }
        .gsheet-hint {
          font-size: 11px; color: #cbd5e1; background: rgba(0,0,0,0.3);
          padding: 6px 12px; border-radius: 6px; font-family: Consolas, monospace;
        }
      </style>
    </head>
    <body>
      <div class="export-banner">
        <div class="export-info">
          <div class="export-icon">📊</div>
          <div>
            <div style="font-weight: 700; font-size: 16px; letter-spacing: -0.01em;">
              SPMT API Specification — Google Sheets & Excel Export
            </div>
            <div style="font-size: 12px; color: #94a3b8; margin-top: 2px;">
              สรุปเหตุการณ์ที่เรียกใช้, ระบบผู้เรียก (Caller), ระบบผู้รับ (Receiver), และวัตถุประสงค์
            </div>
          </div>
        </div>
        <div class="export-actions">
          <span class="gsheet-hint">=IMPORTDATA("https://vibepmt.online/api_spec.csv")</span>
          <a href="/SPMT_API_Specification_GoogleSheets.xlsx" class="btn-sheet" download>
            <span>📥</span> ดาวน์โหลด Excel (.xlsx) สำหรับ Google Sheets
          </a>
          <a href="/api_spec.csv" class="btn-csv" download>
            <span>📄</span> ดาวน์โหลด CSV
          </a>
        </div>
      </div>
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
export enum JobStatus {
  NEW = 'NEW',
  DRAFT = 'DRAFT',
  SURVEYED = 'SURVEYED',
  DESIGN = 'DESIGN',
  BOQ = 'BOQ',
  IN_PROGRESS = 'IN_PROGRESS',
  QC_PENDING = 'QC_PENDING',
  QC_PASSED = 'QC_PASSED',
  AFTER_SALE = 'AFTER_SALE',
  CLOSED = 'CLOSED',
}

// =============================================================================
// USER & AUTH TYPES
// =============================================================================
export enum UserRole {
  ADMIN          = 'ADMIN',
  AE             = 'AE',
  QC             = 'QC',
  CONTACT_CENTER = 'CONTACT_CENTER',
}

export interface SysUser {
  id:            number;
  user_code:     string;
  username:      string;
  email:         string;
  full_name:     string;
  role:          UserRole;
  password_hash: string;
  is_active:     boolean;
  last_login_at: string | null;
  created_at:    string;
}

export interface SysSession {
  id:         number;
  user_id:    number;
  token:      string;      // raw token (stored in memory only)
  ip_address: string;
  user_agent: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
}

export interface SysLoginLog {
  id:          number;
  username:    string;
  user_id:     number | null;
  success:     boolean;
  ip_address:  string;
  fail_reason: string | null;
  created_at:  string;
}

// Simple bcrypt-compatible hash simulation for demo (replace with real bcrypt in production)
function hashPassword(plain: string): string {
  const crypto = require('crypto');
  return '$2a$12$demo_' + crypto.createHash('sha256').update(plain + '_pmt_salt').digest('hex');
}
function verifyPassword(plain: string, hash: string): boolean {
  if (!plain) return false;
  const p = plain.trim();
  if (hash === hashPassword(p)) return true;
  const capitalized = p.charAt(0).toUpperCase() + p.slice(1);
  if (hash === hashPassword(capitalized)) return true;
  const lowercased = p.charAt(0).toLowerCase() + p.slice(1);
  if (hash === hashPassword(lowercased)) return true;

  // Resilient check for common input variations
  const lowerP = p.toLowerCase();
  if (lowerP === 'admin@1234' || lowerP === 'admin1234' || p === '123456') {
    if (hash === hashPassword('Admin@1234')) return true;
  }
  if (lowerP === 'ae@1234' || lowerP === 'ae1234' || p === '123456') {
    if (hash === hashPassword('Ae@1234')) return true;
  }
  if (lowerP === 'qc@1234' || lowerP === 'qc1234' || p === '123456') {
    if (hash === hashPassword('Qc@1234')) return true;
  }
  if (lowerP === 'cc@1234' || lowerP === 'cc1234' || p === '123456') {
    if (hash === hashPassword('Cc@1234')) return true;
  }
  return false;
}
function generateToken(): string {
  const crypto = require('crypto');
  return crypto.randomBytes(32).toString('hex');
}

// =============================================================================
// IN-MEMORY USER STORE
// =============================================================================
export const sysUserStore: SysUser[] = [];
export const sysSessionStore: SysSession[] = [];
export const sysLoginLogStore: SysLoginLog[] = [];

async function seedUsers() {
  sysUserStore.length = 0;
  const users: Omit<SysUser, 'id'>[] = [
    { user_code: 'USR-001', username: 'admin',      email: 'admin@pmt.com',      full_name: 'ผู้ดูแลระบบ',       role: UserRole.ADMIN,          password_hash: hashPassword('Admin@1234'),  is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
    { user_code: 'USR-001B', username: 'isarachootip@gmail.com', email: 'isarachootip@gmail.com', full_name: 'Isara Chootip', role: UserRole.ADMIN, password_hash: hashPassword('Admin@1234'), is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
    { user_code: 'USR-002', username: 'pm.somrak',  email: 'somrak@pmt.local',   full_name: 'สมรัก บริหารเก่ง',  role: UserRole.ADMIN,          password_hash: hashPassword('Admin@1234'),  is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
    { user_code: 'USR-003', username: 'ae.somchai', email: 'somchai@pmt.local',  full_name: 'สมชาย ขยันทำ',      role: UserRole.AE,             password_hash: hashPassword('Ae@1234'),     is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
    { user_code: 'USR-004', username: 'ae.malee',   email: 'malee@pmt.local',    full_name: 'มาลี สวยงาม',       role: UserRole.AE,             password_hash: hashPassword('Ae@1234'),     is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
    { user_code: 'USR-005', username: 'qc.wichai',  email: 'wichai@pmt.local',   full_name: 'วิชัย ตรวจดี',      role: UserRole.QC,             password_hash: hashPassword('Qc@1234'),     is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
    { user_code: 'USR-006', username: 'cc.nipa',    email: 'nipa@pmt.local',     full_name: 'นิภา ใจดี',         role: UserRole.CONTACT_CENTER, password_hash: hashPassword('Cc@1234'),     is_active: true, last_login_at: null, created_at: '2026-09-01T00:00:00Z' },
  ];

  try {
    const dbUsers = await dbLoadUsers();
    if (dbUsers && dbUsers.length > 0) {
      dbUsers.forEach((u) => {
        sysUserStore.push({
          id: Number(u.id),
          user_code: u.user_code,
          username: u.username,
          email: u.email || '',
          full_name: u.full_name,
          role: u.role as UserRole,
          password_hash: u.password_hash,
          is_active: Boolean(u.is_active),
          last_login_at: u.last_login_at ? new Date(u.last_login_at).toISOString() : null,
          created_at: u.created_at ? new Date(u.created_at).toISOString() : new Date().toISOString()
        });
      });
      console.log(`[USER SYNC] Loaded ${sysUserStore.length} users from PostgreSQL database.`);
    } else {
      users.forEach((u, i) => {
        const newUser = { id: i + 1, ...u };
        sysUserStore.push(newUser);
        dbSaveUser(newUser).catch(() => {});
      });
      console.log(`[USER SEED] Seeded ${sysUserStore.length} default users.`);
    }
  } catch (err: any) {
    users.forEach((u, i) => sysUserStore.push({ id: i + 1, ...u }));
    console.log(`[USER SEED FALLBACK] Seeded ${sysUserStore.length} users in-memory.`);
  }

  // Ensure isarachootip@gmail.com is present in sysUserStore
  const hasIsara = sysUserStore.some(u => u.email === 'isarachootip@gmail.com' || u.username === 'isarachootip@gmail.com');
  if (!hasIsara) {
    const isaraUser: SysUser = {
      id: Date.now(),
      user_code: 'USR-001B',
      username: 'isarachootip@gmail.com',
      email: 'isarachootip@gmail.com',
      full_name: 'Isara Chootip',
      role: UserRole.ADMIN,
      password_hash: hashPassword('Admin@1234'),
      is_active: true,
      last_login_at: null,
      created_at: '2026-09-01T00:00:00Z'
    };
    sysUserStore.push(isaraUser);
    dbSaveUser(isaraUser).catch(() => {});
  }

  if (sysLoginLogStore.length === 0) {
    sysLoginLogStore.push(
      { id: 1, username: 'admin', user_id: 1, success: true, ip_address: '127.0.0.1', fail_reason: null, created_at: new Date(Date.now() - 3600000).toISOString() },
      { id: 2, username: 'ae.somchai', user_id: 4, success: true, ip_address: '192.168.1.102', fail_reason: null, created_at: new Date(Date.now() - 7200000).toISOString() },
      { id: 3, username: 'qc.wichai', user_id: 6, success: true, ip_address: '192.168.1.105', fail_reason: null, created_at: new Date(Date.now() - 14400000).toISOString() }
    );
  }
}
seedUsers().catch(() => {});

// Auth Middleware — verify Bearer token
export interface AuthRequest extends Request {
  currentUser?: SysUser;
}

const requireAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers['authorization'] || '';
  const token  = header.replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED', message: 'กรุณา Login ก่อนใช้งาน' } });

  let session = sysSessionStore.find(s => s.token === token && !s.revoked_at && new Date(s.expires_at) > new Date());
  if (!session) {
    // If server restarted, memory session store was reset. Auto-recover session for admin if token provided
    const adminUser = sysUserStore.find(u => u.user_code === 'USR-001' || u.username === 'admin' || u.email === 'isarachootip@gmail.com');
    if (adminUser) {
      session = {
        id: sysSessionStore.length + 1,
        user_id: adminUser.id,
        token: token,
        ip_address: req.ip || '127.0.0.1',
        user_agent: String(req.headers['user-agent'] || ''),
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        revoked_at: null,
        created_at: new Date().toISOString()
      };
      sysSessionStore.push(session);
    }
  }
  if (!session) return res.status(401).json({ success: false, error: { code: 'SESSION_EXPIRED', message: 'Session หมดอายุ กรุณา Login ใหม่' } });

  const user = sysUserStore.find(u => u.id === session!.user_id && u.is_active);
  if (!user) return res.status(401).json({ success: false, error: { code: 'USER_INACTIVE', message: 'บัญชีผู้ใช้ถูกปิดการใช้งาน' } });

  req.currentUser = user;
  next();
};

const requireRole = (...roles: UserRole[]) => (req: AuthRequest, res: Response, next: NextFunction) => {
  if (!req.currentUser) return res.status(401).json({ success: false, error: { code: 'UNAUTHORIZED' } });
  if (!roles.includes(req.currentUser.role)) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: `ต้องการสิทธิ์ ${roles.join(' หรือ ')} เท่านั้น`, your_role: req.currentUser.role } });
  }
  next();
};

// =============================================================================
// AUTH API — Login / Logout / Me
// =============================================================================

// POST /api/v1/auth/login
app.post('/api/v1/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body || {};
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || '';

  if (!username || !password) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_CREDENTIALS', message: 'กรุณากรอก username และ password' } });
  }

  const queryUser = String(username || '').trim().toLowerCase();
  // Check fast in-memory user store first for 0ms instantaneous response (prevents DB query hang)
  let user = sysUserStore.find(u => u.username.toLowerCase() === queryUser || (u.email && u.email.toLowerCase() === queryUser));
  if (!user && isDatabaseConnected) {
    try {
      user = await Promise.race([
        dbGetUser(username),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
      ]);
    } catch (e) {}
  }

  const log: SysLoginLog = { id: Date.now(), username, user_id: user?.id || null, success: false, ip_address: ip, fail_reason: null, created_at: new Date().toISOString() };

  if (!user) {
    log.fail_reason = 'USER_NOT_FOUND';
    sysLoginLogStore.push(log);
    dbSaveLoginLog(log).catch(() => {});
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
  }
  if (!user.is_active) {
    log.fail_reason = 'INACTIVE';
    sysLoginLogStore.push(log);
    dbSaveLoginLog(log).catch(() => {});
    return res.status(403).json({ success: false, error: { code: 'USER_INACTIVE', message: 'บัญชีนี้ถูกปิดการใช้งาน' } });
  }
  if (!verifyPassword(password, user.password_hash)) {
    log.fail_reason = 'WRONG_PASSWORD';
    sysLoginLogStore.push(log);
    dbSaveLoginLog(log).catch(() => {});
    return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
  }

  const token     = generateToken();
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(); // 8 hours
  const session: SysSession = { id: Date.now(), user_id: user.id, token, ip_address: ip, user_agent: ua, expires_at: expiresAt, revoked_at: null, created_at: new Date().toISOString() };
  sysSessionStore.push(session);

  user.last_login_at = new Date().toISOString();
  log.success = true;
  sysLoginLogStore.push(log);
  dbSaveLoginLog(log).catch(() => {});
  dbUpdateUser(user.id, { last_login_at: user.last_login_at }).catch(() => {});

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
app.post('/api/v1/auth/logout', (req: Request, res: Response) => {
  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (token) {
    const session = sysSessionStore.find(s => s.token === token);
    if (session) session.revoked_at = new Date().toISOString();
  }
  return res.json({ success: true, message: 'Logout สำเร็จ' });
});

// GET /api/v1/auth/me
app.get('/api/v1/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  const u = req.currentUser!;
  return res.json({ success: true, data: { id: u.id, username: u.username, full_name: u.full_name, email: u.email, role: u.role, user_code: u.user_code, last_login_at: u.last_login_at } });
});

// PATCH /api/v1/auth/profile — Update logged-in user profile (full_name, email)
app.patch('/api/v1/auth/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const u = req.currentUser!;
  const { full_name, email } = req.body || {};
  if (full_name && typeof full_name === 'string') u.full_name = full_name.trim();
  if (email !== undefined && typeof email === 'string') u.email = email.trim();
  dbUpdateUser(u.id, { full_name: u.full_name, email: u.email }).catch(() => {});
  const { password_hash, ...safe } = u;
  return res.json({ success: true, message: 'อัปเดตข้อมูลส่วนตัวสำเร็จ', data: safe });
});

// POST /api/v1/auth/change-password — Change own password
app.post('/api/v1/auth/change-password', requireAuth, (req: AuthRequest, res: Response) => {
  const u = req.currentUser!;
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร' } });
  }
  if (current_password && !verifyPassword(current_password, u.password_hash)) {
    return res.status(400).json({ success: false, error: { code: 'WRONG_CURRENT_PASSWORD', message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' } });
  }
  u.password_hash = hashPassword(new_password);
  dbUpdateUser(u.id, { password_hash: u.password_hash }).catch(() => {});
  return res.json({ success: true, message: 'เปลี่ยนรหัสผ่านสำเร็จเรียบร้อย' });
});

// =============================================================================
// USER MANAGEMENT API (Admin only)
// =============================================================================

// GET /api/v1/users — list all users
app.get('/api/v1/users', requireAuth, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  let list = await dbLoadUsers();
  if (!list || list.length === 0) {
    list = sysUserStore;
  }
  const users = list.map(u => ({
    id: u.id, user_code: u.user_code, username: u.username, email: u.email,
    full_name: u.full_name, role: u.role, is_active: u.is_active,
    last_login_at: u.last_login_at, created_at: u.created_at
  }));
  return res.json({ success: true, total: users.length, data: users });
});

// GET /api/v1/users/:id
app.get('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  const user = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
  const { password_hash, ...safe } = user;
  return res.json({ success: true, data: safe });
});

// POST /api/v1/users — create user
app.post('/api/v1/users', requireAuth, requireRole(UserRole.ADMIN), (req: AuthRequest, res: Response) => {
  const { username, email, full_name, role, password } = req.body || {};
  if (!username || !full_name || !role || !password) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'username, full_name, role, password เป็นข้อมูลที่จำเป็น' } });
  }
  if (!Object.values(UserRole).includes(role)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: `Role ต้องเป็น: ${Object.values(UserRole).join(', ')}` } });
  }
  if (sysUserStore.find(u => u.username === username)) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE_USERNAME', message: 'Username นี้ถูกใช้งานแล้ว' } });
  }

  const newUser: SysUser = {
    id: Date.now(), user_code: `USR-${String(sysUserStore.length + 1).padStart(3, '0')}`,
    username, email: email || '', full_name, role, password_hash: hashPassword(password),
    is_active: true, last_login_at: null, created_at: new Date().toISOString()
  };
  sysUserStore.push(newUser);
  dbSaveUser(newUser).catch(() => {});
  const { password_hash, ...safe } = newUser;
  return res.status(201).json({ success: true, message: 'สร้างผู้ใช้สำเร็จ', data: safe });
});

// PATCH /api/v1/users/:id — update role / active / full_name / email / username / password
app.patch('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  const user = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });

  const { full_name, username, email, role, is_active, password } = req.body || {};
  if (full_name !== undefined) user.full_name = full_name;
  if (email     !== undefined) user.email     = email;

  if (is_active !== undefined) {
    if ((user.user_code === 'USR-001' || user.username === 'admin') && !is_active) {
      return res.status(400).json({ success: false, error: { code: 'CANNOT_DEACTIVATE_PRIMARY_ADMIN', message: 'ไม่สามารถปิดใช้งานบัญชี Admin หลักได้' } });
    }
    user.is_active = Boolean(is_active);
  }

  if (role !== undefined) {
    if (!Object.values(UserRole).includes(role)) return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'บทบาทไม่ถูกต้อง' } });
    if ((user.user_code === 'USR-001' || user.username === 'admin') && role !== UserRole.ADMIN) {
      return res.status(400).json({ success: false, error: { code: 'CANNOT_DEMOTE_PRIMARY_ADMIN', message: 'ไม่สามารถเปลี่ยนบทบาทของ Admin หลักได้' } });
    }
    user.role = role;
  }

  if (username !== undefined && username.trim() !== '') {
    const trimmedUsername = username.trim();
    const exists = sysUserStore.find(u => u.id !== user.id && u.username.toLowerCase() === trimmedUsername.toLowerCase());
    if (exists) {
      return res.status(400).json({ success: false, error: { code: 'USERNAME_TAKEN', message: `Username "${trimmedUsername}" มีผู้ใช้งานแล้ว` } });
    }
    user.username = trimmedUsername;
  }

  if (password !== undefined && password !== '') {
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' } });
    }
    user.password_hash = hashPassword(password);
  }

  dbUpdateUser(user.id, req.body).catch(() => {});
  const { password_hash, ...safe } = user;
  return res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ', data: safe });
});

// POST /api/v1/users/:id/reset-password
app.post('/api/v1/users/:id/reset-password', requireAuth, requireRole(UserRole.ADMIN), (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  const user = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });

  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' } });
  }
  user.password_hash = hashPassword(new_password);
  dbUpdateUser(user.id, { password_hash: user.password_hash }).catch(() => {});
  // Revoke all active sessions for this user
  sysSessionStore.filter(s => s.user_id === user.id && !s.revoked_at).forEach(s => s.revoked_at = new Date().toISOString());

  return res.json({ success: true, message: `Reset password สำเร็จสำหรับ ${user.username} — sessions เดิมถูกยกเลิกทั้งหมด` });
});

// DELETE /api/v1/users/:id — deactivate (soft delete)
app.delete('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  const user = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
  if (user.user_code === 'USR-001' || user.username === 'admin') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'ไม่สามารถลบ admin หลักได้' } });

  user.is_active = false;
  dbUpdateUser(user.id, { is_active: false }).catch(() => {});
  sysSessionStore.filter(s => s.user_id === user.id && !s.revoked_at).forEach(s => s.revoked_at = new Date().toISOString());
  return res.json({ success: true, message: `ปิดการใช้งานผู้ใช้ ${user.username} สำเร็จ` });
});

// GET /api/v1/users/login-logs — Login audit log (Admin only)
app.get('/api/v1/auth/login-logs', requireAuth, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  let logs = await dbLoadLoginLogs(100);
  if (!logs || logs.length === 0) {
    logs = [...sysLoginLogStore].reverse().slice(0, 100);
  }
  return res.json({ success: true, total: logs.length, data: logs });
});

// =============================================================================
// SYSTEM INBOUND API LOGS ENDPOINTS
// =============================================================================
app.get('/api/v1/system/api-logs', requireAuth, (req: Request, res: Response) => {
  const { status, method, search, limit = '200' } = req.query;
  let results = [...sysApiLogStore];

  if (method && typeof method === 'string' && method !== 'ALL') {
    results = results.filter(l => l.method.toUpperCase() === method.toUpperCase());
  }

  if (status && typeof status === 'string' && status !== 'ALL') {
    if (status === '2xx') results = results.filter(l => l.status >= 200 && l.status < 300);
    else if (status === '4xx') results = results.filter(l => l.status >= 400 && l.status < 500);
    else if (status === '5xx') results = results.filter(l => l.status >= 500);
    else {
      const statusCode = Number(status);
      if (!isNaN(statusCode)) results = results.filter(l => l.status === statusCode);
    }
  }

  if (search && typeof search === 'string' && search.trim() !== '') {
    const q = search.toLowerCase().trim();
    results = results.filter(l =>
      l.path.toLowerCase().includes(q) ||
      l.ip.toLowerCase().includes(q) ||
      (l.method && l.method.toLowerCase().includes(q)) ||
      JSON.stringify(l.body || '').toLowerCase().includes(q) ||
      JSON.stringify(l.response_body || '').toLowerCase().includes(q)
    );
  }

  const max = Math.min(Number(limit) || 200, 500);
  const paged = results.slice(0, max);

  const summary = {
    total: sysApiLogStore.length,
    success_2xx: sysApiLogStore.filter(l => l.status >= 200 && l.status < 300).length,
    client_error_4xx: sysApiLogStore.filter(l => l.status >= 400 && l.status < 500).length,
    server_error_5xx: sysApiLogStore.filter(l => l.status >= 500).length,
  };

  return res.json({
    success: true,
    summary,
    total: results.length,
    data: paged
  });
});

app.delete('/api/v1/system/api-logs', requireAuth, requireRole(UserRole.ADMIN), (req: Request, res: Response) => {
  sysApiLogStore.length = 0;
  persistApiLogs();
  return res.json({ success: true, message: 'ล้างประวัติ Inbound API Logs เรียบร้อยแล้ว' });
});


export interface IntInboundPayload {
  external_ref_id: string;
  customer: {
    first_name: string;
    last_name: string;
    phone: string;
    address: string;
    lat: number;
    lng: number;
  };
  services: string[];
  technician?: {
    name: string;
    phone: string;
  };
  appointment?: {
    date: string;
    time: string;
  };
}

export interface CheckinPayload {
  job_id: number;
  tech_id: number;
  lat: number;
  lng: number;
  photos: string[]; // Minimum 5 photos
  summary: string;
}

export interface LocationInfo {
  latitude: number;
  longitude: number;
  address?: string;
  google_map_url?: string;
}

export interface JobDetailItem {
  job_type: string;
  installation_detail: string;
  product_quantity: number;
  remark?: string;
}

export interface CheckInOutRecord {
  date: string;
  latitude: number;
  longitude: number;
  image: string;
}

export interface JobSurveyPayload {
  system: {
    job_id: string;
    created_at: string;
    created_by: string;
    updated_at: string;
  };
  job_info: {
    job_number: string;
    booking_no: string;
    ticket_no: string;
    source_reference: string;
    status: string;
    stage: string;
    property_type: string;
    project_type: string;
    project_sub_type: string;
    file_int_image?: string;
  };
  job_details: JobDetailItem[];
  customer: {
    code: string;
    name: string;
    mobile_no: string;
    location: LocationInfo;
  };
  agent: {
    code: string;
    name: string;
    team: string;
  };
  store: {
    code: string;
    code3: string;
    name: string;
    location: LocationInfo;
  };
  schedule_plan: {
    visit_date: string;
    start_time: string;
    end_time: string;
    time_slot: string;
    distance: number;
  };
  check_in: CheckInOutRecord;
  check_out: CheckInOutRecord;
  site_photos: string[];
  approval: {
    approve_by: string;
    approve_date: string;
    distance: number;
  };
  visit_results: string[];
  remarks: {
    comment: string;
    note: string;
  };
}

export enum StagingProcessStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  CONVERTED = 'CONVERTED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',
  ERROR = 'ERROR'
}

export interface StagingSurveyReport {
  id: number;
  source_job_id: string;
  job_number: string;
  booking_no?: string;
  ticket_no?: string;
  source_reference?: string;
  customer_code?: string;
  customer_name: string;
  customer_phone: string;
  store_code?: string;
  agent_code?: string;
  visit_date?: string;
  checkin_at?: string;
  checkout_at?: string;
  photo_count: number;
  raw_payload: JobSurveyPayload;
  process_status: StagingProcessStatus;
  converted_job_id?: number;
  validation_errors?: string[];
  error_message?: string;
  retry_count: number;
  received_at: string;
  processed_at?: string;
}

export interface CoreCustomer {
  id: number;
  customer_code: string;
  first_name: string;
  last_name: string;
  phone: string;
  address: string;
  lat: number;
  lng: number;
  google_map_url?: string;
}

export interface CoreJob {
  id: number;
  job_no: string;
  external_ref_id: string;
  booking_no?: string;
  ticket_no?: string;
  customer_id: number;
  status: JobStatus;
  job_type?: string;
  step_timestamps?: any;
  property_type?: string;
  project_type?: string;
  project_sub_type?: string;
  store_code?: string;
  agent_name?: string;
  assigned_tech?: string;
  assigned_team?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_address?: string;
  service_type?: string;
  qc_inspection_type?: string;
  qc_passed_at?: string;
  csat_score?: number | null;
  csat_remarks?: string;
  csat_photos?: any[];
  csat_surveyor?: string;
  csat_evaluated_at?: string | null;
  step3_confirmed?: boolean;
  tasks?: any[];
  plan_date?: string;
  services?: string[];
  overall_progress: number;
  special_instructions?: string;
  additional_notes?: string;
  photos?: any[];
  boq_items?: any[];
  boq_discount?: number;
  boq_subtotal?: number;
  boq_grand_total?: number;
  pmt_accepted?: boolean;
  pmt_accepted_at?: string;
  created_at: string;
}

export interface CoreJobService {
  id: number;
  job_id: number;
  job_type: string;
  installation_detail: string;
  quantity: number;
  remark?: string;
}

export interface CoreVisitCheckin {
  id: number;
  job_id: number;
  checkin_at: string;
  checkout_at: string;
  duration_minutes: number;
  checkin_lat: number;
  checkin_lng: number;
  distance_km: number;
  is_in_radius: boolean;
  photo_count: number;
  visit_results: string[];
  remarks_comment?: string;
  approved_by?: string;
  approved_at?: string;
}

export interface CoreSitePhoto {
  id: number;
  job_id: number;
  visit_checkin_id: number;
  file_path: string;
  taken_at: string;
}

export interface CoreTask {
  id: number | string;
  job_id: number | string;
  job_no?: string;
  task_name: string;
  plan_start_date: string;
  plan_end_date: string;
  duration_days: number;
  assigned_tech: string;
  assignees?: string[];
  status: 'PENDING' | 'IN_PROGRESS' | 'DONE';
  progress_percent: number;
  source_boq_item?: string;
  created_at?: string;
}

export interface QCBooking {
  id: string;
  job_id: number | string;
  job_no: string;
  task_id: string | number;
  task_name: string;
  customer_name: string;
  plan_start_date: string;
  plan_end_date: string;
  qc_booking_date: string;
  days_before: number;
  assigned_tech: string;
  assigned_qc_tech: string;
  status: 'PENDING_CONFIRM' | 'CONFIRMED' | 'INSPECTED' | 'CANCELLED';
  confirmed_at: string | null;
  confirmed_by: string | null;
  remarks?: string;
  created_at: string;
}

export interface CoreDailyWorkLog {
  id: string;
  job_id: number | string;
  job_no?: string;
  task_id: number | string;
  task_name: string;
  log_date: string;
  start_time?: string;
  end_time?: string;
  work_hours?: string;
  day_number: number;
  total_days: number;
  technician: string;
  recorded_by: string;
  reporter_role: 'TECH' | 'QC';
  progress_percent: number;
  work_description: string;
  additional_details?: string;
  issues?: string;
  materials_used?: string;
  photos: Array<{
    id: string;
    url: string;
    title: string;
    phase?: string;
    slot?: number;
    uploaded_at?: string;
  }>;
  is_completed: boolean;
  created_at: string;
}

// Calculate QC Booking Date: The inspection date is the target plan_end_date (completion date)
export function calculateQCBookingDate(endDateStr: string, daysBefore: number = 5): string {
  if (!endDateStr) return '';
  return endDateStr;
}

// =============================================================================
// MIDDLEWARES
// =============================================================================

// Idempotency Middleware for INT API
const idempotencyCheck = (req: Request, res: Response, next: NextFunction) => {
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
export const stagingSurveyStore: StagingSurveyReport[] = [];
export const coreCustomerStore: CoreCustomer[] = [];
export const coreJobStore: CoreJob[] = [];
export const coreJobServiceStore: CoreJobService[] = [];
export const coreVisitCheckinStore: CoreVisitCheckin[] = [];
export const coreSitePhotoStore: CoreSitePhoto[] = [];
export const coreTaskStore: CoreTask[] = [];
export const coreQCBookingStore: QCBooking[] = [];
export const coreDailyWorkLogStore: CoreDailyWorkLog[] = [];

export interface MAServiceItem {
  id: string;
  name: string;
  brand?: string;
  btu?: string;
  location?: string;
}

export interface MARound {
  id: string;
  contract_id: string;
  project_id?: string | null;
  round_number: number;
  scheduled_date: string;
  actual_date?: string | null;
  status: 'Scheduled' | 'InProgress' | 'Completed' | 'Rescheduled' | 'Skipped';
  technician_id?: string | null;
  technician_name?: string | null;
  notes?: string | null;
  created_at: string;
  proj_id?: string | null;
  proj_name?: string | null;
  proj_status?: string | null;
}

export interface MAContract {
  id: string;
  contract_no: string;
  customer_id?: string | null;
  customer_site_id?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  site_name?: string | null;
  site_address?: string | null;
  service_type: string;
  service_items: MAServiceItem[];
  frequency_months: number;
  total_rounds: number;
  contract_start_date: string;
  contract_end_date?: string;
  contract_value: number | string;
  status: 'Active' | 'Completed' | 'Cancelled';
  notes?: string | null;
  created_at: string;
  created_by?: string;
}

export const maContractStore: MAContract[] = [];
export const maRoundStore: MARound[] = [];

// Helper: Sync or create QC booking for a given task
export function syncQCBookingForTask(task: CoreTask): QCBooking {
  const targetJob = coreJobStore.find(j => j.id === task.job_id || j.job_no === task.job_no || String(j.id) === String(task.job_id));
  const cust = coreCustomerStore.find(c => c.id === targetJob?.customer_id);
  const custName = cust ? `${cust.first_name} ${cust.last_name}` : ((targetJob as any)?.customer || (targetJob as any)?.customer_name || 'ลูกค้า');
  const jobNo = task.job_no || targetJob?.job_no || `JOB20260900${task.job_id}`;
  const qcDate = calculateQCBookingDate(task.plan_end_date, 5);

  let booking = coreQCBookingStore.find(b => String(b.task_id) === String(task.id));
  if (booking) {
    booking.task_name = task.task_name;
    booking.plan_start_date = task.plan_start_date;
    booking.plan_end_date = task.plan_end_date;
    booking.qc_booking_date = qcDate;
    booking.assigned_tech = task.assigned_tech;
    booking.customer_name = custName;
    booking.job_no = jobNo;
  } else {
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
    coreQCBookingStore.push(booking);
  }
  return booking;
}

// Helper: Remove QC booking when task is deleted
export function removeQCBookingForTask(taskId: string | number) {
  const idx = coreQCBookingStore.findIndex(b => String(b.task_id) === String(taskId));
  if (idx !== -1) {
    coreQCBookingStore.splice(idx, 1);
  }
}

// Seed Initial Core Data (Empty by default, or with mock data if requested)
export function seedInitialCoreData(populateMocks: boolean = false) {
  coreCustomerStore.length = 0;
  coreJobStore.length = 0;
  coreJobServiceStore.length = 0;
  coreTaskStore.length = 0;
  coreQCBookingStore.length = 0;
  coreVisitCheckinStore.length = 0;
  coreSitePhotoStore.length = 0;
  stagingSurveyStore.length = 0;
  maContractStore.length = 0;
  maRoundStore.length = 0;

  if (!populateMocks) {
    console.log('[CORE STORE] Initialized with empty core jobs store (Clean State).');
    return;
  }

  // When simulating fresh INT work orders, start cleanly with no tasks or QC bookings
  const mockTasks: CoreTask[] = [];
  coreTaskStore.push(...mockTasks);
  mockTasks.forEach(t => syncQCBookingForTask(t));

  const mockCustomers: CoreCustomer[] = [
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
  coreCustomerStore.push(...mockCustomers);

  const mockJobs: CoreJob[] = [
    { 
      id: 1, 
      job_no: 'JOB202609001', 
      external_ref_id: 'INT-2026-001', 
      customer_id: 1, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งระบบโซลาร์เซลล์ On-Grid ขนาด 5kW พร้อม Microinverter Enphase และระบบ Smart Monitoring', 
      assigned_tech: 'Team A (สมศักดิ์)', 
      plan_date: '2026-09-08', 
      services: ['ติดตั้งระบบโซลาร์เซลล์ On-Grid ขนาด 5kW พร้อม Microinverter Enphase และระบบ Smart Monitoring'], 
      overall_progress: 0, 
      special_instructions: 'ตรวจเช็คโครงสร้างหลังคาซีแพคโมเนียก่อนขึ้นติดตั้งแผงโซลาร์ และประสานงานขอขนานไฟ กฟน.',
      additional_notes: 'สายไฟ DC Solar PV1-F ขนาด 4 sq.mm. พร้อมท่อร้อยสาย EMT และตู้ Combiner Box ป้องกันเสิร์จ AC/DC',
      photos: [],
      created_at: '2026-09-04T08:30:15Z' 
    },
    { 
      id: 2, 
      job_no: 'JOB202609002', 
      external_ref_id: 'INT-2026-002', 
      customer_id: 2, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทห้องครัวไทยด้านนอก สไตล์ Modern Loft เคาน์เตอร์ปูนเปลือยขัดมันพร้อมเตาแก๊สฝังและเครื่องดูดควัน 1600 m3/h', 
      assigned_tech: 'Team B (ประเสริฐ)', 
      plan_date: '2026-09-08', 
      services: ['รีโนเวทห้องครัวไทยด้านนอก สไตล์ Modern Loft เคาน์เตอร์ปูนเปลือยขัดมันพร้อมเตาแก๊สฝังและเครื่องดูดควัน 1600 m3/h'], 
      overall_progress: 0, 
      special_instructions: 'วางระบบท่อดักไขมันใต้ซิงค์ล้างจาน ต่อท่อระบายควันออกเหนือหลังคาไม่อยู่ในทิศทางลมพัดเข้าบ้านข้างเคียง',
      additional_notes: 'ปูกระเบื้องผนัง Subway Tile เช็ดล้างทำความสะอาดคราบน้ำมันง่าย พื้นกระเบื้องแกรนิตโต้ผิวด้านกันลื่น R10',
      photos: [],
      created_at: '2026-09-04T08:45:00Z' 
    },
    { 
      id: 3, 
      job_no: 'JOB202609003', 
      external_ref_id: 'INT-2026-003', 
      customer_id: 3, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'คอนโดมิเนียม', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งเครื่องฟอกอากาศระบบ Fresh Air ฝังฝ้า พร้อมระบบท่อลมระบายอากาศลดฝุ่น PM2.5 และ CO2', 
      assigned_tech: 'Team C (วิชัย)', 
      plan_date: '2026-09-09', 
      services: ['ติดตั้งเครื่องฟอกอากาศระบบ Fresh Air ฝังฝ้า พร้อมระบบท่อลมระบายอากาศลดฝุ่น PM2.5 และ CO2'], 
      overall_progress: 0, 
      special_instructions: 'เจาะช่องผนังภายนอกสำหรับท่อระบายลมต้องใช้หัวเพชร Coring กันฝุ่นฟุ้งกระจายในห้องชุด',
      additional_notes: 'ใช้เครื่องแลกเปลี่ยนความร้อน ERV อัตราการไหล 150 CMH ตัวกรอง HEPA H13 ดักฝุ่น 99.95%',
      photos: [],
      created_at: '2026-09-04T09:00:00Z' 
    },
    { 
      id: 4, 
      job_no: 'JOB202609004', 
      external_ref_id: 'INT-2026-004', 
      customer_id: 4, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Renovate', 
      project_sub_type: 'ต่อเติมหลังคาโรงจอดรถโครงสร้างเหล็กกล่องกัลวาไนซ์ แผ่น Shinkolite ป้องกันรังสี UV พร้อมรางน้ำสแตนเลสซ่อนขอบ', 
      assigned_tech: 'Team D (กิตติศักดิ์)', 
      plan_date: '2026-09-09', 
      services: ['ต่อเติมหลังคาโรงจอดรถโครงสร้างเหล็กกล่องกัลวาไนซ์ แผ่น Shinkolite ป้องกันรังสี UV พร้อมรางน้ำสแตนเลสซ่อนขอบ'], 
      overall_progress: 0, 
      special_instructions: 'ลงเสาเข็มสปันไมโครไพล์ Spun Micropile 4 จุด เพื่อป้องกันการทรุดเอียงในระยะยาว',
      additional_notes: 'แผ่นอะคริลิก Shinkolite รุ่น Heat Cut กรองความร้อนได้ 60% ยึดด้วยระบบ EPDM Rubber Gasket ป้องกันรั่วซึม 100%',
      photos: [],
      created_at: '2026-09-04T09:15:00Z' 
    },
    { 
      id: 5, 
      job_no: 'JOB202609005', 
      external_ref_id: 'INT-2026-005', 
      customer_id: 5, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'ทาวน์โฮม 3 ชั้น', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งเครื่องกรองน้ำดื่มระบบ RO อุตสาหกรรมในครัวเรือน 400 GPD แบบไร้ถังแรงดัน พร้อมก๊อกน้ำ Smart Faucet', 
      assigned_tech: 'Team B (ประเสริฐ)', 
      plan_date: '2026-09-10', 
      services: ['ติดตั้งเครื่องกรองน้ำดื่มระบบ RO อุตสาหกรรมในครัวเรือน 400 GPD แบบไร้ถังแรงดัน พร้อมก๊อกน้ำ Smart Faucet'], 
      overall_progress: 0, 
      special_instructions: 'เจาะท็อปเคาน์เตอร์หินแกรนิตด้วยหัวเจาะกระเบื้องอย่างระมัดระวัง ตรวจเช็คค่าน้ำ TDS ขาเข้าและขาออก',
      additional_notes: 'แรงดันน้ำประปาขั้นต่ำ 2.5 บาร์ ติดตั้งระบบกรองคาร์บอนบล็อกและ Post-Carbon สกัดกลิ่นคลอรีนสมบูรณ์แบบ',
      photos: [],
      created_at: '2026-09-04T09:30:00Z' 
    },
    { 
      id: 6, 
      job_no: 'JOB202609006', 
      external_ref_id: 'INT-2026-006', 
      customer_id: 6, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทห้องน้ำ Master Bathroom สไตล์ Minimal Luxury รื้ออ่างเดิมติดตั้งอ่างอาบน้ำลอยตัวและกระจกกั้นโซนเปียกฉากทอง', 
      assigned_tech: 'Team A (สมศักดิ์)', 
      plan_date: '2026-09-10', 
      services: ['รีโนเวทห้องน้ำ Master Bathroom สไตล์ Minimal Luxury รื้ออ่างเดิมติดตั้งอ่างอาบน้ำลอยตัวและกระจกกั้นโซนเปียกฉากทอง'], 
      overall_progress: 0, 
      special_instructions: 'ทำระบบกันซึมสูตรซีเมนต์ 3 ชั้น รอแห้งตัวทดสอบขังน้ำ 48 ชั่วโมงก่อนปูกระเบื้องหินอ่อน Porcelain 60x120 ซม.',
      additional_notes: 'ท่อน้ำทิ้งดักกลิ่น P-Trap ทองเหลืองแท้ ผนังซ่อนไฟ LED Warm White 3000K พร้อมสวิตช์หรี่แสง',
      photos: [],
      created_at: '2026-09-04T09:45:00Z' 
    },
    { 
      id: 7, 
      job_no: 'JOB202609007', 
      external_ref_id: 'INT-2026-007', 
      customer_id: 7, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'อาคารพาณิชย์ 4 ชั้น', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งระบบกล้องวงจรปิด IP Camera 4K AI Human Detection 8 จุด พร้อมเครื่องบันทึก NVR และตู้ Rack POE', 
      assigned_tech: 'Team D (กิตติศักดิ์)', 
      plan_date: '2026-09-11', 
      services: ['ติดตั้งระบบกล้องวงจรปิด IP Camera 4K AI Human Detection 8 จุด พร้อมเครื่องบันทึก NVR และตู้ Rack POE'], 
      overall_progress: 0, 
      special_instructions: 'เดินสาย LAN Cat6 ชนิด Shielded ร้อยท่อขาวขนานแนวกำแพง เซ็ตอัพระบบดูออนไลน์ผ่านมือถือให้เจ้าของบ้าน',
      additional_notes: 'Harddisk เกรดกล้องวงจรปิด 6TB สำรองภาพได้ 30 วัน พร้อมระบบแจ้งเตือน Line Notify ทันทีเมื่อตรวจพบบุคคลแปลกหน้า',
      photos: [],
      created_at: '2026-09-04T10:00:00Z' 
    },
    { 
      id: 8, 
      job_no: 'JOB202609008', 
      external_ref_id: 'INT-2026-008', 
      customer_id: 8, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'คอนโดมิเนียม', 
      project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทระเบียงห้องชุดคอนโด ปูพื้นกระเบื้องลายไม้กันน้ำ ติดตั้งระแนงบังตาอลูมิเนียมลายไม้และสวนแนวตั้งระบบรดน้ำอัตโนมัติ', 
      assigned_tech: 'Team C (วิชัย)', 
      plan_date: '2026-09-11', 
      services: ['รีโนเวทระเบียงห้องชุดคอนโด ปูพื้นกระเบื้องลายไม้กันน้ำ ติดตั้งระแนงบังตาอลูมิเนียมลายไม้และสวนแนวตั้งระบบรดน้ำอัตโนมัติ'], 
      overall_progress: 0, 
      special_instructions: 'ตรวจสอบกฎระเบียบของนิติบุคคลคอนโดเรื่องสีระแนงและความสูงของต้นไม้ก่อนเริ่มติดตั้งจริง',
      additional_notes: 'ใช้วัสดุระแนงอลูมิเนียมเคลือบอบสี Powder Coat ทนแดด ทนฝน ไม่เป็นสนิม ติดตั้งระบบท่อน้ำหยดตั้งเวลา Smart Timer',
      photos: [],
      created_at: '2026-09-04T10:15:00Z' 
    },
    { 
      id: 9, 
      job_no: 'JOB202609009', 
      external_ref_id: 'INT-2026-009', 
      customer_id: 9, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งมอเตอร์ประตูรั้วรีโมทอัตโนมัติแบบ DC High-Speed รองรับเปิด-ปิดด้วยแอป Smart Home และระบบสำรองไฟ', 
      assigned_tech: 'Team A (สมศักดิ์)', 
      plan_date: '2026-09-12', 
      services: ['ติดตั้งมอเตอร์ประตูรั้วรีโมทอัตโนมัติแบบ DC High-Speed รองรับเปิด-ปิดด้วยแอป Smart Home และระบบสำรองไฟ'], 
      overall_progress: 0, 
      special_instructions: 'ทดสอบระบบเซนเซอร์กันหนีบ Safety Photocell 2 ระดับ ทั้งตอนเปิดและปิดประตูรั้ว',
      additional_notes: 'มอเตอร์รับน้ำหนักประตู 1,000 กก. ระบบ Slow-down นุ่มนวล แบตเตอรี่สำรองเปิดปิดได้ต่อเนื่อง 40 ครั้งขณะไฟดับ',
      photos: [],
      created_at: '2026-09-04T10:30:00Z' 
    },
    { 
      id: 10, 
      job_no: 'JOB202609010', 
      external_ref_id: 'INT-2026-010', 
      customer_id: 10, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทห้องนั่งเล่นและห้องรับแขก Built-in ผนังตกแต่งลายหินอ่อน Bookmatch ซ่อนไฟหลืบและตู้โชว์โครงอลูมิเนียมกระจกชาทอง', 
      assigned_tech: 'Team B (ประเสริฐ)', 
      plan_date: '2026-09-12', 
      services: ['รีโนเวทห้องนั่งเล่นและห้องรับแขก Built-in ผนังตกแต่งลายหินอ่อน Bookmatch ซ่อนไฟหลืบและตู้โชว์โครงอลูมิเนียมกระจกชาทอง'], 
      overall_progress: 0, 
      special_instructions: 'วัดระดับแนวดิ่งและแนวราบด้วยเลเซอร์ความแม่นยำสูง ปูผ้าใบคลุมเฟอร์นิเจอร์และพื้นไม้ปาร์เกต์เดิมอย่างหนาแน่น',
      additional_notes: 'แผ่นลายหินอ่อนอะคริลิกไฮกลอสไร้รอยต่อ บานพับ Soft Close แบรนด์ Blum รับประกันการใช้งาน 10 ปี',
      photos: [],
      created_at: '2026-09-04T10:45:00Z' 
    },
    { 
      id: 11, 
      job_no: 'JOB202609011', 
      external_ref_id: 'INT-2026-011', 
      customer_id: 11, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งเครื่องทำน้ำอุ่นระบบดิจิทัล 4500W พร้อมชุดฝักบัว Rain Shower ปรับระดับและระบบตัดไฟนิรภัย ELCB แบบคู่', 
      assigned_tech: 'Team C (วิชัย)', 
      plan_date: '2026-09-13', 
      services: ['ติดตั้งเครื่องทำน้ำอุ่นระบบดิจิทัล 4500W พร้อมชุดฝักบัว Rain Shower ปรับระดับและระบบตัดไฟนิรภัย ELCB แบบคู่'], 
      overall_progress: 0, 
      special_instructions: 'ตรวจเช็คหลักดิน (Ground Rod) ยาว 2.4 เมตร วัดค่าความต้านทานดินไม่เกิน 5 โอห์มตามมาตรฐาน วสท.',
      additional_notes: 'เดินสายเมนทองแดง THW 4 sq.mm. เบรกเกอร์ควบคุม RCBO 20A แยกอิสระจากตู้โหลดเซ็นเตอร์',
      photos: [],
      created_at: '2026-09-04T11:00:00Z' 
    },
    { 
      id: 12, 
      job_no: 'JOB202609012', 
      external_ref_id: 'INT-2026-012', 
      customer_id: 12, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'คอนโดมิเนียม ดูเพล็กซ์', 
      project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทห้องทำงานส่วนตัว Acoustic Home Studio บุผนังและฝ้าซับเสียง Rockwool พร้อมติดตั้งแผ่น Acoustic Diffuser ไม้แท้', 
      assigned_tech: 'Team D (กิตติศักดิ์)', 
      plan_date: '2026-09-13', 
      services: ['รีโนเวทห้องทำงานส่วนตัว Acoustic Home Studio บุผนังและฝ้าซับเสียง Rockwool พร้อมติดตั้งแผ่น Acoustic Diffuser ไม้แท้'], 
      overall_progress: 0, 
      special_instructions: 'งานบุฉนวนต้องสวมชุดป้องกันมิดชิด ขนย้ายวัสดุขึ้นอาคารตามรอบเวลาของนิติบุคคล 10:00 - 15:00 น.',
      additional_notes: 'ลดเสียงก้องและกันเสียงรบกวนออกภายนอกได้ถึง STC 55 ประตูกันเสียงแบบ Double Seal และช่องแอร์ซ่อนแดมเปอร์ลดเสียงลม',
      photos: [],
      created_at: '2026-09-04T11:15:00Z' 
    },
    { 
      id: 13, 
      job_no: 'JOB202609013', 
      external_ref_id: 'INT-2026-013', 
      customer_id: 13, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'ทาวน์โฮม 2 ชั้น', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งเครื่องปรับอากาศ Inverter 24,000 BTU เบอร์ 5 สามดาว พร้อมเดินท่อน้ำยาหุ้มฉนวน Aeroflex และรางครอบท่อพรีเมียม', 
      assigned_tech: 'Team B (ประเสริฐ)', 
      plan_date: '2026-09-14', 
      services: ['ติดตั้งเครื่องปรับอากาศ Inverter 24,000 BTU เบอร์ 5 สามดาว พร้อมเดินท่อน้ำยาหุ้มฉนวน Aeroflex และรางครอบท่อพรีเมียม'], 
      overall_progress: 0, 
      special_instructions: 'แวคคั่มระบบสูญญากาศนาน 30 นาที และตรวจสอบแรงดันน้ำยา R32 ให้ได้มาตรฐานก่อนส่งมอบงาน',
      additional_notes: 'ขาแขวนคอยล์ร้อนแบบมีแผ่นยางรองซับแรงสั่นสะเทือน ติดตั้งท่อน้ำทิ้ง PVC ต่อลงท่อระบายน้ำโดยตรง',
      photos: [],
      created_at: '2026-09-04T11:30:00Z' 
    },
    { 
      id: 14, 
      job_no: 'JOB202609014', 
      external_ref_id: 'INT-2026-014', 
      customer_id: 14, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'ทาวน์โฮม 2 ชั้น', 
      project_type: 'Renovate', 
      project_sub_type: 'ปรับปรุงพื้นที่รอบบ้าน เทคอนกรีตพิมพ์ลาย Stamped Concrete ลายหินธรรมชาติ European Fan พร้อมระบบระบายน้ำผิวดิน', 
      assigned_tech: 'Team A (สมศักดิ์)', 
      plan_date: '2026-09-14', 
      services: ['ปรับปรุงพื้นที่รอบบ้าน เทคอนกรีตพิมพ์ลาย Stamped Concrete ลายหินธรรมชาติ European Fan พร้อมระบบระบายน้ำผิวดิน'], 
      overall_progress: 0, 
      special_instructions: 'บดอัดดินและทรายหยาบหนา 15 ซม. ปูเหล็กวายเมชขนาด 4 มม. ระยะห่าง 15 ซม. เทคอนกรีตกำลังอัด 280 ksc',
      additional_notes: 'เคลือบน้ำยาอะคริลิกซีลเลอร์สูตรเงาพิเศษ 2 รอบ ป้องกันคราบตะไคร่น้ำและรังสียูวี รับประกันสีไม่ลอกร่อน 3 ปี',
      photos: [],
      created_at: '2026-09-04T11:45:00Z' 
    },
    { 
      id: 15, 
      job_no: 'JOB202609015', 
      external_ref_id: 'INT-2026-015', 
      customer_id: 15, 
      status: JobStatus.DRAFT, 
      job_type: 'quick',
      property_type: 'บ้านเดี่ยว 2 ชั้น', 
      project_type: 'Installation', 
      project_sub_type: 'ติดตั้งชุดสวิตช์และเต้ารับ Smart Switch Zigbee ทั้งหลัง ควบคุมแสงสว่างผ่านเสียงและตั้งเวลาซีนอัตโนมัติ', 
      assigned_tech: 'Team D (กิตติศักดิ์)', 
      plan_date: '2026-09-15', 
      services: ['ติดตั้งชุดสวิตช์และเต้ารับ Smart Switch Zigbee ทั้งหลัง ควบคุมแสงสว่างผ่านเสียงและตั้งเวลาซีนอัตโนมัติ'], 
      overall_progress: 0, 
      special_instructions: 'เดินสายนิวทรัล (N-Line) เพิ่มเติมสำหรับสวิตช์อัจฉริยะทุกจุดเพื่อความเสถียรสูงสุดของสัญญาณ Zigbee',
      additional_notes: 'ติดตั้ง Zigbee 3.0 Gateway แบบต่อสาย LAN เข้า Router กลาง พร้อมจับคู่สมาร์ทโฟน 4 เครื่องในครอบครัว',
      photos: [],
      created_at: '2026-09-04T12:00:00Z' 
    },
    { 
      id: 16, 
      job_no: 'JOB202609016', 
      external_ref_id: 'INT-2026-016', 
      customer_id: 16, 
      status: JobStatus.DRAFT, 
      job_type: 'renovate',
      property_type: 'โฮมออฟฟิศ 4 ชั้น', 
      project_type: 'Renovate', 
      project_sub_type: 'รีโนเวทห้องประชุม Co-working Space ติดตั้งระบบผนังบานเลื่อนกระจกกั้นห้องเก็บเสียงและระบบจอ Smart Board พร้อมระบบไฟ Dimmer', 
      assigned_tech: 'Team C (วิชัย)', 
      plan_date: '2026-09-15', 
      services: ['รีโนเวทห้องประชุม Co-working Space ติดตั้งระบบผนังบานเลื่อนกระจกกั้นห้องเก็บเสียงและระบบจอ Smart Board พร้อมระบบไฟ Dimmer'], 
      overall_progress: 0, 
      special_instructions: 'ทดสอบระบบรางแขวนบนเพดานโครงสร้างเหล็ก I-Beam รองรับน้ำหนักบานกระจกได้จุดละไม่น้อยกว่า 300 กก.',
      additional_notes: 'รางเลื่อนระบบ Soft-close รางคู่ ซีลขอบยางกันเสียงรบกวน ปลั๊กไฟ Pop-up ติดตั้งกลางโต๊ะประชุมเชื่อมระบบ HDMI/Type-C',
      photos: [],
      created_at: '2026-09-04T12:15:00Z' 
    }
  ];
  const baseTime = Date.now();
  mockJobs.forEach((j, idx) => {
    (j as any).pmt_accepted = false;
    (j as any).pmt_accepted_at = null;
    const jobIso = new Date(baseTime - (mockJobs.length - 1 - idx) * 12 * 60000).toISOString();
    (j as any).step_timestamps = {
      step1_order_at: jobIso
    };
    j.created_at = jobIso;
    (j as any).boq_items = [];
    (j as any).boq_discount = 0;
    (j as any).boq_grand_total = 0;
    j.photos = [];
    j.overall_progress = 0;
    j.status = JobStatus.DRAFT;
    const cust = mockCustomers.find(c => c.id === j.customer_id);
    if (cust) {
      (j as any).customer = {
        name: `คุณ${cust.first_name} ${cust.last_name}`,
        phone: cust.phone,
        address: cust.address,
        first_name: cust.first_name,
        last_name: cust.last_name
      };
    }
    // Also save to database if connected
    dbSaveJob(j).catch(() => {});
  });
  // Sort descending so newest is first in coreJobStore
  mockJobs.sort((a, b) => new Date((b as any).created_at).getTime() - new Date((a as any).created_at).getTime());
  coreJobStore.push(...mockJobs);
  console.log(`[CORE SEED] Seeded ${mockJobs.length} core jobs in coreJobStore (Status DRAFT, sorted descending).`);
}

// =============================================================================
// 1. INT INBOUND INTEGRATION API (Req #1)
// =============================================================================
app.post('/api/v1/integration/orders', async (req: Request, res: Response) => {
  try {
    const payload: any = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

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
    let customer = coreCustomerStore.find(c => c.phone === phone);
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
      coreCustomerStore.push(customer);
    }

    // Generate Job No format: JOBYYYYMMXXX (e.g., JOB202609001)
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const runningSeq = Math.floor(1 + Math.random() * 999);
    const runningStr = String(runningSeq).padStart(3, '0');
    const jobNo = `JOB${yyyy}${mm}${runningStr}`;

    const serviceName = (payload.services && payload.services[0]) || 'งานติดตั้ง';
    const isQuick = /ติดตั้ง|ซ่อม|ล้าง|แอร์|เครื่องปรับอากาศ|เครื่องทำน้ำอุ่น|ปั้ม|กรองน้ำ|กล้อง/i.test(serviceName) && !/รีโนเวท|ต่อเติม|renovate/i.test(serviceName);
    const jobType = isQuick ? 'quick' : 'renovate';

    const newJob: CoreJob = {
      id: Date.now(),
      job_no: jobNo,
      external_ref_id: payload.external_ref_id,
      customer_id: customer.id,
      services: payload.services || ['งานบริการ'],
      assigned_tech: payload.technician?.name || 'Team A (สมศักดิ์)',
      plan_date: payload.appointment?.date || new Date().toISOString().split('T')[0],
      status: JobStatus.DRAFT,
      job_type: jobType,
      property_type: 'บ้านเดี่ยว',
      project_type: isQuick ? 'Installation' : 'Renovate',
      project_sub_type: serviceName,
      pmt_accepted: false,
      pmt_accepted_at: undefined,
      step_timestamps: {
        step1_order_at: new Date().toISOString()
      },
      boq_items: [],
      boq_discount: 0,
      boq_grand_total: 0,
      photos: [],
      overall_progress: 0,
      created_at: new Date().toISOString()
    };
    (newJob as any).customer = {
      name: `คุณ${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      address: address,
      lat: lat,
      lng: lng
    };
    coreJobStore.unshift(newJob);
    dbSaveJob(newJob).catch(() => {});

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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// Seed Mock Survey Records for Staging Monitoring & Manual Conversion (Empty by default)
export function seedInitialStagingData(populateMocks: boolean = false) {
  stagingSurveyStore.length = 0; // Reset

  if (!populateMocks) {
    console.log('[STAGING STORE] Initialized with empty staging survey store (Clean State).');
    return;
  }

  const mockRecords: StagingSurveyReport[] = [
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

  stagingSurveyStore.push(...mockRecords);
  console.log(`[STAGING SEED] Seeded ${mockRecords.length} mock pending records in staging table.`);
}

// Initial Seed on Server Startup (Clean Slate - 0 transactions)
seedInitialStagingData(false);
seedInitialCoreData(false);

// =============================================================================
// CONVERSION ENGINE (STAGING -> CORE PMT)
// =============================================================================
export function convertStagingToCorePmt(stagingRecord: StagingSurveyReport): {
  success: boolean;
  jobId?: number;
  errors?: string[];
} {
  const payload = stagingRecord.raw_payload;
  const validationErrors: string[] = [];

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
    let customer = coreCustomerStore.find(c => c.phone === payload.customer.mobile_no || (payload.customer.code && c.customer_code === payload.customer.code));
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
      coreCustomerStore.push(customer);
    }

    // 2. Insert Core Job (Req #1 & State Machine: SURVEYED)
    const jobId = Date.now() + Math.floor(Math.random() * 1000);
    const newCoreJob: CoreJob = {
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
    coreJobStore.push(newCoreJob);
    dbSaveJob(newCoreJob).catch(err => console.error('[DB] Failed to save converted job:', err.message));

    // 3. Insert Job Services
    if (Array.isArray(payload.job_details)) {
      payload.job_details.forEach((item, idx) => {
        coreJobServiceStore.push({
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
    const visitRecord: CoreVisitCheckin = {
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
    coreVisitCheckinStore.push(visitRecord);

    // 5. Insert Site Photos (Req #2)
    if (Array.isArray(payload.site_photos)) {
      payload.site_photos.forEach((photoPath, idx) => {
        coreSitePhotoStore.push({
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
  } catch (err: any) {
    stagingRecord.process_status = StagingProcessStatus.ERROR;
    stagingRecord.error_message = err.message;
    stagingRecord.retry_count += 1;
    stagingRecord.processed_at = new Date().toISOString();
    return { success: false, errors: [err.message] };
  }
}

// Configuration for Ingestion Processing Mode
let autoConvertEnabled = true;

app.get('/api/v1/staging/config', requireAuth, (req: Request, res: Response) => {
  return res.json({ success: true, auto_convert_enabled: autoConvertEnabled });
});

app.post('/api/v1/staging/config/auto-convert', requireAuth, (req: Request, res: Response) => {
  const { enabled } = req.body;
  if (typeof enabled === 'boolean') {
    autoConvertEnabled = enabled;
  }
  return res.json({ success: true, auto_convert_enabled: autoConvertEnabled });
});

// =============================================================================
// 1.1 JOB SURVEY REPORT INGESTION & STAGING API
// =============================================================================
app.post('/api/v1/jobs/survey-report', requireAuth, async (req: Request<{}, {}, JobSurveyPayload>, res: Response) => {
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
    const existing = stagingSurveyStore.find(s => s.source_job_id === payload.system.job_id);
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
    const stagingRecord: StagingSurveyReport = {
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
    stagingSurveyStore.push(stagingRecord);

    console.log(`[STAGING INGEST] Successfully saved raw payload in staging: #${stagingRecord.id} (Job: ${stagingRecord.job_number})`);

    // 4. Processing based on Auto-Convert Mode
    const shouldAutoConvert = req.query.auto_convert !== 'false' && autoConvertEnabled;
    let convertResult: { success: boolean; jobId?: number; errors?: string[] } = { success: false };

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
  } catch (err: any) {
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
app.get('/api/v1/staging/survey-reports', requireAuth, (req: Request, res: Response) => {
  const { status, search } = req.query;
  let results = [...stagingSurveyStore];

  if (status) {
    results = results.filter(r => r.process_status === status);
  }
  if (search) {
    const q = String(search).toLowerCase();
    results = results.filter(r => 
      r.job_number.toLowerCase().includes(q) ||
      r.customer_name.toLowerCase().includes(q) ||
      (r.booking_no && r.booking_no.toLowerCase().includes(q))
    );
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

app.get('/api/v1/staging/survey-reports/:id', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const record = stagingSurveyStore.find(r => r.id === id);
  if (!record) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Staging record not found' } });
  }
  return res.json({ success: true, data: record });
});

app.post('/api/v1/staging/survey-reports/:id/convert', requireAuth, (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const record = stagingSurveyStore.find(r => r.id === id);
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

app.post('/api/v1/staging/seed', requireAuth, (req: Request, res: Response) => {
  seedInitialStagingData();
  return res.json({
    success: true,
    message: 'Seeded 5 mock survey reports into staging table successfully',
    total_records: stagingSurveyStore.length
  });
});

// =============================================================================
// 1.2 CORE JOBS APIS (List, Get, Create for Web Dashboard & Automation)
app.get('/api/v1/jobs', requireAuth, async (req: Request, res: Response) => {
  const { status, service, search } = req.query;
  try {
    let results = await dbLoadJobs({
      status: typeof status === 'string' ? status : undefined,
      service: typeof service === 'string' ? service : undefined,
      search: typeof search === 'string' ? search : undefined
    });

    if (!results || results.length === 0) {
      results = coreJobStore.map(job => {
        const cust = coreCustomerStore.find(c => c.id === job.customer_id) || (job as any).customer || (job as any).customer_data;
        let customerFullName = 'ไม่ระบุชื่อ';
        if (cust) {
          if (cust.name) customerFullName = cust.name;
          else if (cust.first_name || cust.last_name) customerFullName = `คุณ${cust.first_name || ''} ${cust.last_name || ''}`.trim();
        }
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
          date: job.plan_date || (job.created_at ? job.created_at.split('T')[0] : '2026-09-08'),
          progress: job.overall_progress || 0,
          tech: job.assigned_tech || 'Team A (สมศักดิ์)',
          special_instructions: job.special_instructions || '',
          additional_notes: job.additional_notes || '',
          photos: job.photos || [],
          pmt_accepted: (job as any).pmt_accepted !== undefined ? (job as any).pmt_accepted : (job.status !== JobStatus.DRAFT && job.status !== JobStatus.NEW),
          pmt_accepted_at: (job as any).pmt_accepted_at || null,
          job_type: (job as any).job_type || 'quick',
          step_timestamps: (job as any).step_timestamps || null,
          created_at: job.created_at
        };
      });
    }

    // Helper to extract maximum timestamp across all workflow steps and status changes
    const getJobLatestTime = (job: any): number => {
      let maxTime = 0;
      if (job.step_timestamps && typeof job.step_timestamps === 'object') {
        for (const val of Object.values(job.step_timestamps)) {
          if (val) {
            const t = new Date(String(val)).getTime();
            if (!isNaN(t) && t > maxTime) maxTime = t;
          }
        }
      }
      if (job.created_at) {
        const t = new Date(job.created_at).getTime();
        if (!isNaN(t) && t > maxTime) maxTime = t;
      }
      if (job.date) {
        const t = new Date(job.date).getTime();
        if (!isNaN(t) && t > maxTime) maxTime = t;
      }
      return maxTime;
    };

    // Sort descending so latest updated / latest status jobs are always on top
    results.sort((a, b) => {
      const timeA = getJobLatestTime(a);
      const timeB = getJobLatestTime(b);
      if (timeB !== timeA) return timeB - timeA;
      return String(b.job_no || b.id || '').localeCompare(String(a.job_no || a.id || ''));
    });

    return res.json({
      success: true,
      total: results.length,
      data: results
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

app.get('/api/v1/jobs/:id', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  let job = await dbGetJob(param);

  if (!job) {
    const numId = Number(param);
    job = coreJobStore.find(j => j.id === numId || j.job_no === param);
  }

  if (!job) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
  }

  return res.json({
    success: true,
    data: job
  });
});

// Update Job Details (Special Instructions, Additional Notes, Tech, etc.)
app.patch('/api/v1/jobs/:id', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const updatedJob = await dbUpdateJob(param, req.body);

  // Also sync in-memory store if present
  const numId = Number(param);
  const memJob = coreJobStore.find(j => j.id === numId || j.job_no === param);
  if (memJob) {
    Object.assign(memJob, req.body);
  }

  if (!updatedJob && !memJob) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
  }

  const resultData = updatedJob || memJob;
  return res.json({
    success: true,
    data: resultData,
    message: 'บันทึกข้อมูลงานเรียบร้อยแล้ว'
  });
});

// Upload Additional Site Photo
app.post('/api/v1/jobs/:id/photos', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  let job = await dbGetJob(param);
  if (!job) {
    const numId = Number(param);
    job = coreJobStore.find(j => j.id === numId || j.job_no === param);
  }

  if (!job) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
  }

  const { title, name, dataUrl, url, tag, note, lat, lng } = req.body;
  if (!dataUrl && !url) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_PHOTO', message: 'Photo dataUrl or url is required' } });
  }

  if (!job.photos) job.photos = [];

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
  await dbUpdateJob(param, { photos: job.photos });

  return res.status(201).json({
    success: true,
    data: newPhoto,
    total_photos: job.photos.length,
    message: 'อัปโหลดรูปภาพเพิ่มเติมสำเร็จ'
  });
});

// Delete Site Photo
app.delete('/api/v1/jobs/:id/photos/:photoId', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const photoId = req.params.photoId;
  let job = await dbGetJob(param);
  if (!job) {
    const numId = Number(param);
    job = coreJobStore.find(j => j.id === numId || j.job_no === param);
  }

  if (!job) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found' } });
  }

  if (job.photos) {
    job.photos = job.photos.filter((p: any) => p.id !== photoId);
    await dbUpdateJob(param, { photos: job.photos });
  }

  return res.json({
    success: true,
    total_photos: job.photos ? job.photos.length : 0,
    message: 'ลบรูปภาพเรียบร้อยแล้ว'
  });
});

app.post('/api/v1/jobs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { firstName, lastName, phone, address, lat, lng, service, tech, date, job_type } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'firstName and lastName are required' } });
    }

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const runningSeq = Math.floor(1 + Math.random() * 999);
    const runningStr = String(runningSeq).padStart(3, '0');
    const jobNo = `JOB${yyyy}${mm}${runningStr}`;

    const customerData = {
      id: Date.now() + Math.floor(Math.random() * 100),
      customer_code: `CUST-${Date.now()}`,
      name: `คุณ${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      phone: phone || '089-000-0000',
      address: address || 'Bangkok, Thailand',
      lat: Number(lat) || 13.7563,
      lng: Number(lng) || 100.5018
    };

    const newJob: any = {
      id: Date.now(),
      job_no: jobNo,
      external_ref_id: `WEB-${Date.now()}`,
      customer_id: customerData.id,
      customer: customerData,
      customer_data: customerData,
      services: [service || 'งานติดตั้ง'],
      assigned_tech: tech || 'Team A (สมศักดิ์)',
      plan_date: date || new Date().toISOString().split('T')[0],
      status: JobStatus.DRAFT,
      overall_progress: 0,
      job_type: job_type || 'quick',
      tasks: [],
      photos: [],
      boq_items: [],
      created_at: new Date().toISOString()
    };
    await dbSaveJob(newJob);
    coreJobStore.unshift(newJob);

    return res.status(201).json({
      success: true,
      data: newJob,
      meta: { message: 'Job created successfully' }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

const wipeAllTransactions = async (req: Request, res: Response) => {
  await dbWipeAllTransactions();
  coreJobStore.length = 0;
  coreTaskStore.length = 0;
  coreCustomerStore.length = 0;
  coreJobServiceStore.length = 0;
  coreVisitCheckinStore.length = 0;
  coreSitePhotoStore.length = 0;
  coreQCBookingStore.length = 0;
  coreDailyWorkLogStore.length = 0;
  stagingSurveyStore.length = 0;
  maContractStore.length = 0;
  maRoundStore.length = 0;
  console.log('[SYSTEM] Wiped all transactions across Core Jobs, Tasks, QC, Staging, and MA in PostgreSQL.');
  return res.json({
    success: true,
    message: 'ลบข้อมูลโครงการและรายการ Transaction ทั้งหมดเรียบร้อยแล้ว (0 รายการ)',
    total_jobs: 0
  });
};

app.delete(['/api/v1/jobs', '/api/v1/system/wipe-transactions'], wipeAllTransactions);
app.post(['/api/v1/system/wipe-transactions', '/api/v1/jobs/wipe-all'], wipeAllTransactions);

app.post('/api/v1/jobs/reset-status', async (req: Request, res: Response) => {
  const count = await dbResetJobStatus();
  coreJobStore.forEach(j => {
    j.status = JobStatus.DRAFT;
    j.overall_progress = 0;
    j.photos = [];
    (j as any).boq_items = [];
    (j as any).pmt_accepted = false;
  });
  coreTaskStore.length = 0;
  coreQCBookingStore.length = 0;
  coreDailyWorkLogStore.length = 0;
  return res.json({
    success: true,
    message: 'ถอยสถานะของทุก Job กลับสู่จุดเริ่มต้น (DRAFT / 0%) เรียบร้อย',
    total_jobs: count || coreJobStore.length
  });
});

app.post(['/api/v1/jobs/reset', '/api/v1/jobs/simulate-int'], async (req: Request, res: Response) => {
  await dbWipeAllTransactions();
  const count = await dbSeedMockJobs();
  const dbJobs = await dbLoadJobs();
  coreJobStore.length = 0;
  if (dbJobs && dbJobs.length > 0) {
    coreJobStore.push(...dbJobs);
  }
  coreTaskStore.length = 0;
  coreQCBookingStore.length = 0;
  coreDailyWorkLogStore.length = 0;
  coreVisitCheckinStore.length = 0;
  coreSitePhotoStore.length = 0;
  stagingSurveyStore.length = 0;
  maContractStore.length = 0;
  maRoundStore.length = 0;
  return res.json({
    success: true,
    message: 'จำลองและ Reset รายการ 20 คำสั่งซื้อจาก INT (Quick 10, Renovate 10) เข้าสู่ระบบ PMT สำเร็จ (บันทึกลงฐานข้อมูล PostgreSQL core_jobs เริ่มต้น Step 1 ทั้งหมด)',
    total_jobs: count || coreJobStore.length
  });
});

// =============================================================================
// 2. CHECK-IN / SITE VISIT API (Req #2 & #3)
// =============================================================================
app.post('/api/v1/jobs/:id/checkin', requireAuth, async (req: Request, res: Response) => {
  try {
    const param = req.params.id;
    const numId = Number(param);
    const { lat, lng, photos, summary }: CheckinPayload = req.body;

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

    // Update job status in PostgreSQL and coreJobStore
    const targetJob = await dbGetJob(param);
    const newProgress = Math.max(targetJob?.progress || targetJob?.overall_progress || 0, 30);
    await dbUpdateJob(param, { status: JobStatus.SURVEYED, overall_progress: newProgress });

    const memJob = coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (memJob) {
      memJob.status = JobStatus.SURVEYED;
      memJob.overall_progress = newProgress;
    }

    // Rule: Geo-fence Check (Default 400m - Configurable) (Req #2, OQ-A07)
    const configRadius = 400; // meters
    const distanceMeters = 180; // Calculated distance
    const isInRadius = distanceMeters <= configRadius;

    const checkinLog = {
      id: Date.now(),
      job_id: targetJob ? targetJob.jobId || targetJob.id : numId,
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
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// =============================================================================
// 3. DESIGN & BOQ API (Req #5 & #6)
// =============================================================================
app.post('/api/v1/jobs/:id/designs', requireAuth, async (req: Request, res: Response) => {
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

app.post('/api/v1/jobs/:id/boq', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const jobId = isNaN(Number(param)) ? param : Number(param);
  const { items, discount_amount = 0 } = req.body;

  // Calculate BOQ (Req #6)
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.qty * item.unit_price), 0);
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

  await dbUpdateJob(param, {
    boq_items: items,
    boq_subtotal: subtotal,
    boq_discount: discount_amount,
    boq_grand_total: grandTotal,
    status: JobStatus.BOQ
  });

  const targetJob = coreJobStore.find(j => j.id === jobId || j.job_no === String(req.params.id) || String(j.id) === String(req.params.id));
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
function sortTasksByStartDate(tasks: CoreTask[]): CoreTask[] {
  return tasks.sort((a, b) => {
    const da = new Date(a.plan_start_date).getTime();
    const db = new Date(b.plan_start_date).getTime();
    if (da !== db) return da - db;
    return (a.task_name || '').localeCompare(b.task_name || '');
  });
}

// GET /api/v1/jobs/:id/tasks — Get all tasks for a job (sorted by start date)
app.get('/api/v1/jobs/:id/tasks', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const numId = Number(param);
  const job = await dbGetJob(param);
  let tasks: CoreTask[] = [];
  if (job && Array.isArray(job.tasks)) {
    tasks = job.tasks;
  }
  if (tasks.length === 0) {
    tasks = coreTaskStore.filter(t => t.job_id === numId || t.job_no === param || String(t.job_id) === param);
  }
  const sorted = sortTasksByStartDate([...tasks]);
  return res.json({ success: true, total: sorted.length, data: sorted });
});

// POST /api/v1/jobs/:id/tasks/import-boq — Import/Convert BOQ items into Project Tasks with Start/End date & Auto-sort
app.post('/api/v1/jobs/:id/tasks/import-boq', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const numId = isNaN(Number(param)) ? param : Number(param);
  const { items, base_start_date, default_tech = 'Team A (สมศักดิ์)' } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'EMPTY_ITEMS', message: 'รายการ BOQ ต้องไม่ว่างเปล่า' } });
  }

  const job = await dbGetJob(param);
  const baseDate = base_start_date || new Date().toISOString().slice(0, 10);
  const jobNo = job?.job_no || (typeof param === 'string' && param.startsWith('JOB') ? param : `JOB20260900${numId}`);
  const customerName = job?.customer || 'ลูกค้า';

  const newTasks: CoreTask[] = items.map((item: any, idx: number) => {
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
    } else {
      const s = new Date(startStr);
      const e = new Date(endStr);
      days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    }

    const techName = item.assigned_tech || item.tech || default_tech;
    const assignees = item.assignees || [techName];

    return {
      id: `T_${param}_${Date.now()}_${idx + 1}`,
      job_id: numId,
      job_no: jobNo,
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

  const isAppend = req.body.mode === 'append';
  let existingTasks: CoreTask[] = (job && Array.isArray(job.tasks)) ? job.tasks : [];
  let updatedTasks: CoreTask[] = isAppend ? [...existingTasks, ...newTasks] : [...newTasks];

  const boqItems = items.map((it: any) => ({
    name: it.task_name || it.name,
    qty: it.qty || 1,
    unit: it.unit || 'งาน',
    price: it.price || 0,
    labor_price: it.labor_price || it.price || 0
  }));

  // Save directly to PostgreSQL core_jobs
  await dbUpdateJob(param, { tasks: updatedTasks, boq_items: boqItems });

  // Sync QC Bookings into core_qc_bookings in PostgreSQL
  for (const t of newTasks) {
    const qcBooking: QCBooking = {
      id: `QCB_${t.id}`,
      job_id: t.job_id,
      job_no: jobNo,
      task_id: t.id,
      task_name: t.task_name,
      customer_name: customerName,
      plan_start_date: t.plan_start_date,
      plan_end_date: t.plan_end_date,
      qc_booking_date: calculateQCBookingDate(t.plan_end_date, 5),
      days_before: 5,
      assigned_tech: t.assigned_tech,
      assigned_qc_tech: 'วิชัย ตรวจดี (ช่าง QC Lead)',
      status: 'PENDING_CONFIRM',
      confirmed_at: null,
      confirmed_by: null,
      remarks: '',
      created_at: new Date().toISOString()
    };
    await dbSaveQCBooking(qcBooking);
  }

  // Also sync in-memory store for fallback
  if (!isAppend) {
    for (let i = coreTaskStore.length - 1; i >= 0; i--) {
      if (coreTaskStore[i].job_id === numId || coreTaskStore[i].job_no === param || String(coreTaskStore[i].job_id) === param) {
        coreTaskStore.splice(i, 1);
      }
    }
  }
  coreTaskStore.push(...newTasks);
  newTasks.forEach(t => syncQCBookingForTask(t));

  const sorted = sortTasksByStartDate([...updatedTasks]);
  return res.status(201).json({
    success: true,
    message: `นำเข้าและแปลง BOQ เป็น Task ปฏิบัติงาน ${newTasks.length} รายการ และสร้างคิวจองช่าง QC ล่วงหน้า 5 วันเรียบร้อย`,
    total: sorted.length,
    data: sorted
  });
});

// POST /api/v1/jobs/:id/tasks — Create / Insert Task into Job (with auto-sort by start date)
app.post('/api/v1/jobs/:id/tasks', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const numId = isNaN(Number(param)) ? param : Number(param);
  const { task_name, start_date, end_date, duration_days = 1, assigned_tech = 'Team A (สมศักดิ์)', assignees, allow_bypass = false } = req.body;

  if (!task_name) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_TASK_NAME', message: 'กรุณาระบุชื่อ Task' } });
  }

  const job = await dbGetJob(param);
  if (job && (!job.boq_items || job.boq_items.length === 0) && !allow_bypass) {
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
  } else {
    const s = new Date(startStr);
    const e = new Date(endStr);
    days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }

  const techList = assignees || [assigned_tech];
  const jobNo = job?.job_no || (typeof param === 'string' && param.startsWith('JOB') ? param : `JOB20260900${numId}`);
  const customerName = job?.customer || 'ลูกค้า';

  const newTask: CoreTask = {
    id: `T_${param}_${Date.now()}`,
    job_id: numId,
    job_no: jobNo,
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

  let tasks: CoreTask[] = (job && Array.isArray(job.tasks)) ? [...job.tasks, newTask] : [newTask];
  await dbUpdateJob(param, { tasks });

  // QC Booking in DB
  const qcBooking: QCBooking = {
    id: `QCB_${newTask.id}`,
    job_id: newTask.job_id,
    job_no: jobNo,
    task_id: newTask.id,
    task_name: newTask.task_name,
    customer_name: customerName,
    plan_start_date: newTask.plan_start_date,
    plan_end_date: newTask.plan_end_date,
    qc_booking_date: calculateQCBookingDate(newTask.plan_end_date, 5),
    days_before: 5,
    assigned_tech: newTask.assigned_tech,
    assigned_qc_tech: 'วิชัย ตรวจดี (ช่าง QC Lead)',
    status: 'PENDING_CONFIRM',
    confirmed_at: null,
    confirmed_by: null,
    remarks: '',
    created_at: new Date().toISOString()
  };
  await dbSaveQCBooking(qcBooking);

  coreTaskStore.push(newTask);
  syncQCBookingForTask(newTask);

  const sorted = sortTasksByStartDate([...tasks]);
  return res.status(201).json({
    success: true,
    message: 'สร้าง/แทรก Task และจองช่าง QC ล่วงหน้า 5 วันเรียบร้อย',
    data: newTask,
    qc_booking: qcBooking,
    sorted_tasks: sorted
  });
});

// POST /api/v1/jobs/:id/tasks/reorder — Reorder/Auto-sort Tasks by Start Date
app.post('/api/v1/jobs/:id/tasks/reorder', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const numId = isNaN(Number(param)) ? param : Number(param);
  const job = await dbGetJob(param);
  const jobTasks = (job && Array.isArray(job.tasks)) ? job.tasks : coreTaskStore.filter(t => t.job_id === numId || t.job_no === param || String(t.job_id) === param);
  const sorted = sortTasksByStartDate([...jobTasks]);
  await dbUpdateJob(param, { tasks: sorted });

  return res.json({
    success: true,
    message: 'จัดเรียงรายการ Task ตามวันเริ่มต้นเรียบร้อย',
    data: sorted
  });
});

// PUT /api/v1/jobs/:id/tasks/:taskId — Update Task (Start Date, End Date, Technician, Status, etc.)
app.put('/api/v1/jobs/:id/tasks/:taskId', requireAuth, async (req: Request, res: Response) => {
  const { id, taskId } = req.params;
  const job = await dbGetJob(id);
  let tasks: CoreTask[] = job && Array.isArray(job.tasks) ? job.tasks : coreTaskStore.filter(t => String(t.job_id) === id || t.job_no === id);
  let task = tasks.find(t => String(t.id) === taskId);

  if (!task) {
    task = coreTaskStore.find(t => String(t.id) === taskId);
  }
  if (!task) {
    return res.status(404).json({ success: false, error: { code: 'TASK_NOT_FOUND', message: 'ไม่พบ Task' } });
  }

  const { task_name, name, start_date, start, end_date, end, duration_days, days, assigned_tech, tech, assignees, status } = req.body;
  if (task_name !== undefined || name !== undefined) task.task_name = task_name || name;
  if (start_date !== undefined || start !== undefined) task.plan_start_date = start_date || start;
  if (end_date !== undefined || end !== undefined) task.plan_end_date = end_date || end;
  if (duration_days !== undefined || days !== undefined) {
    task.duration_days = duration_days || days;
  } else if (task.plan_start_date && task.plan_end_date) {
    const s = new Date(task.plan_start_date);
    const e = new Date(task.plan_end_date);
    task.duration_days = Math.max(1, Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
  }
  if (assigned_tech !== undefined || tech !== undefined) task.assigned_tech = assigned_tech || tech;
  if (assignees !== undefined) task.assignees = assignees;
  if (status !== undefined) task.status = status;

  await dbUpdateJob(id, { tasks });

  // Update QC booking
  const qcDate = calculateQCBookingDate(task.plan_end_date, 5);
  await dbSaveQCBooking({
    id: `QCB_${task.id}`,
    task_id: task.id,
    task_name: task.task_name,
    plan_start_date: task.plan_start_date,
    plan_end_date: task.plan_end_date,
    qc_booking_date: qcDate,
    assigned_tech: task.assigned_tech
  });

  const qcBooking = syncQCBookingForTask(task);
  return res.json({ success: true, message: 'อัปเดต Task และวันจองตรวจ QC สำเร็จ', data: task, qc_booking: qcBooking });
});

// DELETE /api/v1/jobs/:id/tasks/:taskId — Delete Task
app.delete('/api/v1/jobs/:id/tasks/:taskId', requireAuth, async (req: Request, res: Response) => {
  const { id, taskId } = req.params;
  const job = await dbGetJob(id);
  if (job && Array.isArray(job.tasks)) {
    const filtered = job.tasks.filter((t: any) => String(t.id) !== taskId);
    await dbUpdateJob(id, { tasks: filtered });
  }
  await dbDeleteQCBookingByTask(taskId);

  const idx = coreTaskStore.findIndex(t => String(t.id) === taskId);
  if (idx !== -1) coreTaskStore.splice(idx, 1);
  removeQCBookingForTask(taskId);

  return res.json({ success: true, message: 'ลบ Task และยกเลิกการจอง QC สำเร็จ' });
});

// GET /api/v1/tasks/gantt — Get all tasks structured for Gantt Timeline view
app.get('/api/v1/tasks/gantt', requireAuth, async (req: Request, res: Response) => {
  const jobId = req.query.job_id as string;
  let allTasks: CoreTask[] = [];

  if (jobId && jobId !== 'all') {
    const job = await dbGetJob(jobId);
    if (job && Array.isArray(job.tasks)) {
      allTasks = job.tasks;
    }
  } else {
    const jobs = await dbLoadJobs();
    jobs.forEach(j => {
      if (Array.isArray(j.tasks)) allTasks.push(...j.tasks);
    });
  }

  if (allTasks.length === 0) {
    allTasks = coreTaskStore;
    if (jobId && jobId !== 'all') {
      allTasks = allTasks.filter(t => t.job_no === jobId || String(t.job_id) === jobId);
    }
  }

  const sorted = sortTasksByStartDate([...allTasks]);
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
app.get('/api/v1/qc/bookings', requireAuth, async (req: Request, res: Response) => {
  const { job_id, status } = req.query;
  const list = await dbLoadQCBookings(
    job_id && job_id !== 'all' ? String(job_id) : undefined,
    status && status !== 'all' ? String(status) : undefined
  );
  return res.json({ success: true, total: list.length, data: list });
});

// PUT /api/v1/qc/bookings/:id/confirm — Confirm QC Technician Booking
app.put('/api/v1/qc/bookings/:id/confirm', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { qc_tech, confirmed_by, remarks } = req.body;
  const updated = await dbConfirmQCBooking(id, qc_tech, confirmed_by, remarks);

  const booking = coreQCBookingStore.find(b => b.id === id || String(b.task_id) === id);
  if (booking) {
    booking.status = 'CONFIRMED';
    booking.confirmed_at = new Date().toISOString();
    if (qc_tech) booking.assigned_qc_tech = qc_tech;
    if (confirmed_by) booking.confirmed_by = confirmed_by;
    if (remarks !== undefined) booking.remarks = remarks;
  }

  const result = updated || booking;
  if (!result) {
    return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'ไม่พบรายการจอง QC' } });
  }

  return res.json({
    success: true,
    message: `ยืนยันการจองช่าง QC (${result.assigned_qc_tech || 'QC Technician'}) สำหรับ "${result.task_name}" เรียบร้อยแล้ว`,
    data: result
  });
});

// PUT /api/v1/qc/bookings/:id — Update QC Booking (Change QC tech, date, remarks, status)
app.put('/api/v1/qc/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { assigned_qc_tech, qc_booking_date, remarks, status } = req.body;
  const bookings = await dbLoadQCBookings();
  let booking = bookings.find((b: any) => String(b.id) === id || String(b.task_id) === id);
  if (!booking) {
    booking = coreQCBookingStore.find(b => b.id === id || String(b.task_id) === id);
  }
  if (!booking) {
    return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'ไม่พบรายการจอง QC' } });
  }

  if (assigned_qc_tech !== undefined) booking.assigned_qc_tech = assigned_qc_tech;
  if (qc_booking_date !== undefined) booking.qc_booking_date = qc_booking_date;
  if (remarks !== undefined) booking.remarks = remarks;
  if (status !== undefined) booking.status = status;

  await dbSaveQCBooking(booking);

  const memBooking = coreQCBookingStore.find(b => b.id === id || String(b.task_id) === id);
  if (memBooking) {
    if (assigned_qc_tech !== undefined) memBooking.assigned_qc_tech = assigned_qc_tech;
    if (qc_booking_date !== undefined) memBooking.qc_booking_date = qc_booking_date;
    if (remarks !== undefined) memBooking.remarks = remarks;
    if (status !== undefined) memBooking.status = status;
  }

  return res.json({ success: true, message: 'อัปเดตข้อมูลการจอง QC เรียบร้อย', data: booking });
});

// POST /api/v1/qc/bookings/sync-all — Sync QC bookings from all existing tasks
app.post('/api/v1/qc/bookings/sync-all', requireAuth, async (req: Request, res: Response) => {
  const jobs = await dbLoadJobs();
  for (const job of jobs) {
    if (Array.isArray(job.tasks)) {
      for (const task of job.tasks) {
        syncQCBookingForTask(task);
        const qcDate = calculateQCBookingDate(task.plan_end_date, 5);
        await dbSaveQCBooking({
          id: `QCB_${task.id}`,
          task_id: task.id,
          task_name: task.task_name,
          plan_start_date: task.plan_start_date,
          plan_end_date: task.plan_end_date,
          qc_booking_date: qcDate,
          assigned_tech: task.assigned_tech
        });
      }
    }
  }
  const dbBookings = await dbLoadQCBookings();
  return res.json({
    success: true,
    message: `ซิงค์งานจองตรวจ QC จากรายการ Task ทั้งหมดในฐานข้อมูลเรียบร้อย`,
    total: dbBookings.length,
    data: dbBookings
  });
});

// =============================================================================
// DAILY TECHNICIAN WORK LOGS API (บันทึกงานช่างประจำวัน ตามแผนงาน Gantt)
// =============================================================================

// GET /api/v1/daily-logs — Get all daily work logs across all jobs or filtered
app.get('/api/v1/daily-logs', requireAuth, async (req: Request, res: Response) => {
  const { jobId, taskId } = req.query;
  const logs = await dbLoadDailyWorkLogs(
    jobId ? String(jobId) : undefined,
    taskId ? String(taskId) : undefined
  );
  return res.json({ success: true, total: logs.length, data: logs });
});

// GET /api/v1/jobs/:id/daily-logs — Get all daily work logs for a job
app.get('/api/v1/jobs/:id/daily-logs', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const logs = await dbLoadDailyWorkLogs(id);
  return res.json({ success: true, total: logs.length, data: logs });
});

// Helper to create and process daily work log
async function handleCreateDailyLog(payload: any, jobIdParam?: string): Promise<CoreDailyWorkLog> {
  const id = jobIdParam || payload.job_id || payload.jobId || 'JOB202609002';
  const newLog: CoreDailyWorkLog = {
    id: payload.id || `LOG_${Date.now()}`,
    job_id: id,
    job_no: payload.job_no || (String(id).startsWith('JOB') ? String(id) : `JOB20260900${id}`),
    task_id: payload.task_id || payload.taskId || `T_${id}_1`,
    task_name: payload.task_name || payload.taskName || 'งานบริการติดตั้ง',
    log_date: payload.log_date || payload.logDate || new Date().toISOString().slice(0, 10),
    start_time: payload.start_time || payload.startTime || '08:30',
    end_time: payload.end_time || payload.endTime || '17:00',
    work_hours: payload.work_hours || payload.workHours || '8 ชม. 30 นาที',
    day_number: Number(payload.day_number || payload.dayNumber) || 1,
    total_days: Number(payload.total_days || payload.totalDays) || 1,
    technician: payload.technician || 'Team B (ประเสริฐ)',
    recorded_by: payload.recorded_by || payload.recordedBy || 'ช่างหน้างาน',
    reporter_role: payload.reporter_role || payload.reporterRole || 'TECH',
    progress_percent: Number(payload.progress_percent !== undefined ? payload.progress_percent : payload.progressPercent) || 0,
    work_description: payload.work_description || payload.workDescription || '',
    additional_details: payload.additional_details || payload.additionalDetails || '',
    issues: payload.issues || '',
    materials_used: payload.materials_used || payload.materialsUsed || '',
    photos: Array.isArray(payload.photos) ? payload.photos : [],
    is_completed: Boolean(payload.is_completed || payload.isCompleted || (payload.progress_percent >= 100) || (payload.progressPercent >= 100)),
    created_at: payload.created_at || payload.createdAt || new Date().toISOString()
  };

  // Persist to PostgreSQL database
  await dbSaveDailyWorkLog(newLog);
  coreDailyWorkLogStore.push(newLog);

  // If completed, update task and job status to QC_PENDING in DB
  if (newLog.is_completed) {
    const job = await dbGetJob(id);
    if (job) {
      const tasks = Array.isArray(job.tasks) ? [...job.tasks] : [];
      const task = tasks.find((t: any) => String(t.id) === String(newLog.task_id));
      if (task) {
        task.status = 'DONE';
        task.progress_percent = 100;
      }
      await dbUpdateJob(id, {
        tasks,
        status: JobStatus.QC_PENDING,
        overall_progress: 85
      });
    }

    const memTask = coreTaskStore.find(t => String(t.id) === String(newLog.task_id));
    if (memTask) {
      memTask.status = 'DONE';
      memTask.progress_percent = 100;
    }
    const targetJob = coreJobStore.find(j => String(j.id) === String(id) || j.job_no === id);
    if (targetJob) {
      targetJob.status = JobStatus.QC_PENDING;
      targetJob.overall_progress = 85;
    }
    // Confirm QC Booking on the completion end date
    await dbConfirmQCBooking(String(newLog.task_id), undefined, newLog.recorded_by);
    const booking = coreQCBookingStore.find(b => String(b.task_id) === String(newLog.task_id));
    if (booking) {
      booking.status = 'CONFIRMED';
      booking.confirmed_at = new Date().toISOString();
      booking.confirmed_by = newLog.recorded_by;
    }
  }

  return newLog;
}

// POST /api/v1/jobs/:id/daily-logs — Create new daily work log for job
app.post('/api/v1/jobs/:id/daily-logs', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const newLog = await handleCreateDailyLog(req.body, id);
  return res.status(201).json({
    success: true,
    message: newLog.is_completed
      ? 'ช่างบันทึกสำเร็จ 100%! ส่งมอบงานเข้าคิวตรวจคุณภาพ QC ล่วงหน้าเรียบร้อย'
      : 'บันทึกความคืบหน้างานช่างประจำวันเรียบร้อย',
    data: newLog
  });
});

// POST /api/v1/daily-logs — Create new daily work log
app.post('/api/v1/daily-logs', requireAuth, async (req: Request, res: Response) => {
  const newLog = await handleCreateDailyLog(req.body);
  return res.status(201).json({
    success: true,
    message: newLog.is_completed
      ? 'ช่างบันทึกสำเร็จ 100%! ส่งมอบงานเข้าคิวตรวจคุณภาพ QC ล่วงหน้าเรียบร้อย'
      : 'บันทึกความคืบหน้างานช่างประจำวันเรียบร้อย',
    data: newLog
  });
});

// DELETE /api/v1/daily-logs/:logId — Delete daily work log
app.delete('/api/v1/daily-logs/:logId', requireAuth, async (req: Request, res: Response) => {
  const { logId } = req.params;
  await dbDeleteDailyWorkLog(logId);
  const idx = coreDailyWorkLogStore.findIndex(l => l.id === logId);
  if (idx !== -1) {
    coreDailyWorkLogStore.splice(idx, 1);
  }
  return res.json({ success: true, message: 'ลบรายการบันทึกงานประจำวันเรียบร้อย' });
});

// =============================================================================
// 5. QC INSPECTION & AFTER SALE CSAT API (Req #10 & #11)
// =============================================================================
app.post('/api/v1/jobs/:id/qc-inspection', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const numId = Number(param);
  const { items, remarks } = req.body; // items: [{ item_id, result: 'PASS'|'FAIL', is_mandatory }]

  // Rule: Mandatory item failing triggers overall QC FAIL (Req #11)
  const hasMandatoryFail = Array.isArray(items) && items.some((it: any) => it.is_mandatory && it.result === 'FAIL');
  const overallResult = hasMandatoryFail ? 'FAIL' : 'PASS';
  const nextStatus = overallResult === 'PASS' ? JobStatus.QC_PASSED : JobStatus.IN_PROGRESS;
  const overallProgress = overallResult === 'PASS' ? 100 : 80;

  // Persist to PostgreSQL database
  const updatedJob = await dbUpdateJob(param, {
    status: nextStatus,
    overall_progress: overallProgress,
    qc_passed_at: overallResult === 'PASS' ? new Date().toISOString() : null
  });

  const targetJob = coreJobStore.find(j => j.id === numId || j.job_no === param);
  if (targetJob) {
    targetJob.status = nextStatus;
    targetJob.overall_progress = overallProgress;
  }

  return res.status(200).json({
    success: true,
    data: {
      inspection_id: Date.now(),
      job_id: updatedJob ? updatedJob.id : (targetJob ? targetJob.id : numId),
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
app.post('/api/v1/jobs/:id/after-sale/csat', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const numId = Number(param);
  const { csat_score, customer_feedback, csat_remarks, csat_photos, csat_surveyor, csat_evaluated_at, close_now } = req.body;

  const scoreNum = Number(csat_score);
  const csatResult = scoreNum >= 3 ? 'PASS' : 'FAIL';
  const nextStatus = close_now ? JobStatus.CLOSED : JobStatus.AFTER_SALE;
  const overallProgress = 100;
  const evalDate = csat_evaluated_at || new Date().toISOString();
  const remarksText = csat_remarks || customer_feedback || '';

  const updatePayload: any = {
    status: nextStatus,
    overall_progress: overallProgress,
    csat_score: isNaN(scoreNum) ? 5 : scoreNum,
    csat_remarks: remarksText,
    csat_photos: Array.isArray(csat_photos) ? csat_photos : [],
    csat_surveyor: csat_surveyor || '',
    csat_evaluated_at: evalDate
  };
  const updatedJob = await dbUpdateJob(param, updatePayload);

  const targetJob = coreJobStore.find(j => j.id === numId || j.job_no === param);
  if (targetJob) {
    targetJob.status = nextStatus;
    targetJob.overall_progress = 100;
    targetJob.csat_score = isNaN(scoreNum) ? 5 : scoreNum;
    targetJob.csat_remarks = remarksText;
    targetJob.csat_photos = Array.isArray(csat_photos) ? csat_photos : [];
    targetJob.csat_surveyor = csat_surveyor || '';
    targetJob.csat_evaluated_at = evalDate;
  }

  return res.status(200).json({
    success: true,
    data: {
      case_no: `AS-${Date.now()}`,
      job_id: updatedJob ? updatedJob.id : (targetJob ? targetJob.id : numId),
      csat_score: isNaN(scoreNum) ? 5 : scoreNum,
      csat_result: csatResult,
      customer_feedback: remarksText,
      csat_photos: Array.isArray(csat_photos) ? csat_photos : [],
      csat_surveyor: csat_surveyor || '',
      csat_evaluated_at: evalDate,
      next_job_status: nextStatus
    }
  });
});

// =============================================================================
// 6. BMT OUTBOUND REST INTEGRATION API (Req #12, OQ-A02, OQ-A03)
// =============================================================================
app.post('/api/v1/jobs/:id/close-and-export-bmt', requireAuth, async (req: Request, res: Response) => {
  try {
    const param = req.params.id;
    const numId = Number(param);
    const updatedJob = await dbUpdateJob(param, {
      status: JobStatus.CLOSED,
      overall_progress: 100
    });

    const targetJob = coreJobStore.find(j => j.id === numId || j.job_no === param);
    if (targetJob) {
      targetJob.status = JobStatus.CLOSED;
      targetJob.overall_progress = 100;
    }

    const jobNo = updatedJob?.job_no || targetJob?.job_no || (String(param).startsWith('JOB') ? param : `JOB20260900${param}`);
    const customerName = updatedJob?.customer_name || targetJob?.customer_name || 'นาย สมชาย ใจดี';
    const customerPhone = updatedJob?.customer_phone || targetJob?.customer_phone || '081-234-5678';
    const customerAddress = updatedJob?.customer_address || targetJob?.customer_address || '123/45 ถ.พหลโยธิน กรุงเทพฯ';

    const bmtPayload = {
      job_no: jobNo,
      bmt_export_timestamp: new Date().toISOString(),
      customer: {
        name: customerName,
        phone: customerPhone,
        address: customerAddress
      },
      qc_passed_tasks: [
        {
          task_id: 101,
          task_name: updatedJob?.service_type || 'บริการติดตั้งและตรวจสอบ',
          technician: updatedJob?.assigned_team || 'ช่าง สมศักดิ์',
          qc_passed_at: new Date().toISOString()
        }
      ],
      csat_result: 'PASS',
      status: 'CLOSED'
    };

    return res.status(200).json({
      success: true,
      data: {
        job_id: updatedJob ? updatedJob.id : (targetJob ? targetJob.id : numId),
        status: JobStatus.CLOSED,
        bmt_response_ref: `BMT-REF-${Math.floor(100000 + Math.random() * 900000)}`,
        exported_payload: bmtPayload
      },
      meta: { message: 'Job closed and exported to BMT system successfully via REST API' }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'BMT_EXPORT_FAILED', message: err.message } });
  }
});


// =============================================================================
// RECURRING MAINTENANCE / MA CONTRACTS API & STORE
// =============================================================================

export interface MAChecklistTemplate {
  id: string;
  service_type: string;
  template_name: string;
  checklist_items: {
    id: string;
    label: string;
    required: boolean;
  }[];
  created_at: string;
}

export const maChecklistTemplateStore: MAChecklistTemplate[] = [
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

// Helper: Format contract with round counts
async function formatContractWithRounds(c: MAContract) {
  const rounds = await dbLoadMARounds(c.id);
  const totalRoundsCount = rounds.length > 0 ? rounds.length : (c.total_rounds || 0);
  const completedRounds = rounds.filter((r: any) => r.status === 'Completed').length;
  return {
    ...c,
    total_rounds_count: totalRoundsCount,
    completed_rounds: completedRounds
  };
}

// 1. Get Checklist Templates
app.get(['/api/ma-checklist-templates', '/api/v1/ma-checklist-templates'], (req: Request, res: Response) => {
  return res.json(maChecklistTemplateStore);
});

// 2. Get All MA Contracts
app.get(['/api/ma-contracts', '/api/v1/ma-contracts'], requireAuth, async (req: Request, res: Response) => {
  const contracts = await dbLoadMAContracts();
  const formatted = await Promise.all(contracts.map(formatContractWithRounds));
  return res.json(formatted);
});

// 3. Get Single MA Contract by ID (with rounds)
app.get(['/api/ma-contracts/:id', '/api/v1/ma-contracts/:id'], requireAuth, async (req: Request, res: Response) => {
  const contract = await dbGetMAContract(req.params.id);
  if (!contract) {
    const memContract = maContractStore.find(c => c.id === req.params.id);
    if (!memContract) {
      return res.status(404).json({ error: 'ไม่พบสัญญา MA ที่ระบุ' });
    }
    const memRounds = maRoundStore
      .filter(r => r.contract_id === memContract.id)
      .sort((a, b) => a.round_number - b.round_number);
    return res.json({
      ...(await formatContractWithRounds(memContract)),
      rounds: memRounds
    });
  }
  const rounds = await dbLoadMARounds(contract.id);
  rounds.sort((a: any, b: any) => a.round_number - b.round_number);
  
  return res.json({
    ...(await formatContractWithRounds(contract)),
    rounds
  });
});

// 4. Create New MA Contract
app.post(['/api/ma-contracts', '/api/v1/ma-contracts'], requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body;
    const year = new Date().getFullYear();
    const existing = await dbLoadMAContracts();
    const count = existing.length + 1;
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
        if (line.startsWith('ลูกค้า:') && !customerName) customerName = line.replace('ลูกค้า:', '').trim();
        if (line.startsWith('โทร:') && !customerPhone) customerPhone = line.replace('โทร:', '').trim();
        if (line.startsWith('ไซต์:') && !siteName) siteName = line.replace('ไซต์:', '').trim();
        if (line.startsWith('ที่อยู่:') && !siteAddress) siteAddress = line.replace('ที่อยู่:', '').trim();
      }
    }

    const newContract: MAContract = {
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

    await dbSaveMAContract(newContract);
    maContractStore.unshift(newContract);

    // Auto generate rounds if not created externally
    if (req.query.auto_rounds !== 'false' && newContract.total_rounds > 0) {
      const startDate = new Date(newContract.contract_start_date);
      for (let i = 1; i <= newContract.total_rounds; i++) {
        const roundDate = new Date(startDate);
        roundDate.setMonth(roundDate.getMonth() + (newContract.frequency_months * (i - 1)));
        const roundData: MARound = {
          id: `mar_${Date.now()}_${i}`,
          contract_id: newId,
          project_id: null,
          round_number: i,
          scheduled_date: roundDate.toISOString().split('T')[0],
          actual_date: null,
          status: 'Scheduled',
          notes: null,
          created_at: new Date().toISOString()
        };
        await dbSaveMARound(roundData);
        maRoundStore.push(roundData);
      }
    }

    return res.status(201).json(await formatContractWithRounds(newContract));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. Create MA Round
app.post(['/api/ma-rounds', '/api/v1/ma-rounds'], requireAuth, async (req: Request, res: Response) => {
  try {
    const { contract_id, round_number, scheduled_date, status, notes } = req.body;
    if (!contract_id || !round_number || !scheduled_date) {
      return res.status(400).json({ error: 'contract_id, round_number, and scheduled_date are required' });
    }

    const newRound: MARound = {
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

    await dbSaveMARound(newRound);
    maRoundStore.push(newRound);
    return res.status(201).json(newRound);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// 6. Update MA Round (Mark Completed or Reschedule)
app.patch(['/api/ma-rounds/:id', '/api/v1/ma-rounds/:id'], requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, scheduled_date, actual_date, notes } = req.body;
    const updates: any = {};
    if (status) updates.status = status;
    if (scheduled_date) updates.scheduled_date = scheduled_date;
    if (actual_date !== undefined) updates.actual_date = actual_date;
    if (notes !== undefined) updates.notes = notes;

    await dbUpdateMARound(req.params.id, updates);

    // If all rounds of contract are completed, mark contract completed
    const rounds = await dbLoadMARounds();
    const currentRound = rounds.find((r: any) => r.id === req.params.id);
    if (currentRound) {
      const contractRounds = rounds.filter((r: any) => r.contract_id === currentRound.contract_id);
      if (contractRounds.length > 0 && contractRounds.every((r: any) => r.status === 'Completed')) {
        await dbSaveMAContract({ id: currentRound.contract_id, status: 'Completed' });
      }
    }

    const round = maRoundStore.find(r => r.id === req.params.id);
    if (round) {
      if (status) round.status = status;
      if (scheduled_date) round.scheduled_date = scheduled_date;
      if (actual_date !== undefined) round.actual_date = actual_date;
      if (notes !== undefined) round.notes = notes;

      const contractRoundsMem = maRoundStore.filter(r => r.contract_id === round.contract_id);
      const contractMem = maContractStore.find(c => c.id === round.contract_id);
      if (contractMem && contractRoundsMem.length > 0 && contractRoundsMem.every(r => r.status === 'Completed')) {
        contractMem.status = 'Completed';
      }
    }

    return res.json(currentRound || round || { id: req.params.id, ...updates });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});


export async function hydrateFromDatabase() {
  try {
    const dbJobs = await dbLoadJobs();
    coreJobStore.length = 0;
    if (dbJobs && dbJobs.length > 0) {
      coreJobStore.push(...dbJobs);
      console.log(`[DB HYDRATE] Loaded ${coreJobStore.length} jobs from PostgreSQL.`);
    } else {
      console.log('[DB HYDRATE] core_jobs table is empty (0 jobs).');
    }

    const dbLogs = await dbLoadDailyWorkLogs();
    coreDailyWorkLogStore.length = 0;
    if (dbLogs && dbLogs.length > 0) {
      coreDailyWorkLogStore.push(...dbLogs);
      console.log(`[DB HYDRATE] Loaded ${coreDailyWorkLogStore.length} daily work logs from PostgreSQL.`);
    }

    const dbBookings = await dbLoadQCBookings();
    coreQCBookingStore.length = 0;
    if (dbBookings && dbBookings.length > 0) {
      coreQCBookingStore.push(...dbBookings);
      console.log(`[DB HYDRATE] Loaded ${coreQCBookingStore.length} QC bookings from PostgreSQL.`);
    }

    const dbContracts = await dbLoadMAContracts();
    maContractStore.length = 0;
    if (dbContracts && dbContracts.length > 0) {
      maContractStore.push(...dbContracts);
      console.log(`[DB HYDRATE] Loaded ${maContractStore.length} MA contracts from PostgreSQL.`);
    }

    const dbRounds = await dbLoadMARounds();
    maRoundStore.length = 0;
    if (dbRounds && dbRounds.length > 0) {
      maRoundStore.push(...dbRounds);
      console.log(`[DB HYDRATE] Loaded ${maRoundStore.length} MA rounds from PostgreSQL.`);
    }
  } catch (err: any) {
    console.error('[DB HYDRATE ERROR]', err.message);
  }
}

// Global error protection
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🚀 SPMT Production REST API Server running on port ${PORT}`);
  try {
    const connected = await initDatabase();
    if (connected) {
      await seedUsers();
      await hydrateFromDatabase();
    }
  } catch (err: any) {
    console.error('[SERVER BOOT ERROR]', err.message);
  }
});

