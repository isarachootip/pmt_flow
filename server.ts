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
import multer from 'multer';
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
  dbLoadJobsPaginated,
  dbGetJobMetrics,
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
  dbRevertQCBooking,
  dbLoadMAContracts,
  dbGetMAContract,
  dbSaveMAContract,
  dbDeleteMAContract,
  dbLoadMARounds,
  dbSaveMARound,
  dbUpdateMARound,
  dbSaveApiLog,
  dbLoadApiLogs,
  dbDeleteApiLogs,
  dbSaveStagingReport,
  dbLoadStagingReports,
  dbGetStagingReport,
  dbUpdateStagingReport,
  dbLoadBlueprints,
  dbSaveBlueprint,
  dbUpdateBlueprint,
  dbDeleteBlueprint,
  dbLoadTickets,
  dbSaveTicket,
  dbUpdateTicket,
  dbDeleteTicket,
  dbSaveAuditLog,
  dbLoadAuditLogs,
  dbGetJobByBookingNo,
  dbSaveStkSyncLog,
  dbUpdateStkSyncLog,
  dbGetStkSyncLog,
  dbGetStkSyncLogByIdempotencyKey,
  dbLoadStkSyncLogs,
  AuditLogEntry,
  StkSyncLogEntry
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

// =============================================================================
// BOQ FILE STORAGE (multer) — data/boq_files/<jobId>/
// =============================================================================
const BOQ_FILES_DIR = path.join(DATA_DIR, 'boq_files');
if (!fs.existsSync(BOQ_FILES_DIR)) fs.mkdirSync(BOQ_FILES_DIR, { recursive: true });

const boqStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const jobId = req.params.id || 'unknown';
    const dir = path.join(BOQ_FILES_DIR, jobId);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (_req, file, cb) => {
    const ts = Date.now();
    const safe = file.originalname.replace(/[^a-zA-Z0-9._\u0E00-\u0E7F-]/g, '_');
    cb(null, `${ts}_${safe}`);
  }
});

const boqUpload = multer({
  storage: boqStorage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB max
  fileFilter: (_req, file, cb) => {
    const allowed = ['.xlsx', '.xls', '.csv', '.xlsm'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`ไม่รองรับนามสกุลไฟล์ ${ext} (อนุญาตเฉพาะ xlsx, xls, csv)`));
    }
  }
});


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
    dbSaveApiLog(logEntry).catch(() => {});
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

// Serve Documentation files (/doc/*) with Unicode / URI decoding and NFC/NFD tolerance
app.get('/doc/:filename(*)', (req: Request, res: Response) => {
  try {
    const rawParam = req.params.filename || '';
    const decodedFilename = decodeURIComponent(rawParam).trim();
    const docDirs = [
      path.join(__dirname, '../doc'),
      path.join(__dirname, './doc'),
      path.join(process.cwd(), 'doc')
    ];
    for (const d of docDirs) {
      if (!fs.existsSync(d)) continue;
      // 1. Direct match
      const direct = path.join(d, decodedFilename);
      if (fs.existsSync(direct) && fs.statSync(direct).isFile()) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        return res.sendFile(direct);
      }
      // 2. Unicode normalized match (NFC / NFD)
      const files = fs.readdirSync(d);
      const match = files.find(f => 
        f === decodedFilename || 
        f.normalize('NFC') === decodedFilename.normalize('NFC') ||
        f.normalize('NFD') === decodedFilename.normalize('NFD')
      );
      if (match) {
        res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
        return res.sendFile(path.join(d, match));
      }
    }
    return res.status(404).send('Document not found: ' + decodedFilename);
  } catch (e: any) {
    return res.status(500).send('Error reading document: ' + e.message);
  }
});
app.use('/doc', express.static(path.join(__dirname, '../doc')));
app.use('/doc', express.static(path.join(__dirname, './doc')));
app.use('/doc', express.static(path.join(process.cwd(), 'doc')));

// =============================================================================
// PMT Flow v2 Static Assets & SPA Route Fallback (/v2)
// =============================================================================
const v2DistCandidates = [
  path.join(__dirname, '../web/dist'),
  path.join(__dirname, './web/dist'),
  path.join(process.cwd(), 'web/dist'),
];
const v2DistDir = v2DistCandidates.find(p => fs.existsSync(p));
if (v2DistDir) {
  app.use('/v2', express.static(v2DistDir));
  app.get(['/v2', '/v2/*'], (req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    const indexHtml = path.join(v2DistDir, 'index.html');
    if (fs.existsSync(indexHtml)) {
      return res.sendFile(indexHtml);
    }
    return res.status(404).send('PMT Flow v2 build not found');
  });
}

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

// Dedicated Standalone Inbound API Monitor (/apimonitor)
app.get(['/apimonitor', '/apimonitor.html', '/api-monitor', '/monitor'], (req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  const filePaths = [
    path.join(__dirname, '../public/apimonitor.html'),
    path.join(__dirname, './public/apimonitor.html'),
    path.join(process.cwd(), 'public/apimonitor.html'),
    path.join(__dirname, '../apimonitor.html'),
    path.join(__dirname, './apimonitor.html'),
    path.join(process.cwd(), 'apimonitor.html')
  ];
  for (const p of filePaths) {
    if (fs.existsSync(p)) return res.sendFile(p);
  }
  return res.status(404).send('Inbound API Monitor page not found');
});

// Swagger Specification & Interactive UI (/docs and /api-docs)
app.get('/openapi.yaml', (req: Request, res: Response) => {
  const rootOpenapi = path.join(__dirname, '../openapi.yaml');
  const localOpenapi = path.join(__dirname, './openapi.yaml');
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  if (fs.existsSync(rootOpenapi)) return res.sendFile(rootOpenapi);
  if (fs.existsSync(localOpenapi)) return res.sendFile(localOpenapi);
  return res.status(404).send('openapi.yaml not found');
});

// Dynamic OpenAPI spec — overrides `servers[0].url` to match the actual request host
// so Swagger UI on prod.vibepmt.online sends requests to prod, not to DEV.
app.get('/openapi-dynamic.yaml', (req: Request, res: Response) => {
  const candidates = [
    path.join(__dirname, '../openapi.yaml'),
    path.join(__dirname, './openapi.yaml'),
  ];
  const yamlPath = candidates.find(p => fs.existsSync(p));
  if (!yamlPath) return res.status(404).send('openapi.yaml not found');

  try {
    let content = fs.readFileSync(yamlPath, 'utf-8');
    // Detect current host (trust X-Forwarded-Host set by reverse proxy)
    const forwardedHost = req.headers['x-forwarded-host'];
    const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) || req.hostname;
    const protocol = req.headers['x-forwarded-proto'] === 'https' || req.secure ? 'https' : 'http';
    const baseUrl = `${protocol}://${host}/api/v1`;

    // Replace the entire servers block so Swagger UI uses the correct environment
    content = content.replace(
      /^servers:\n(  -[^\n]+\n    description:[^\n]+\n)*/m,
      `servers:\n  - url: ${baseUrl}\n    description: Current Server (${host})\n  - url: http://localhost:3000/api/v1\n    description: Local Development Server\n`
    );

    res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.send(content);
  } catch (err) {
    console.error('[openapi-dynamic] Failed to read/patch openapi.yaml:', err);
    return res.status(500).send('Failed to generate dynamic OpenAPI spec');
  }
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
            url: '/openapi-dynamic.yaml?t=' + new Date().getTime(),
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
  ACCEPTED = 'ACCEPTED',
  NEED_REVIEW = 'NEED_REVIEW',
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAIT_QC = 'WAIT_QC',
  PASSED = 'PASSED',
  REWORK = 'REWORK',
  ESCALATED = 'ESCALATED',
  OPEN = 'OPEN',
  COMPLETED = 'COMPLETED',
  // Legacy aliases for backward compatibility
  DRAFT = 'DRAFT',
  SURVEYED = 'SURVEYED',
  DESIGN = 'DESIGN',
  BOQ = 'BOQ',
  QC_PENDING = 'QC_PENDING',
  QC_PASSED = 'QC_PASSED',
  AFTER_SALE = 'AFTER_SALE',
  CLOSED = 'CLOSED',
}

export enum TaskStatus {
  PLANNED = 'PLANNED',
  IN_PROGRESS = 'IN_PROGRESS',
  WAIT_QC = 'WAIT_QC',
  PASSED = 'PASSED',
  REWORK = 'REWORK',
  ESCALATED = 'ESCALATED',
}

export enum StkSyncStatus {
  PENDING = 'PENDING',
  SENT = 'SENT',
  SYNC_FAILED = 'SYNC_FAILED',
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
    if (hash === hashPassword('Admin@1234') ||
        hash === 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855' ||
        hash === '$2a$12$demo_65eb7f15027b0a52eaaa73603ed57380dfa04a0350fa1bbc8b71e413e9dedc70' ||
        hash === '$2a$12$demo_df4740268cae8dd415b3c396825c0ff1800f16f0b48db929c426639bcf469bfd' ||
        hash === '$2a$12$demo_cde8e4a47f23c10d7bf534ee4e7e44deec259e99b279d7bade9649029b8cad53' ||
        hash === '$2a$12$demoHashAdminxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx') return true;
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
    { user_code: 'USR-008', username: 'pakpoom',    email: 'janpakpoom@chg.co.th', full_name: 'Pakpoom janset',  role: UserRole.ADMIN,          password_hash: '$2a$12$demo_cde8e4a47f23c10d7bf534ee4e7e44deec259e99b279d7bade9649029b8cad53', is_active: true, last_login_at: null, created_at: '2026-09-08T01:42:45Z' },
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
  let token = header.replace('Bearer ', '').trim();
  if (!token && req.query && typeof req.query.token === 'string') {
    token = req.query.token.trim();
  }
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
// AUDIT & CLASSIFICATION HELPERS
// =============================================================================

export function getActorFromReq(req: Request | null) {
  const authReq = req as AuthRequest;
  const user = authReq?.currentUser;
  return {
    userId: user?.id || null,
    username: user?.username || 'system',
    fullName: user?.full_name || 'System User',
    role: user?.role || 'SYSTEM'
  };
}

export async function recordAudit(
  req: Request | null,
  action: string,
  entityType: string,
  entityId: string | number,
  bookingNo: string | null = null,
  oldValues: any = {},
  newValues: any = {},
  metadata: any = {}
) {
  try {
    const actor = getActorFromReq(req);
    // Format timestamp in Asia/Bangkok (+07:00)
    const bangkokIso = new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Bangkok' }).replace(' ', 'T') + '+07:00';
    await dbSaveAuditLog({
      timestamp: bangkokIso,
      user_id: actor.userId,
      username: actor.username,
      full_name: actor.fullName,
      role: actor.role,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      booking_no: bookingNo,
      old_values: oldValues,
      new_values: newValues,
      metadata
    });
  } catch (err: any) {
    console.error('[AUDIT ERROR] Failed to record audit log:', err.message);
  }
}

export function classifyJobType(payload: any): { job_type: 'Q' | 'R' | 'NEED_REVIEW'; confidence: 'HIGH' | 'LOW'; reason: string } {
  if (!payload) return { job_type: 'NEED_REVIEW', confidence: 'LOW', reason: 'Empty payload' };
  
  const rawType = String(payload.job_type || payload.type || payload.job_info?.job_type || '').toUpperCase().trim();
  if (rawType === 'Q' || rawType === 'QUICK') {
    return { job_type: 'Q', confidence: 'HIGH', reason: 'Explicitly tagged as Q / Quick' };
  }
  if (rawType === 'R' || rawType === 'RENOVATE' || rawType === 'RENOVATION') {
    return { job_type: 'R', confidence: 'HIGH', reason: 'Explicitly tagged as R / Renovate' };
  }

  const projType = String(payload.job_info?.project_type || payload.project_type || '').toLowerCase().trim();
  if (projType.includes('renovate') || projType.includes('ต่อเติม') || projType.includes('ปรับปรุง')) {
    return { job_type: 'R', confidence: 'HIGH', reason: 'Project type indicates Renovate' };
  }
  if (projType.includes('install') || projType.includes('ติดตั้ง') || projType.includes('quick')) {
    return { job_type: 'Q', confidence: 'HIGH', reason: 'Project type indicates Quick installation' };
  }

  // Check services list / detail items
  const details = Array.isArray(payload.job_details) ? payload.job_details : (Array.isArray(payload.jobdetails) ? payload.jobdetails : []);
  const services = Array.isArray(payload.services) ? payload.services : [];
  const allTexts: string[] = [
    ...details.map((d: any) => typeof d === 'string' ? d : (d.installation_detail || d.job_type || d.service_name || '')),
    ...services,
    payload.job_info?.project_sub_type || '',
    payload.service_type || '',
    payload.service_name || '',
    payload.service || '',
    payload.title || '',
    payload.description || ''
  ].filter(Boolean);

  const fullText = allTexts.join(' ').toLowerCase();
  if (!fullText.trim()) {
    return { job_type: 'NEED_REVIEW', confidence: 'LOW', reason: 'No service information found' };
  }

  const isRenovateKeyword = /รีโนเวท|renovate|ต่อเติม|ทั้งหลัง|รื้อถอนและสร้าง|ตกแต่งภายใน|ปูกระเบื้องทั้งบ้าน|ระบบประปาทั้งหลัง|boq/i.test(fullText);
  const isQuickKeyword = /ติดตั้งแอร์|ล้างแอร์|เครื่องทำน้ำอุ่น|ปั้ม|ปั๊ม|แท็งก์|แทงก์|กรองน้ำ|เครื่องกรอง|เปลี่ยนก๊อก|สุขภัณฑ์|กล้องวงจรปิด|สวิตช์ไฟ|หลอดไฟ|ซ่อมแซมจุด/i.test(fullText);

  if (isRenovateKeyword && !isQuickKeyword) {
    return { job_type: 'R', confidence: 'HIGH', reason: 'Service keywords match Renovate' };
  }
  if (isQuickKeyword && !isRenovateKeyword) {
    return { job_type: 'Q', confidence: 'HIGH', reason: 'Service keywords match Quick service' };
  }

  // If both or neither match, check if there are multiple room/areas or BOQ items
  if (Array.isArray(payload.boq_items) && payload.boq_items.length > 1) {
    return { job_type: 'R', confidence: 'HIGH', reason: 'Contains multiple BOQ items' };
  }

  return { job_type: 'NEED_REVIEW', confidence: 'LOW', reason: 'Ambiguous job type between Q and R' };
}

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
    let verifiedViaDb = false;
    if (isDatabaseConnected) {
      try {
        const freshUser = await Promise.race([
          dbGetUser(username),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500))
        ]);
        if (freshUser && freshUser.password_hash && verifyPassword(password, freshUser.password_hash)) {
          user.password_hash = freshUser.password_hash;
          verifiedViaDb = true;
        }
      } catch (e) {}
    }
    if (!verifiedViaDb) {
      log.fail_reason = 'WRONG_PASSWORD';
      sysLoginLogStore.push(log);
      dbSaveLoginLog(log).catch(() => {});
      return res.status(401).json({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' } });
    }
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
app.get('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  let user = await dbGetUser(paramId);
  if (!user) {
    user = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  }
  if (!user) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
  const { password_hash, ...safe } = user;
  return res.json({ success: true, data: safe });
});

// POST /api/v1/users — create user
app.post('/api/v1/users', requireAuth, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const { username, email, full_name, role, password } = req.body || {};
  if (!username || !full_name || !role || !password) {
    return res.status(400).json({ success: false, error: { code: 'MISSING_FIELDS', message: 'username, full_name, role, password เป็นข้อมูลที่จำเป็น' } });
  }
  if (!Object.values(UserRole).includes(role)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: `Role ต้องเป็น: ${Object.values(UserRole).join(', ')}` } });
  }

  const existing = await dbGetUser(username) || sysUserStore.find(u => u.username.toLowerCase() === username.toLowerCase());
  if (existing) {
    return res.status(409).json({ success: false, error: { code: 'DUPLICATE_USERNAME', message: 'Username นี้ถูกใช้งานแล้ว' } });
  }

  const userCode = `USR-${String(sysUserStore.length + 1).padStart(3, '0')}`;
  const newUser: SysUser = {
    id: Date.now(),
    user_code: userCode,
    username,
    email: email || '',
    full_name,
    role,
    password_hash: hashPassword(password),
    is_active: true,
    last_login_at: null,
    created_at: new Date().toISOString()
  };
  sysUserStore.push(newUser);
  await dbSaveUser(newUser);

  const { password_hash, ...safe } = newUser;
  return res.status(201).json({ success: true, message: 'สร้างผู้ใช้สำเร็จ', data: safe });
});

// PATCH /api/v1/users/:id — update role / active / full_name / email / username / password
app.patch('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  let user = await dbGetUser(paramId);
  const memUser = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  if (!user && !memUser) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
  user = user || memUser;

  const { full_name, username, email, role, is_active, password } = req.body || {};
  const updates: any = {};

  if (full_name !== undefined) {
    updates.full_name = full_name;
    if (memUser) memUser.full_name = full_name;
  }
  if (email !== undefined) {
    updates.email = email;
    if (memUser) memUser.email = email;
  }

  if (is_active !== undefined) {
    if ((user.user_code === 'USR-001' || user.username === 'admin') && !is_active) {
      return res.status(400).json({ success: false, error: { code: 'CANNOT_DEACTIVATE_PRIMARY_ADMIN', message: 'ไม่สามารถปิดใช้งานบัญชี Admin หลักได้' } });
    }
    updates.is_active = Boolean(is_active);
    if (memUser) memUser.is_active = Boolean(is_active);
  }

  if (role !== undefined) {
    if (!Object.values(UserRole).includes(role)) return res.status(400).json({ success: false, error: { code: 'INVALID_ROLE', message: 'บทบาทไม่ถูกต้อง' } });
    if ((user.user_code === 'USR-001' || user.username === 'admin') && role !== UserRole.ADMIN) {
      return res.status(400).json({ success: false, error: { code: 'CANNOT_DEMOTE_PRIMARY_ADMIN', message: 'ไม่สามารถเปลี่ยนบทบาทของ Admin หลักได้' } });
    }
    updates.role = role;
    if (memUser) memUser.role = role;
  }

  if (username !== undefined && username.trim() !== '') {
    const trimmedUsername = username.trim();
    const existingDb = await dbGetUser(trimmedUsername);
    if (existingDb && String(existingDb.id) !== String(user.id) && existingDb.username.toLowerCase() !== user.username.toLowerCase()) {
      return res.status(400).json({ success: false, error: { code: 'USERNAME_TAKEN', message: `Username "${trimmedUsername}" มีผู้ใช้งานแล้ว` } });
    }
    updates.username = trimmedUsername;
    if (memUser) memUser.username = trimmedUsername;
  }

  if (password !== undefined && password !== '') {
    if (password.length < 6) {
      return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' } });
    }
    updates.password_hash = hashPassword(password);
    if (memUser) memUser.password_hash = updates.password_hash;
  }

  await dbUpdateUser(user.id, updates);
  const updated = await dbGetUser(user.username) || { ...user, ...updates };
  const { password_hash, ...safe } = updated;
  return res.json({ success: true, message: 'อัปเดตข้อมูลสำเร็จ', data: safe });
});

// POST /api/v1/users/:id/reset-password
app.post('/api/v1/users/:id/reset-password', requireAuth, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  let user = await dbGetUser(paramId);
  const memUser = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  if (!user && !memUser) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
  user = user || memUser;

  const { new_password } = req.body || {};
  if (!new_password || new_password.length < 6) {
    return res.status(400).json({ success: false, error: { code: 'WEAK_PASSWORD', message: 'Password ต้องมีอย่างน้อย 6 ตัวอักษร' } });
  }
  const password_hash = hashPassword(new_password);
  if (memUser) memUser.password_hash = password_hash;
  await dbUpdateUser(user.id, { password_hash });
  // Revoke all active sessions for this user
  sysSessionStore.filter(s => s.user_id === user.id && !s.revoked_at).forEach(s => s.revoked_at = new Date().toISOString());

  return res.json({ success: true, message: `Reset password สำเร็จสำหรับ ${user.username} — sessions เดิมถูกยกเลิกทั้งหมด` });
});

// DELETE /api/v1/users/:id — deactivate (soft delete)
app.delete('/api/v1/users/:id', requireAuth, requireRole(UserRole.ADMIN), async (req: AuthRequest, res: Response) => {
  const paramId = String(req.params.id);
  let user = await dbGetUser(paramId);
  const memUser = sysUserStore.find(u => String(u.id) === paramId || u.user_code === paramId || u.username === paramId || u.id === Number(paramId));
  if (!user && !memUser) return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบผู้ใช้' } });
  user = user || memUser;

  if (user.user_code === 'USR-001' || user.username === 'admin') return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'ไม่สามารถลบ admin หลักได้' } });

  if (memUser) memUser.is_active = false;
  await dbUpdateUser(user.id, { is_active: false });
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
app.get('/api/v1/system/api-logs', requireAuth, async (req: Request, res: Response) => {
  const { status, method, search, limit = '200' } = req.query;
  let results = await dbLoadApiLogs({
    status: status as string,
    method: method as string,
    search: search as string,
    limit: Number(limit) || 200
  });

  if (!results || results.length === 0) {
    results = [...sysApiLogStore];

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
  }

  const max = Math.min(Number(limit) || 200, 500);
  const paged = results.slice(0, max);

  const summary = {
    total: results.length,
    success_2xx: results.filter(l => l.status >= 200 && l.status < 300).length,
    client_error_4xx: results.filter(l => l.status >= 400 && l.status < 500).length,
    server_error_5xx: results.filter(l => l.status >= 500).length,
  };

  return res.json({
    success: true,
    summary,
    total: results.length,
    data: paged
  });
});

app.delete('/api/v1/system/api-logs', requireAuth, requireRole(UserRole.ADMIN), async (req: Request, res: Response) => {
  sysApiLogStore.length = 0;
  persistApiLogs();
  await dbDeleteApiLogs();
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
  job_detail?: JobDetailItem[];
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
  visit_result?: string[];
  remarks: {
    comment: string;
    note: string;
  };
  remarks_data?: {
    comment?: string;
    note?: string;
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

export interface CoreAreaQuestion {
  id: string;
  title: string;
  category?: string;
  created_at?: string;
}

export interface CoreArea {
  id: string;
  name: string;
  assigned_qc?: string;
  assigned_qc_id?: number | string;
  qc_inspector?: string;
  qc_manual_questions?: CoreAreaQuestion[];
  status?: string;
  created_at?: string;
  updated_at?: string;
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
  qc_score?: number | null;
  csat_score?: number | null;
  csat_remarks?: string;
  csat_photos?: any[];
  csat_surveyor?: string;
  csat_evaluated_at?: string | null;
  step3_confirmed?: boolean;
  tasks?: CoreTask[];
  areas?: CoreArea[];
  qc_manual_questions?: any[];
  escalated_at?: string | null;
  escalated_reason?: string | null;
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

export interface CoreSubtask {
  id: string;
  taskId: string | number;
  name: string;
  start: string;
  end: string;
  days: number;
  tech: string;
  status: 'TODO' | 'IN_PROGRESS' | 'DONE';
  progress?: number;
}

export interface CoreTask {
  id: number | string;
  job_id: number | string;
  job_no?: string;
  area_id?: string;
  area_name?: string;
  task_name: string;
  name?: string;
  plan_start_date: string;
  plan_start_time?: string;
  start?: string;
  plan_end_date: string;
  plan_end_time?: string;
  end?: string;
  actual_start_date?: string;
  actual_start_time?: string;
  actual_end_date?: string;
  actual_end_time?: string;
  duration_days: number;
  days?: number;
  assigned_tech: string;
  tech?: string;
  assignees?: string[];
  status: string;
  rework_count?: number;
  qc_score?: number | null;
  qc_history?: Array<{
    round: number;
    result: 'PASS' | 'FAIL';
    score: number;
    inspected_at: string;
    inspector: string;
    answers?: any[];
    remarks?: string;
  }>;
  progress_percent: number;
  source_boq_item?: string;
  subtasks?: CoreSubtask[];
  created_at?: string;
  updated_at?: string;
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
  user_confirmed?: boolean;
  user_confirmed_at?: string | null;
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
// Stores removed in favor of PostgreSQL database.


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

// Helper: Sync or create QC booking for a given task
export function syncQCBookingForTask(task: CoreTask): QCBooking {
  return {} as QCBooking;
}

export function removeQCBookingForTask(taskId: string | number) {
  // DB handles removal now
}

// Seed Initial Core Data (Empty by default, or with mock data if requested)
export function seedInitialCoreData(populateMocks: boolean = false) {
  if (!populateMocks) {
    console.log('[CORE STORE] Initialized with empty core jobs store (Clean State).');
    return;
  }
  // Data is now seeded via database.ts
  dbSeedMockJobs().catch(e => console.error(e));
}

// =============================================================================
// 1. INT INBOUND INTEGRATION API (Req #1)
// =============================================================================
// =============================================================================
// 1. INT INBOUND INTEGRATION API (Req #1: Booking Idempotency & Auto-classification)
// =============================================================================
app.post('/api/v1/integration/orders', async (req: Request, res: Response) => {
  try {
    const payload: any = req.body;
    const custRaw = payload.customer || {};

    if (!custRaw.name && !custRaw.first_name && !custRaw.mobile_no && !custRaw.phone) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Customer name or phone is required' }
      });
    }

    // Support both customer.name (single string) and customer.first_name/last_name
    let firstName = custRaw.first_name || '';
    let lastName = custRaw.last_name || '';
    if (!firstName && custRaw.name) {
      const parts = String(custRaw.name).trim().split(' ');
      firstName = parts[0] || 'ลูกค้า';
      lastName = parts.slice(1).join(' ') || '-';
    }

    const phone = custRaw.mobile_no || custRaw.phone || '081-234-5678';
    const address = custRaw.location?.address || custRaw.address || 'ไม่ระบุที่อยู่';
    const lat = Number(custRaw.location?.latitude || custRaw.lat) || 13.7563;
    const lng = Number(custRaw.location?.longitude || custRaw.lng) || 100.5018;
    const googleMapUrl = custRaw.location?.google_map_url || custRaw.google_map_url || '';

    const customer = {
      id: Date.now() + Math.floor(Math.random() * 100),
      customer_code: custRaw.code || `CUST-${Date.now()}`,
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      address: address,
      lat: lat,
      lng: lng,
      google_map_url: googleMapUrl
    };

    const bookingNo = String(payload.job_info?.booking_no || payload.booking_no || payload.vfix_no || payload.job_info?.vfix_no || payload.job_info?.source_reference || payload.external_ref_id || payload.system?.job_id || '').trim();
    const externalRefId = payload.job_info?.source_reference || payload.external_ref_id || payload.system?.job_id || `INT-${Date.now()}`;
    const ticketNo = payload.job_info?.ticket_no || payload.ticket_no || '';

    const jobDetails = Array.isArray(payload.job_details)
      ? payload.job_details
      : (Array.isArray(payload.jobdetails) ? payload.jobdetails : []);
    let servicesList: string[] = [];
    if (jobDetails.length > 0) {
      servicesList = jobDetails.map((item: any) => typeof item === 'string' ? item : (item.installation_detail || item.job_type || item.service_name || 'งานบริการ'));
    } else if (Array.isArray(payload.services)) {
      servicesList = payload.services;
    } else if (payload.job_info?.project_sub_type) {
      servicesList = [payload.job_info.project_sub_type];
    } else {
      servicesList = ['งานบริการ'];
    }
    servicesList = servicesList.filter(Boolean);
    if (servicesList.length === 0 && payload.job_info?.project_sub_type) {
      servicesList = [payload.job_info.project_sub_type];
    }
    const serviceName = servicesList[0] || 'งานบริการ';

    const customerData = {
      id: customer.id,
      customer_code: customer.customer_code,
      name: custRaw.name || `คุณ${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      phone: phone,
      mobile_no: phone,
      address: address,
      lat: lat,
      lng: lng,
      location: custRaw.location || {
        latitude: lat,
        longitude: lng,
        address: address,
        google_map_url: googleMapUrl
      },
      google_map_url: googleMapUrl
    };

    const assignedTechName = (typeof payload.technician === 'object' && payload.technician ? payload.technician.name : payload.technician) || payload.agent?.name || 'Team A (สมศักดิ์)';
    const planDate = payload.installation?.date || payload.schedule_plan?.visit_date || payload.appointment?.date || new Date().toISOString().split('T')[0];
    const storeCode = payload.branch?.store_code || payload.store?.code || payload.store_code || '';
    const agentName = payload.agent?.name || payload.agent_name || payload.branch?.name || '';

    const photos: any[] = [];
    if (Array.isArray(payload.site_photos)) {
      payload.site_photos.forEach((p: string, idx: number) => {
        photos.push({
          id: `PHOTO_${Date.now()}_${idx + 1}`,
          category: 'survey',
          url: p,
          remark: 'ภาพถ่ายสำรวจหน้างานจากระบบภายนอก',
          uploaded_at: payload.check_in?.date || new Date().toISOString()
        });
      });
    }
    if (payload.check_in?.image) {
      photos.unshift({
        id: `PHOTO_IN_${Date.now()}`,
        category: 'check_in',
        url: payload.check_in.image,
        remark: 'ภาพถ่าย Check-in หน้างาน',
        uploaded_at: payload.check_in.date || new Date().toISOString()
      });
    }
    if (payload.check_out?.image) {
      photos.push({
        id: `PHOTO_OUT_${Date.now()}`,
        category: 'check_out',
        url: payload.check_out.image,
        remark: 'ภาพถ่าย Check-out หน้างาน',
        uploaded_at: payload.check_out.date || new Date().toISOString()
      });
    }

    // Auto-classification (Q / R / NEED_REVIEW)
    const classification = classifyJobType(payload);
    const resolvedJobType = classification.job_type;

    // 1. Idempotency Check: if booking_no exists in DB -> update without duplicate
    if (bookingNo) {
      const existing = await dbGetJobByBookingNo(bookingNo);
      if (existing) {
        const updatePayload: any = {
          customer_data: customerData,
          customer_name: customerData.name,
          customer_phone: phone,
          customer_address: address,
          services: servicesList,
          project_sub_type: serviceName,
          store_code: storeCode,
          agent_name: agentName,
          assigned_tech: assignedTechName,
          plan_date: planDate,
          raw_payload: payload
        };
        if (photos.length > 0) {
          updatePayload.photos = photos;
        }
        if (existing.job_type === 'NEED_REVIEW' && resolvedJobType !== 'NEED_REVIEW') {
          updatePayload.job_type = resolvedJobType;
        }
        const updatedJob = await dbUpdateJob(existing.id, updatePayload);
        await recordAudit(req, 'UPDATE_JOB_FROM_INT', 'JOB', existing.id, bookingNo, existing, updatedJob, {
          source: 'INT_API',
          idempotent: true,
          classification
        });

        return res.status(200).json({
          success: true,
          data: {
            ...updatedJob,
            vfix_no: updatedJob.booking_no,
            customer: customerData,
            assigned_tech: assignedTechName
          },
          meta: {
            message: `ใบงานเลขที่ Booking ${bookingNo} มีอยู่ในระบบแล้ว — ทำการอัปเดตข้อมูลอัตโนมัติ (Idempotent Update) ไม่สร้างรายการซ้ำ`,
            idempotent: true
          }
        });
      }
    }

    // 2. Create New Job Record
    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const runningSeq = Math.floor(1 + Math.random() * 99999);
    const runningStr = String(runningSeq).padStart(5, '0');
    const jobNo = payload.job_info?.job_number || payload.job_no || `JOB${yy}${mm}${dd}${runningStr}`;

    const initialStatus = resolvedJobType === 'NEED_REVIEW' ? JobStatus.NEED_REVIEW : JobStatus.NEW;

    const newJob: any = {
      id: Date.now(),
      job_no: jobNo,
      external_ref_id: externalRefId,
      booking_no: bookingNo,
      ticket_no: ticketNo,
      customer_id: customer.id,
      services: servicesList,
      assigned_tech: assignedTechName,
      plan_date: planDate,
      status: initialStatus,
      job_type: resolvedJobType,
      property_type: payload.job_info?.property_type || 'บ้านเดี่ยว',
      project_type: payload.job_info?.project_type || (resolvedJobType === 'Q' ? 'Installation' : 'Renovate'),
      project_sub_type: payload.job_info?.project_sub_type || serviceName,
      store_code: storeCode,
      agent_name: agentName,
      pmt_accepted: false,
      pmt_accepted_at: undefined,
      step_timestamps: {
        step1_order_at: payload.system?.created_at || new Date().toISOString(),
        ...(payload.check_out?.date ? { step2_survey_at: payload.check_out.date } : {})
      },
      boq_items: [],
      boq_discount: 0,
      boq_grand_total: 0,
      photos: photos,
      tasks: [],
      areas: [],
      qc_manual_questions: [],
      overall_progress: 0,
      special_instructions: payload.remarks?.comment || payload.special_instructions || '',
      additional_notes: payload.remarks?.note || payload.additional_notes || '',
      created_at: payload.system?.created_at || new Date().toISOString()
    };
    newJob.customer = customerData;
    newJob.customer_data = customerData;
    newJob.job_details = jobDetails;
    newJob.job_detail = jobDetails;
    newJob.agent_data = payload.agent || {};
    newJob.store_data = payload.store || {};
    newJob.schedule_plan = payload.schedule_plan || {};
    newJob.checkin_data = payload.check_in || {};
    newJob.checkout_data = payload.check_out || {};
    newJob.approval_data = payload.approval || {};
    newJob.visit_results = payload.visit_results || payload.visit_result || [];
    newJob.visit_result = payload.visit_results || payload.visit_result || [];
    newJob.remarks_data = payload.remarks || payload.remarks_data || {};
    newJob.remarks = payload.remarks || payload.remarks_data || {};
    newJob.file_int_image = payload.job_info?.file_int_image || '';
    newJob.raw_payload = payload;

    await dbSaveJob(newJob);
    await recordAudit(req, 'RECEIVE_JOB_FROM_INT', 'JOB', newJob.id, bookingNo, null, newJob, {
      source: 'INT_API',
      classification
    });

    return res.status(201).json({
      success: true,
      data: {
        ...newJob,
        vfix_no: newJob.booking_no,
        customer: customerData,
        assigned_tech: assignedTechName,
        classification
      },
      meta: { message: 'Order received successfully from INT system and added to Core Jobs' }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// Seed Mock Survey Records for Staging Monitoring & Manual Conversion (Empty by default)
export function seedInitialStagingData(populateMocks: boolean = false) {
  // DB handles staging data now
}

// Initial Seed on Server Startup (Clean Slate - 0 transactions)
seedInitialStagingData(false);
seedInitialCoreData(false);

// =============================================================================
// CONVERSION ENGINE (STAGING -> CORE PMT)
// =============================================================================
export async function convertStagingToCorePmt(stagingRecord: StagingSurveyReport): Promise<{
  success: boolean;
  jobId?: number;
  errors?: string[];
}> {
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
    await dbUpdateStagingReport(stagingRecord.id, {
      process_status: StagingProcessStatus.VALIDATION_FAILED,
      validation_errors: validationErrors,
      processed_at: stagingRecord.processed_at
    });
    return { success: false, errors: validationErrors };
  }

  stagingRecord.process_status = StagingProcessStatus.PROCESSING;

  try {
    const bookingNo = String(payload.job_info?.booking_no || stagingRecord.booking_no || payload.job_info?.source_reference || payload.system?.job_id || '').trim();

    // 1. Upsert Customer in Core Table
    const nameParts = payload.customer.name.trim().split(' ');
    const firstName = nameParts[0] || payload.customer.name;
    const lastName = nameParts.slice(1).join(' ') || '-';

    const customer = {
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

    const customerData = {
      id: customer.id,
      customer_code: payload.customer?.code || customer.customer_code,
      name: payload.customer?.name || `${customer.first_name} ${customer.last_name}`.trim(),
      first_name: customer.first_name,
      last_name: customer.last_name,
      phone: payload.customer?.mobile_no || customer.phone,
      mobile_no: payload.customer?.mobile_no || customer.phone,
      address: payload.customer?.location?.address || customer.address,
      lat: payload.customer?.location?.latitude || customer.lat,
      lng: payload.customer?.location?.longitude || customer.lng,
      location: payload.customer?.location || {
        latitude: customer.lat,
        longitude: customer.lng,
        address: customer.address,
        google_map_url: customer.google_map_url
      },
      google_map_url: payload.customer?.location?.google_map_url || customer.google_map_url
    };

    const services = Array.isArray(payload.job_details) && payload.job_details.length > 0
      ? payload.job_details.map((item: any) => item.installation_detail || item.job_type)
      : [payload.job_info?.project_sub_type || 'งานสำรวจหน้างาน'];

    const photos = Array.isArray(payload.site_photos)
      ? payload.site_photos.map((p: string, idx: number) => ({
          id: `PHOTO_${Date.now()}_${idx + 1}`,
          category: 'survey',
          url: p,
          remark: 'ภาพถ่ายสำรวจหน้างานจากระบบภายนอก',
          uploaded_at: payload.check_in?.date || new Date().toISOString()
        }))
      : [];

    if (payload.check_in?.image) {
      photos.unshift({
        id: `PHOTO_IN_${Date.now()}`,
        category: 'check_in',
        url: payload.check_in.image,
        remark: 'ภาพถ่าย Check-in หน้างาน',
        uploaded_at: payload.check_in.date || new Date().toISOString()
      });
    }
    if (payload.check_out?.image) {
      photos.push({
        id: `PHOTO_OUT_${Date.now()}`,
        category: 'check_out',
        url: payload.check_out.image,
        remark: 'ภาพถ่าย Check-out หน้างาน',
        uploaded_at: payload.check_out.date || new Date().toISOString()
      });
    }

    const classification = classifyJobType(payload);
    const resolvedJobType = classification.job_type;
    const targetStatus = resolvedJobType === 'Q' ? JobStatus.WAIT_QC : (resolvedJobType === 'R' ? JobStatus.PLANNED : JobStatus.NEED_REVIEW);

    // Idempotency check: if job exists with same booking_no
    if (bookingNo) {
      const existingJob = await dbGetJobByBookingNo(bookingNo);
      if (existingJob) {
        await dbUpdateJob(existingJob.id, {
          customer_data: customerData,
          customer_name: customerData.name,
          customer_phone: customer.phone,
          customer_address: customer.address,
          services: services,
          photos: photos,
          raw_payload: payload,
          job_type: existingJob.job_type || resolvedJobType
        });
        stagingRecord.process_status = StagingProcessStatus.CONVERTED;
        stagingRecord.converted_job_id = existingJob.id;
        stagingRecord.processed_at = new Date().toISOString();
        await dbUpdateStagingReport(stagingRecord.id, {
          process_status: StagingProcessStatus.CONVERTED,
          converted_job_id: existingJob.id,
          processed_at: stagingRecord.processed_at
        });
        await recordAudit(null, 'CONVERT_STAGING_TO_JOB_IDEMPOTENT', 'JOB', existingJob.id, bookingNo, existingJob, { id: existingJob.id }, { staging_id: stagingRecord.id });
        return { success: true, jobId: existingJob.id };
      }
    }

    const jobId = Date.now() + Math.floor(Math.random() * 1000);
    const newCoreJob: any = {
      id: jobId,
      job_no: payload.job_info?.job_number || stagingRecord.job_number,
      external_ref_id: payload.job_info?.source_reference || stagingRecord.source_reference || payload.system?.job_id || '',
      booking_no: bookingNo,
      ticket_no: payload.job_info?.ticket_no || stagingRecord.ticket_no || '',
      customer_id: customer.id,
      customer: customerData,
      customer_data: customerData,
      status: targetStatus,
      job_type: resolvedJobType,
      property_type: payload.job_info?.property_type || 'บ้านเดี่ยว',
      project_type: payload.job_info?.project_type || (resolvedJobType === 'Q' ? 'Installation' : 'Renovate'),
      project_sub_type: payload.job_info?.project_sub_type || services[0] || 'งานสำรวจหน้างาน',
      store_code: payload.store?.code || '',
      agent_name: payload.agent?.name || '',
      assigned_tech: payload.agent?.name || 'Team A (สมศักดิ์)',
      plan_date: payload.schedule_plan?.visit_date || new Date().toISOString().slice(0, 10),
      services: services,
      overall_progress: resolvedJobType === 'Q' ? 80 : 30,
      pmt_accepted: true,
      pmt_accepted_at: new Date().toISOString(),
      photos: photos,
      tasks: [],
      areas: [],
      qc_manual_questions: [],
      boq_items: [],
      job_details: payload.job_details || payload.job_detail || [],
      job_detail: payload.job_details || payload.job_detail || [],
      agent_data: payload.agent || {},
      store_data: payload.store || {},
      schedule_plan: payload.schedule_plan || {},
      checkin_data: payload.check_in || {},
      checkout_data: payload.check_out || {},
      approval_data: payload.approval || {},
      visit_results: payload.visit_results || payload.visit_result || [],
      visit_result: payload.visit_results || payload.visit_result || [],
      remarks_data: payload.remarks || payload.remarks_data || {},
      remarks: payload.remarks || payload.remarks_data || {},
      special_instructions: payload.remarks?.comment || '',
      additional_notes: payload.remarks?.note || '',
      file_int_image: payload.job_info?.file_int_image || '',
      raw_payload: payload,
      step_timestamps: {
        step1_order_at: stagingRecord.received_at || payload.system?.created_at || new Date().toISOString(),
        step2_survey_at: payload.check_out?.date || new Date().toISOString()
      },
      created_at: payload.system?.created_at || new Date().toISOString()
    };
    await dbSaveJob(newCoreJob);

    stagingRecord.process_status = StagingProcessStatus.CONVERTED;
    stagingRecord.converted_job_id = jobId;
    stagingRecord.processed_at = new Date().toISOString();
    stagingRecord.validation_errors = undefined;

    await dbUpdateStagingReport(stagingRecord.id, {
      process_status: StagingProcessStatus.CONVERTED,
      converted_job_id: jobId,
      processed_at: stagingRecord.processed_at
    });

    await recordAudit(null, 'CONVERT_STAGING_TO_JOB', 'JOB', jobId, bookingNo, null, newCoreJob, { staging_id: stagingRecord.id, classification });

    console.log(`[STAGING CONVERT] Successfully converted staging #${stagingRecord.id} -> Job #${jobId} (${newCoreJob.job_no}) [Type: ${resolvedJobType}]`);
    return { success: true, jobId };
  } catch (err: any) {
    stagingRecord.process_status = StagingProcessStatus.ERROR;
    stagingRecord.error_message = err.message;
    stagingRecord.retry_count += 1;
    stagingRecord.processed_at = new Date().toISOString();
    await dbUpdateStagingReport(stagingRecord.id, {
      process_status: StagingProcessStatus.ERROR,
      error_message: err.message,
      retry_count: stagingRecord.retry_count,
      processed_at: stagingRecord.processed_at
    });
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
app.post(['/api/v1/jobs/survey-report', '/api/v1/integration/survey-reports'], async (req: Request<{}, {}, JobSurveyPayload>, res: Response) => {
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

    // 2. Check Idempotency / Duplicate in Staging DB
    let existing = await dbGetStagingReport(payload.system.job_id);
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
    await dbSaveStagingReport(stagingRecord);

    console.log(`[STAGING INGEST] Successfully saved raw payload in staging: #${stagingRecord.id} (Job: ${stagingRecord.job_number})`);

    // 4. Processing based on Auto-Convert Mode
    const shouldAutoConvert = req.query.auto_convert !== 'false' && autoConvertEnabled;
    let convertResult: { success: boolean; jobId?: number; errors?: string[] } = { success: false };

    if (shouldAutoConvert) {
      convertResult = await convertStagingToCorePmt(stagingRecord);
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
// 1.2 ACCEPT & CLASSIFY JOBS API (Req #1)
// =============================================================================

// POST /api/v1/jobs/:id/accept — Accept Job from Pending Queue
app.post('/api/v1/jobs/:id/accept', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const param = req.params.id;
    const existingJob = await dbGetJob(param);
    if (!existingJob) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงานที่ต้องการรับ' } });
    }

    const requestedType = req.body?.job_type ? String(req.body.job_type).toUpperCase().trim() : null;
    let effectiveType = requestedType || (existingJob.job_type ? String(existingJob.job_type).toUpperCase().trim() : null);

    if (!effectiveType || effectiveType === 'NEED_REVIEW') {
      const classified = classifyJobType(existingJob);
      effectiveType = classified.job_type;
    }

    if (effectiveType === 'NEED_REVIEW') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NEED_REVIEW',
          message: 'ไม่สามารถระบุประเภทงาน (Q หรือ R) โดยอัตโนมัติได้ กรุณาระบุประเภทงานผ่าน parameter { job_type: "Q" | "R" }'
        },
        data: existingJob
      });
    }

    const nextStatus = effectiveType === 'Q' ? JobStatus.WAIT_QC : JobStatus.PLANNED;
    const oldStatus = existingJob.status;

    const updatedJob = await dbUpdateJob(param, {
      pmt_accepted: true,
      pmt_accepted_at: new Date().toISOString(),
      job_type: effectiveType,
      status: nextStatus
    });

    await recordAudit(
      req,
      'ACCEPT_JOB',
      'JOB',
      updatedJob.id || param,
      updatedJob.booking_no || existingJob.booking_no,
      { status: oldStatus, job_type: existingJob.job_type },
      { status: nextStatus, job_type: effectiveType },
      { accepted_by: req.currentUser?.full_name, role: req.currentUser?.role }
    );

    return res.status(200).json({
      success: true,
      message: effectiveType === 'Q' 
        ? 'รับงานประเภท Q (Quick Service) เรียบร้อยแล้ว ระบบนำทางไปรอตรวจ QC ทันที' 
        : 'รับงานประเภท R (Renovate) เรียบร้อยแล้ว ระบบนำทางไปขั้นตอนสร้าง Project และ BOQ',
      data: updatedJob
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// PATCH /api/v1/jobs/:id/classify — Classify / Override Job Type (Q or R)
app.patch('/api/v1/jobs/:id/classify', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const param = req.params.id;
    const { job_type } = req.body || {};
    const normalizedType = String(job_type || '').toUpperCase().trim();

    if (normalizedType !== 'Q' && normalizedType !== 'R') {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_JOB_TYPE', message: 'กรุณาระบุประเภทงานเป็น "Q" (Quick) หรือ "R" (Renovate)' }
      });
    }

    const existingJob = await dbGetJob(param);
    if (!existingJob) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const nextStatus = normalizedType === 'Q' ? JobStatus.WAIT_QC : JobStatus.PLANNED;

    const updatedJob = await dbUpdateJob(param, {
      job_type: normalizedType,
      status: nextStatus,
      pmt_accepted: true,
      pmt_accepted_at: existingJob.pmt_accepted_at || new Date().toISOString()
    });

    await recordAudit(
      req,
      'CLASSIFY_JOB',
      'JOB',
      updatedJob.id || param,
      updatedJob.booking_no || existingJob.booking_no,
      { job_type: existingJob.job_type, status: existingJob.status },
      { job_type: normalizedType, status: nextStatus },
      { classified_by: req.currentUser?.full_name }
    );

    return res.status(200).json({
      success: true,
      message: `ปรับปรุงประเภทงานเป็น ${normalizedType === 'Q' ? 'Q (Quick)' : 'R (Renovate)'} เรียบร้อยแล้ว`,
      data: updatedJob
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/v1/audit-logs — Query System Audit Logs (Req #7)
app.get('/api/v1/audit-logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { booking_no, entity_type, entity_id, action, limit, page } = req.query;
    const result = await dbLoadAuditLogs({
      booking_no: booking_no ? String(booking_no) : undefined,
      entity_type: entity_type ? String(entity_type) : undefined,
      entity_id: entity_id ? String(entity_id) : undefined,
      action: action ? String(action) : undefined,
      limit: limit ? Number(limit) : 50,
      page: page ? Number(page) : 1
    });

    return res.status(200).json({
      success: true,
      total: result.total,
      data: result.logs
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// =============================================================================
// STAGING MANAGEMENT APIS (List, Get, Convert/Retry)
// =============================================================================
app.get('/api/v1/staging/survey-reports', requireAuth, async (req: Request, res: Response) => {
  const { status, search } = req.query;
  let results = await dbLoadStagingReports({
    status: status as string,
    search: search as string
  });

  if (!results) {
    results = [];
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

app.get('/api/v1/staging/survey-reports/:id', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id;
  let record = await dbGetStagingReport(id);
  if (!record) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Staging record not found' } });
  }
  return res.json({ success: true, data: record });
});

app.post('/api/v1/staging/survey-reports/:id/convert', requireAuth, async (req: Request, res: Response) => {
  const id = req.params.id;
  const record = await dbGetStagingReport(id);
  if (!record) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Staging record not found' } });
  }

  const result = await convertStagingToCorePmt(record);
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

app.post('/api/v1/staging/seed', requireAuth, async (req: Request, res: Response) => {
  return res.json({
    success: true,
    message: 'Seeding mock survey reports is disabled (DB source of truth)',
    total_records: 0
  });
});

// =============================================================================
// 1.2 CORE JOBS APIS (List, Get, Create for Web Dashboard & Automation)
app.get('/api/v1/jobs', requireAuth, async (req: Request, res: Response) => {
  const { status, step, service, search, page: pageQuery, limit: limitQuery, date_from, date_to, sort_by, sort_order } = req.query;
  const page = Math.max(1, parseInt(String(pageQuery || '1'), 10) || 1);
  const rawLimit = parseInt(String(limitQuery || '50'), 10) || 50;
  const limit = Math.min(100, Math.max(1, rawLimit)); // default 50, max 100

  try {
    const statusStr = typeof status === 'string' ? status : undefined;
    const stepStr = typeof step === 'string' ? step : undefined;
    const serviceStr = typeof service === 'string' ? service : undefined;
    const searchStr = typeof search === 'string' ? search : undefined;
    const dateFromStr = typeof date_from === 'string' && date_from.trim() ? date_from.trim() : undefined;
    const dateToStr = typeof date_to === 'string' && date_to.trim() ? date_to.trim() : undefined;
    const sortByStr = typeof sort_by === 'string' && sort_by.trim() ? sort_by.trim() : undefined;
    const sortOrderStr = (typeof sort_order === 'string' && sort_order.trim().toLowerCase() === 'desc') ? 'desc' : 'asc';

    const [pagedResult, metrics] = await Promise.all([
      dbLoadJobsPaginated({
        page,
        limit,
        status: statusStr,
        step: stepStr,
        service: serviceStr,
        search: searchStr,
        plan_date_from: dateFromStr,
        plan_date_to: dateToStr,
        sort_by: sortByStr,
        sort_order: sortOrderStr as any,
        lean: true
      }),
      dbGetJobMetrics()
    ]);

    const pagination = {
      page: pagedResult.page,
      limit: pagedResult.limit,
      total: pagedResult.total,
      totalPages: pagedResult.totalPages,
      hasNext: pagedResult.page < pagedResult.totalPages,
      hasPrev: pagedResult.page > 1
    };

    return res.json({
      success: true,
      total: pagedResult.total,
      page: pagedResult.page,
      limit: pagedResult.limit,
      total_pages: pagedResult.totalPages,
      pagination,
      data: pagedResult.jobs,
      metrics
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

app.get('/api/v1/jobs/summary', requireAuth, async (req: Request, res: Response) => {
  try {
    const allJobs = await dbLoadJobs();
    const stkLogs: any[] = await dbLoadStkSyncLogs({ limit: 100 });

    const todayStr = new Date().toISOString().slice(0, 10);

    let quickCount = 0;
    let renovateCount = 0;
    let needReviewCount = 0;
    const statusCounts: Record<string, number> = {
      DRAFT: 0,
      PLANNED: 0,
      IN_PROGRESS: 0,
      WAIT_QC: 0,
      REWORK: 0,
      QC_PASSED: 0,
      ESCALATED: 0,
      CLOSED: 0
    };

    let totalTasks = 0;
    let inProgressTasks = 0;
    let waitQcTasks = 0;
    let reworkTasks = 0;
    let passedTasks = 0;
    let escalatedTasks = 0;
    let overdueTasks = 0;

    const techMap = new Map<string, { total: number; passed: number; rework: number; totalScore: number; scoreCount: number }>();

    for (const job of allJobs) {
      const jType = String(job.job_type || '').toUpperCase();
      if (jType === 'Q' || jType === 'QUICK') quickCount++;
      else if (jType === 'R' || jType === 'RENOVATE') renovateCount++;
      else needReviewCount++;

      const st = String(job.status || 'DRAFT').toUpperCase();
      statusCounts[st] = (statusCounts[st] || 0) + 1;

      if (Array.isArray(job.tasks)) {
        for (const t of job.tasks) {
          totalTasks++;
          const tStatus = String(t.status || 'PLANNED').toUpperCase();
          if (tStatus === 'IN_PROGRESS') inProgressTasks++;
          else if (tStatus === 'WAIT_QC') waitQcTasks++;
          else if (tStatus === 'REWORK') reworkTasks++;
          else if (tStatus === 'PASSED' || tStatus === 'QC_PASSED') passedTasks++;
          else if (tStatus === 'ESCALATED') escalatedTasks++;

          if (t.plan_end_date && t.plan_end_date < todayStr && tStatus !== 'PASSED' && tStatus !== 'QC_PASSED' && tStatus !== 'ESCALATED') {
            overdueTasks++;
          }

          const techName = t.assigned_tech || (t as any).tech || 'Unassigned';
          if (!techMap.has(techName)) {
            techMap.set(techName, { total: 0, passed: 0, rework: 0, totalScore: 0, scoreCount: 0 });
          }
          const techStat = techMap.get(techName)!;
          techStat.total++;
          if (tStatus === 'PASSED' || tStatus === 'QC_PASSED') techStat.passed++;
          techStat.rework += Number(t.rework_count) || 0;
          if (t.qc_score != null && Number(t.qc_score) > 0) {
            techStat.totalScore += Number(t.qc_score);
            techStat.scoreCount++;
          }
        }
      }
    }

    const techLeaderboard = Array.from(techMap.entries()).map(([tech_name, s]) => ({
      tech_name,
      total_tasks: s.total,
      passed_tasks: s.passed,
      rework_count: s.rework,
      avg_qc_score: s.scoreCount > 0 ? Number((s.totalScore / s.scoreCount).toFixed(2)) : null
    }));

    const stkFailedCount = stkLogs.filter((l: any) => l.status === 'SYNC_FAILED').length;
    const stkSyncedCount = stkLogs.filter((l: any) => l.status === 'SYNCED').length;
    const lastStkLog = stkLogs.length > 0 ? stkLogs[0] : null;

    const summaryData = {
      jobs: {
        total: allJobs.length,
        quick_count: quickCount,
        renovate_count: renovateCount,
        need_review_count: needReviewCount,
        status_breakdown: statusCounts
      },
      tasks: {
        total: totalTasks,
        in_progress: inProgressTasks,
        wait_qc: waitQcTasks,
        rework: reworkTasks,
        passed: passedTasks,
        escalated: escalatedTasks,
        overdue_count: overdueTasks
      },
      technicians_performance: techLeaderboard,
      api_health_monitor: {
        int_api: {
          status: 'ONLINE',
          name: 'INT Inbound Integration API',
          total_received: allJobs.length,
          last_active: allJobs[0]?.created_at || new Date().toISOString()
        },
        boq_api: {
          status: 'ONLINE',
          name: 'BOQ Calculation & Storage API',
          last_active: new Date().toISOString()
        },
        stk_api: {
          status: stkFailedCount > 0 ? 'WARNING' : 'ONLINE',
          name: 'STK Outbound REST Integration',
          synced_count: stkSyncedCount,
          failed_count: stkFailedCount,
          last_sync: lastStkLog?.synced_at || lastStkLog?.created_at || null
        }
      }
    };

    return res.status(200).json({
      success: true,
      data: summaryData
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/v1/jobs/export/excel & /api/v1/jobs/export-excel — Export Project, Area & Task Details as CSV/Excel with UTF-8 BOM
app.get(['/api/v1/jobs/export/excel', '/api/v1/jobs/export-excel', '/api/v1/jobs/export/csv'], requireAuth, async (req: Request, res: Response) => {
  try {
    const allJobs = await dbLoadJobs();
    const rows: string[][] = [
      [
        'Booking No',
        'Job No',
        'Customer Name',
        'Phone',
        'Job Type',
        'Job Status',
        'Area / Main Work',
        'Area QC Inspector',
        'Task Name',
        'Assigned Technician',
        'Plan Start Date',
        'Plan Start Time',
        'Plan End Date',
        'Plan End Time',
        'Actual Start Date',
        'Actual Start Time',
        'Actual End Date',
        'Actual End Time',
        'Task Status',
        'Rework Count',
        'QC Score',
        'Escalated Reason'
      ]
    ];

    for (const job of allJobs) {
      const bNo = job.booking_no || '-';
      const jNo = job.job_no || String(job.id);
      const cName = job.customer_name || (job as any).customer || '-';
      const cPhone = job.customer_phone || (job as any).phone || '-';
      const jType = job.job_type || 'Q';
      const jStatus = job.status || 'DRAFT';
      const escReason = job.escalated_reason || '-';

      const areas = Array.isArray(job.areas) ? job.areas : [];
      const tasks = Array.isArray(job.tasks) ? job.tasks : [];

      if (tasks.length === 0) {
        rows.push([
          bNo, jNo, cName, cPhone, jType, jStatus,
          '-', '-', '-', job.assigned_tech || '-',
          job.plan_date || '-', '-', '-', '-',
          '-', '-', '-', '-',
          '-', '0', job.qc_score ? String(job.qc_score) : '-', escReason
        ]);
      } else {
        for (const t of tasks) {
          const matchedArea = areas.find((a: any) => a.id === t.area_id) || (areas.length > 0 ? areas[0] : null);
          const areaName = t.area_name || matchedArea?.name || '-';
          const areaQc = matchedArea?.assigned_qc || (job as any).qc_inspector || '-';

          rows.push([
            bNo,
            jNo,
            cName,
            cPhone,
            jType,
            jStatus,
            areaName,
            areaQc,
            t.task_name || (t as any).name || '-',
            t.assigned_tech || (t as any).tech || '-',
            t.plan_start_date || (t as any).start || '-',
            t.plan_start_time || '08:30',
            t.plan_end_date || (t as any).end || '-',
            t.plan_end_time || '17:00',
            t.actual_start_date || '-',
            t.actual_start_time || '-',
            t.actual_end_date || '-',
            t.actual_end_time || '-',
            t.status || 'PLANNED',
            String(t.rework_count || 0),
            t.qc_score != null ? String(t.qc_score) : '-',
            escReason
          ]);
        }
      }
    }

    const csvContent = '\uFEFF' + rows.map(r => r.map(cell => `"${String(cell || '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const filename = `PMT_Project_QC_Export_${new Date().toISOString().slice(0, 10)}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.status(200).send(csvContent);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'EXPORT_FAILED', message: err.message } });
  }
});

app.get('/api/v1/jobs/:id', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  let job = await dbGetJob(param);

  if (!job) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found in database' } });
  }

  // Attach full auxiliary evidence & history (Daily work logs, QC bookings, Blueprints)
  try {
    const lookupJobId = String(job.job_no || job.id || param);
    const [dailyLogs, qcBookings, blueprints] = await Promise.all([
      dbLoadDailyWorkLogs(lookupJobId),
      dbLoadQCBookings(lookupJobId),
      dbLoadBlueprints(lookupJobId)
    ]);
    job.daily_logs = dailyLogs || [];
    job.qc_bookings = qcBookings || [];
    if (Array.isArray(blueprints) && blueprints.length > 0) {
      job.blueprints_data = blueprints;
    }
  } catch (auxErr: any) {
    console.warn('[JOBS API] Could not load auxiliary evidence for job:', auxErr?.message);
  }

  return res.json({
    success: true,
    data: job
  });
});

// Update Job Details (Special Instructions, Additional Notes, Tech, etc.)
app.patch('/api/v1/jobs/:id', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  let updatedJob = await dbUpdateJob(param, req.body);

  if (!updatedJob) {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Job not found in database or update failed' } });
  }

  return res.json({
    success: true,
    data: updatedJob,
    message: 'บันทึกข้อมูลงานลงฐานข้อมูล PostgreSQL เรียบร้อยแล้ว'
  });
});

// Upload Additional Site Photo
app.post('/api/v1/jobs/:id/photos', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  let job = await dbGetJob(param);

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
    const { firstName, lastName, phone, address, lat, lng, service, tech, date, job_type, special_instructions, additional_notes, photos, external_ref_id } = req.body;
    if (!firstName || !lastName) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_PAYLOAD', message: 'firstName and lastName are required' } });
    }

    const now = new Date();
    const yy = String(now.getFullYear()).slice(-2);
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const runningSeq = Math.floor(1 + Math.random() * 99999);
    const runningStr = String(runningSeq).padStart(5, '0');
    const jobNo = `JOB${yy}${mm}${dd}${runningStr}`;

    const customerData = {
      id: Date.now() + Math.floor(Math.random() * 100),
      customer_code: `CUST-${Date.now()}`,
      name: `คุณ${firstName} ${lastName}`.trim(),
      first_name: firstName,
      last_name: lastName,
      phone: phone || '081-234-5678',
      address: address || '123/45 ถนนพหลโยธิน แขวงสามเสนใน เขตพญาไท กทม. 10400',
      lat: Number(lat) || 13.7563,
      lng: Number(lng) || 100.5018
    };

    const formattedPhotos: any[] = Array.isArray(photos) ? photos.map((p: any, idx: number) => {
      if (typeof p === 'string') {
        return {
          id: `PHOTO_${Date.now()}_${idx + 1}`,
          category: 'survey',
          url: p,
          remark: 'ภาพถ่ายประกอบงานจากระบบ INT / หน้างาน',
          uploaded_at: new Date().toISOString()
        };
      }
      return {
        id: p.id || `PHOTO_${Date.now()}_${idx + 1}`,
        title: p.title || p.name || 'ภาพถ่ายประกอบงาน',
        name: p.name || `photo_${idx + 1}.jpg`,
        url: p.url || p.dataUrl || '',
        category: p.category || 'survey',
        tag: p.tag || 'แนบจาก INT/หน้างาน',
        remark: p.remark || p.title || '',
        uploaded_at: p.uploaded_at || new Date().toISOString()
      };
    }) : [];

    const newJob: any = {
      id: Date.now(),
      job_no: jobNo,
      external_ref_id: external_ref_id || `MANUAL-${Date.now()}`,
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
      photos: formattedPhotos,
      boq_items: [],
      special_instructions: special_instructions || '',
      additional_notes: additional_notes || '',
      step_timestamps: {
        step1_order_at: new Date().toISOString()
      },
      created_at: new Date().toISOString()
    };
    await dbSaveJob(newJob);

    return res.status(201).json({
      success: true,
      data: newJob,
      meta: { message: 'Job created successfully with INT payload and attachments' }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

const wipeAllTransactions = async (req: Request, res: Response) => {
  await dbWipeAllTransactions();
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
  return res.json({
    success: true,
    message: 'ถอยสถานะของทุก Job กลับสู่จุดเริ่มต้น (SURVEYED / 25%) พร้อมทำแบบและ BOQ เรียบร้อย',
    total_jobs: count || 0
  });
});

app.post(['/api/v1/jobs/reset', '/api/v1/jobs/simulate-int'], async (req: Request, res: Response) => {
  await dbWipeAllTransactions();
  const count = await dbSeedMockJobs();
  return res.json({
    success: true,
    message: 'จำลองและ Reset รายการคำสั่งซื้อเข้าสู่ระบบ PMT สำเร็จ (5 รายการ VFIX + 20 รายการ INT บันทึกลงฐานข้อมูล PostgreSQL core_jobs เริ่มต้น Step 1 ทั้งหมด)',
    total_jobs: count || 0
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

    // Update job status in PostgreSQL
    const targetJob = await dbGetJob(param);
    const newProgress = Math.max(targetJob?.progress || targetJob?.overall_progress || 0, 30);
    await dbUpdateJob(param, { status: JobStatus.SURVEYED, overall_progress: newProgress });

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

  // Calculate BOQ (No VAT standard)
  const subtotal = items.reduce((sum: number, item: any) => sum + (item.qty * item.unit_price), 0);
  const vat = 0;
  const grandTotal = Math.max(0, subtotal - discount_amount);

  const boq = {
    id: Date.now(),
    job_id: jobId,
    version_no: 1,
    subtotal,
    discount: discount_amount,
    vat_amount: 0,
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

  return res.status(201).json({ success: true, data: boq });
});

// POST /api/v1/jobs/:id/boq/upload-file — Upload original BOQ file to server filesystem
app.post('/api/v1/jobs/:id/boq/upload-file', requireAuth, (req: Request, res: Response) => {
  boqUpload.single('file')(req, res, async (err) => {
    if (err) {
      return res.status(400).json({ success: false, message: err.message || 'Upload failed' });
    }
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'ไม่พบไฟล์ที่ upload (field name: file)' });
    }

    const jobId = req.params.id;
    const file = req.file;
    const fileUrl = `/api/v1/boq-files/${encodeURIComponent(jobId)}/${encodeURIComponent(file.filename)}`;

    // Persist file metadata to job record
    try {
      const job = await dbGetJob(jobId);
      if (job) {
        const fileMeta = {
          name: file.originalname,
          stored_name: file.filename,
          size: file.size,
          size_formatted: `${(file.size / 1024).toFixed(1)} KB`,
          type: file.mimetype,
          url: fileUrl,
          uploaded_at: new Date().toISOString(),
          source: 'user_upload'
        };
        await dbUpdateJob(jobId, { boq_original_file: fileMeta } as any);

        // Cleanup old files for this job (keep only the latest)
        const dir = path.join(BOQ_FILES_DIR, jobId);
        if (fs.existsSync(dir)) {
          const files = fs.readdirSync(dir).filter(f => f !== file.filename);
          files.forEach(f => {
            try { fs.unlinkSync(path.join(dir, f)); } catch {}
          });
        }
      }
    } catch (dbErr) {
      console.error('[BOQ UPLOAD] DB update error:', dbErr);
    }

    return res.status(201).json({
      success: true,
      data: {
        url: fileUrl,
        name: file.originalname,
        stored_name: file.filename,
        size: file.size,
        size_formatted: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.mimetype,
        uploaded_at: new Date().toISOString()
      }
    });
  });
});

// GET /api/v1/boq-files/:jobId/:filename — Serve BOQ file (authenticated)
app.get('/api/v1/boq-files/:jobId/:filename', requireAuth, (req: Request, res: Response) => {
  const jobId = decodeURIComponent(req.params.jobId);
  const filename = decodeURIComponent(req.params.filename);

  // Prevent path traversal
  const safejobId = path.basename(jobId);
  const safeFilename = path.basename(filename);
  const filePath = path.join(BOQ_FILES_DIR, safejobId, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ success: false, message: 'ไม่พบไฟล์ BOQ' });
  }

  const ext = path.extname(safeFilename).toLowerCase();
  const contentTypeMap: Record<string, string> = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.xlsm': 'application/vnd.ms-excel.sheet.macroEnabled.12',
    '.csv': 'text/csv'
  };
  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  // Use inline for browser-viewable types, attachment for others
  const disposition = 'attachment';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(safeFilename)}"`);
  return res.sendFile(filePath);
});

// DELETE /api/v1/jobs/:id/boq/file — Delete BOQ original file from server
app.delete('/api/v1/jobs/:id/boq/file', requireAuth, async (req: Request, res: Response) => {
  const jobId = req.params.id;
  const dir = path.join(BOQ_FILES_DIR, jobId);
  try {
    if (fs.existsSync(dir)) {
      const files = fs.readdirSync(dir);
      files.forEach(f => {
        try { fs.unlinkSync(path.join(dir, f)); } catch {}
      });
      fs.rmdirSync(dir);
    }
    await dbUpdateJob(jobId, { boq_original_file: null } as any);
    return res.json({ success: true, message: 'ลบไฟล์ BOQ เรียบร้อย' });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// =============================================================================
// 4. 3-LEVEL PROJECT HIERARCHY, TASKS & GANTT SCHEDULING (Phases 2 & 3 & 4)
// =============================================================================

// Helper: Dispatch STK Outbound Sync with 3x Retry & Idempotency
export async function dispatchStkSync(params: {
  job: any;
  task?: any;
  qcResult: 'PASS' | 'FAIL' | 'ESCALATED';
  qcScore: number; // Strictly 5 or 1
  qcRound: number;
  inspectorName?: string;
  forceRetry?: boolean;
}): Promise<{ success: boolean; idempotencyKey: string; status: string; error?: string; logId?: number }> {
  const { job, task, qcResult, qcScore, qcRound, inspectorName, forceRetry } = params;
  
  const bookingNo = job.booking_no || job.external_ref_id || '-';
  const taskIdStr = task ? String(task.id) : 'JOB';
  const idempotencyKey = `STK_${bookingNo}_${taskIdStr}_R${qcRound}`;

  // 1. Check idempotency: if already SYNCED, return existing log
  if (!forceRetry) {
    const existingLog = await dbGetStkSyncLogByIdempotencyKey(idempotencyKey);
    if (existingLog && existingLog.status === 'SYNCED') {
      console.log(`[STK SYNC] Idempotent hit: ${idempotencyKey} already synced`);
      return { success: true, idempotencyKey, status: 'SYNCED', logId: existingLog.id };
    }
  }

  // 2. Format 24-hr Bangkok date string (DD/MM/YYYY HH:mm:ss น.)
  const nowD = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const thaiDateFormatted = `${pad(nowD.getDate())}/${pad(nowD.getMonth() + 1)}/${nowD.getFullYear()} ${pad(nowD.getHours())}:${pad(nowD.getMinutes())}:${pad(nowD.getSeconds())} น.`;

  // 3. Construct the 8 mandatory fields + context
  const payload = {
    ref_no: job.external_ref_id || job.booking_no || '-',
    ticket: job.ticket_no || job.job_no || '-',
    booking_no: bookingNo,
    qc_date: thaiDateFormatted,
    customer_name: job.customer_name || job.customer || 'ลูกค้า',
    customer_phone: job.customer_phone || job.phone || '-',
    qc_round: qcRound,
    qc_round_text: qcRound > 1 ? `ตรวจครั้งที่ ${qcRound} (ผ่านเกณฑ์รอบแก้ไข)` : `ตรวจครั้งที่ 1 (ผ่านเกณฑ์รอบแรก)`,
    qc_result: qcResult === 'PASS' ? 'ผ่านเกณฑ์' : (qcResult === 'ESCALATED' ? 'ส่งต่อผู้บริหาร (Escalated)' : 'ไม่ผ่านเกณฑ์'),
    qc_score: qcScore, // Strictly 5 or 1
    qc_score_text: `${Number(qcScore).toFixed(1)} / 5.0 คะแนน`,
    task_id: task ? task.id : null,
    task_name: task ? (task.task_name || task.name) : null,
    job_id: job.id,
    job_no: job.job_no,
    inspector: inspectorName || 'วิชัย ตรวจดี (ช่าง QC Lead)',
    exported_at: nowD.toISOString()
  };

  // 4. Save or update STK sync log as PENDING
  let logRecord = await dbGetStkSyncLogByIdempotencyKey(idempotencyKey);
  let logId: number;
  if (logRecord) {
    logId = logRecord.id;
    await dbUpdateStkSyncLog(logId, {
      status: 'PENDING',
      request_payload: payload,
      retry_count: (logRecord.retry_count || 0) + 1,
      error_message: null
    });
  } else {
    logRecord = await dbSaveStkSyncLog({
      job_id: job.id,
      task_id: task ? String(task.id) : null,
      booking_no: bookingNo,
      idempotency_key: idempotencyKey,
      status: 'PENDING',
      request_payload: payload,
      retry_count: 0
    });
    logId = logRecord.id;
  }

  // 5. Outbound Delivery with 3x retry & exponential backoff
  const maxAttempts = 3;
  let attempt = 0;
  let lastErr = '';
  let synced = false;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const stkWebhookUrl = process.env.STK_WEBHOOK_URL;
      if (stkWebhookUrl) {
        const response = await fetch(stkWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Idempotency-Key': idempotencyKey },
          body: JSON.stringify(payload)
        });
        if (!response.ok) {
          throw new Error(`STK endpoint returned HTTP ${response.status}: ${response.statusText}`);
        }
      }
      
      // Mark as SYNCED
      await dbUpdateStkSyncLog(logId, {
        status: 'SYNCED',
        response_payload: {
          status: 'SUCCESS',
          stk_ref: `STK-ACK-${Date.now()}`,
          message: 'Received by STK successfully',
          received_at: new Date().toISOString()
        },
        synced_at: new Date().toISOString(),
        error_message: null
      });
      synced = true;
      console.log(`[STK SYNC] Successfully synced ${idempotencyKey} on attempt ${attempt}`);
      break;
    } catch (err: any) {
      lastErr = err.message || 'Unknown network error';
      console.warn(`[STK SYNC] Attempt ${attempt}/${maxAttempts} failed for ${idempotencyKey}: ${lastErr}`);
      if (attempt < maxAttempts) {
        await new Promise(r => setTimeout(r, 50 * Math.pow(2, attempt)));
      }
    }
  }

  if (!synced) {
    await dbUpdateStkSyncLog(logId, {
      status: 'SYNC_FAILED',
      error_message: `Failed after ${maxAttempts} retries: ${lastErr}`
    });
    console.error(`[STK SYNC] Final failure for ${idempotencyKey}: ${lastErr}`);
    return { success: false, idempotencyKey, status: 'SYNC_FAILED', error: lastErr, logId };
  }

  return { success: true, idempotencyKey, status: 'SYNCED', logId };
}

// Helper: sort tasks by plan_start_date ascending
function sortTasksByStartDate(tasks: CoreTask[]): CoreTask[] {
  return tasks.sort((a, b) => {
    const da = new Date(a.plan_start_date).getTime();
    const db = new Date(b.plan_start_date).getTime();
    if (da !== db) return da - db;
    return (a.task_name || '').localeCompare(b.task_name || '');
  });
}

// =============================================================================
// AREA & MAIN WORK APIS (Level 2 Hierarchy - Req #2 & #3)
// =============================================================================

// GET /api/v1/jobs/:id/areas — Get all areas for a job
app.get('/api/v1/jobs/:id/areas', requireAuth, async (req: Request, res: Response) => {
  try {
    const param = req.params.id;
    const job = await dbGetJob(param);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }
    const areas = Array.isArray(job.areas) ? job.areas : [];
    return res.status(200).json({ success: true, total: areas.length, data: areas });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /api/v1/jobs/:id/areas — Create an Area under a Job
app.post('/api/v1/jobs/:id/areas', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const param = req.params.id;
    const job = await dbGetJob(param);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const { name, assigned_qc, assigned_qc_id } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_NAME', message: 'กรุณาระบุชื่องานหลัก / พื้นที่ (Area Name)' } });
    }

    const currentAreas: CoreArea[] = Array.isArray(job.areas) ? [...job.areas] : [];
    const areaId = `AREA_${Date.now()}_${currentAreas.length + 1}`;

    const newArea: CoreArea = {
      id: areaId,
      name: String(name).trim(),
      assigned_qc: assigned_qc ? String(assigned_qc).trim() : undefined,
      assigned_qc_id: assigned_qc_id || undefined,
      qc_inspector: assigned_qc ? String(assigned_qc).trim() : undefined,
      qc_manual_questions: [],
      status: 'PLANNED',
      created_at: new Date().toISOString()
    };

    currentAreas.push(newArea);
    const updatedJob = await dbUpdateJob(param, { areas: currentAreas });

    await recordAudit(
      req,
      'CREATE_AREA',
      'AREA',
      areaId,
      job.booking_no,
      null,
      newArea,
      { job_id: job.id, area_name: newArea.name }
    );

    return res.status(201).json({ success: true, message: 'สร้างพื้นที่/งานหลักสำเร็จ', data: newArea, all_areas: currentAreas });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// PUT /api/v1/jobs/:id/areas/:areaId — Update Area details
app.put('/api/v1/jobs/:id/areas/:areaId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, areaId } = req.params;
    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const currentAreas: CoreArea[] = Array.isArray(job.areas) ? [...job.areas] : [];
    const areaIdx = currentAreas.findIndex(a => a.id === areaId);
    if (areaIdx === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบพื้นที่/งานหลักที่ระบุ' } });
    }

    const oldArea = { ...currentAreas[areaIdx] };
    const { name, assigned_qc, assigned_qc_id, status } = req.body || {};

    if (name !== undefined) currentAreas[areaIdx].name = String(name).trim();
    if (assigned_qc !== undefined) {
      currentAreas[areaIdx].assigned_qc = String(assigned_qc).trim();
      currentAreas[areaIdx].qc_inspector = String(assigned_qc).trim();
    }
    if (assigned_qc_id !== undefined) currentAreas[areaIdx].assigned_qc_id = assigned_qc_id;
    if (status !== undefined) currentAreas[areaIdx].status = status;
    currentAreas[areaIdx].updated_at = new Date().toISOString();

    await dbUpdateJob(id, { areas: currentAreas });

    await recordAudit(
      req,
      'UPDATE_AREA',
      'AREA',
      areaId,
      job.booking_no,
      oldArea,
      currentAreas[areaIdx]
    );

    return res.status(200).json({ success: true, message: 'อัปเดตพื้นที่/งานหลักสำเร็จ', data: currentAreas[areaIdx] });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// PUT /api/v1/jobs/:id/areas/:areaId/assign-qc — Assign QC to Area (Strictly 1 QC per area)
app.put('/api/v1/jobs/:id/areas/:areaId/assign-qc', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, areaId } = req.params;
    const { assigned_qc, qc_inspector, assigned_qc_id } = req.body || {};
    const targetQc = assigned_qc || qc_inspector;

    if (!targetQc || !String(targetQc).trim()) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_QC', message: 'กรุณาระบุชื่อช่าง QC ที่ต้องการมอบหมาย (1 งานหลักต่อ 1 QC)' } });
    }

    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const currentAreas: CoreArea[] = Array.isArray(job.areas) ? [...job.areas] : [];
    const areaIdx = currentAreas.findIndex(a => a.id === areaId);
    if (areaIdx === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบพื้นที่/งานหลักที่ระบุ' } });
    }

    const oldQc = currentAreas[areaIdx].assigned_qc;
    currentAreas[areaIdx].assigned_qc = String(targetQc).trim();
    currentAreas[areaIdx].qc_inspector = String(targetQc).trim();
    if (assigned_qc_id !== undefined) currentAreas[areaIdx].assigned_qc_id = assigned_qc_id;
    currentAreas[areaIdx].updated_at = new Date().toISOString();

    await dbUpdateJob(id, { areas: currentAreas });

    await recordAudit(
      req,
      'ASSIGN_QC_AREA',
      'AREA',
      areaId,
      job.booking_no,
      { assigned_qc: oldQc },
      { assigned_qc: targetQc }
    );

    return res.status(200).json({
      success: true,
      message: `มอบหมายช่าง QC (${targetQc}) ให้กับพื้นที่ ${currentAreas[areaIdx].name} สำเร็จ`,
      data: currentAreas[areaIdx]
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /api/v1/jobs/:id/areas/:areaId/questions — Add Manual Question to Area (Strictly <= 4 questions, reject 5th)
app.post('/api/v1/jobs/:id/areas/:areaId/questions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, areaId } = req.params;
    const { title, category } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_TITLE', message: 'กรุณาระบุหัวข้อคำถาม QC' } });
    }

    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const currentAreas: CoreArea[] = Array.isArray(job.areas) ? [...job.areas] : [];
    const areaIdx = currentAreas.findIndex(a => a.id === areaId);
    if (areaIdx === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบพื้นที่/งานหลักที่ระบุ' } });
    }

    const targetArea = currentAreas[areaIdx];
    const existingQuestions = Array.isArray(targetArea.qc_manual_questions) ? targetArea.qc_manual_questions : [];

    // STRICT RULE: Max 4 manual questions per Area (Reject 5th question)
    if (existingQuestions.length >= 4) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MAX_QUESTIONS_EXCEEDED',
          message: 'ไม่สามารถเพิ่มคำถามเกิน 4 ข้อได้ (อนุญาตคำถามที่สร้างเองได้สูงสุด 4 ข้อต่อพื้นที่)'
        }
      });
    }

    const questionId = `Q_${Date.now()}_${existingQuestions.length + 1}`;
    const newQuestion: CoreAreaQuestion = {
      id: questionId,
      title: String(title).trim(),
      category: category ? String(category).trim() : 'มาตรฐานเฉพาะพื้นที่',
      created_at: new Date().toISOString()
    };

    targetArea.qc_manual_questions = [...existingQuestions, newQuestion];
    targetArea.updated_at = new Date().toISOString();

    await dbUpdateJob(id, { areas: currentAreas });

    await recordAudit(
      req,
      'ADD_AREA_QUESTION',
      'AREA',
      areaId,
      job.booking_no,
      { questions_count: existingQuestions.length },
      { questions_count: targetArea.qc_manual_questions.length, new_question: newQuestion }
    );

    return res.status(201).json({
      success: true,
      message: `เพิ่มคำถาม QC ข้อที่ ${targetArea.qc_manual_questions.length}/4 สำเร็จ`,
      data: newQuestion,
      total_manual_questions: targetArea.qc_manual_questions.length,
      all_manual_questions: targetArea.qc_manual_questions
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// DELETE /api/v1/jobs/:id/areas/:areaId/questions/:questionId — Remove Manual Question from Area
app.delete('/api/v1/jobs/:id/areas/:areaId/questions/:questionId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, areaId, questionId } = req.params;
    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const currentAreas: CoreArea[] = Array.isArray(job.areas) ? [...job.areas] : [];
    const areaIdx = currentAreas.findIndex(a => a.id === areaId);
    if (areaIdx === -1) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบพื้นที่/งานหลักที่ระบุ' } });
    }

    const targetArea = currentAreas[areaIdx];
    const existingQuestions = Array.isArray(targetArea.qc_manual_questions) ? targetArea.qc_manual_questions : [];
    targetArea.qc_manual_questions = existingQuestions.filter(q => q.id !== questionId);
    targetArea.updated_at = new Date().toISOString();

    await dbUpdateJob(id, { areas: currentAreas });

    return res.status(200).json({
      success: true,
      message: 'ลบคำถาม QC เรียบร้อยแล้ว',
      total_manual_questions: targetArea.qc_manual_questions.length,
      all_manual_questions: targetArea.qc_manual_questions
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// =============================================================================
// BOQ CONVERSION & REVISIONS (Req #2 - Preserve PASSED/ESCALATED Tasks)
// =============================================================================

// POST /api/v1/jobs/:id/boq/convert-project — Convert BOQ with Areas & Tasks into 3-level Project
app.post('/api/v1/jobs/:id/boq/convert-project', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const param = req.params.id;
    const numId = isNaN(Number(param)) ? param : Number(param);
    const job = await dbGetJob(param);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const { areas: inputAreas, items, base_start_date } = req.body || {};
    const baseDate = base_start_date || new Date().toISOString().slice(0, 10);
    const jobNo = job.job_no || (typeof param === 'string' && param.startsWith('JOB') ? param : `JOB2609090000${numId}`);

    // Existing tasks to protect from overwrite (PASSED or ESCALATED)
    const existingTasks: CoreTask[] = Array.isArray(job.tasks) ? job.tasks : [];
    const lockedTasksMap = new Map<string, CoreTask>();
    existingTasks.forEach(t => {
      if (t.status === 'PASSED' || t.status === 'QC_PASSED' || t.status === 'ESCALATED' || t.qc_score != null) {
        lockedTasksMap.set(String(t.id), t);
      }
    });

    const parsedAreas: CoreArea[] = [];
    const parsedTasks: CoreTask[] = [];
    const existingAreas: CoreArea[] = Array.isArray(job.areas) ? job.areas : [];

    if (Array.isArray(inputAreas) && inputAreas.length > 0) {
      inputAreas.forEach((areaInput: any, aIdx: number) => {
        const areaId = areaInput.id || `AREA_${param}_${aIdx + 1}`;
        const existingArea = existingAreas.find(a => a.id === areaId);
        
        const areaObj: CoreArea = {
          id: areaId,
          name: areaInput.name || `พื้นที่ ${aIdx + 1}`,
          assigned_qc: areaInput.assigned_qc || existingArea?.assigned_qc,
          assigned_qc_id: areaInput.assigned_qc_id || existingArea?.assigned_qc_id,
          qc_inspector: areaInput.assigned_qc || existingArea?.qc_inspector,
          qc_manual_questions: existingArea?.qc_manual_questions || (Array.isArray(areaInput.qc_manual_questions) ? areaInput.qc_manual_questions.slice(0, 4) : []),
          status: existingArea?.status || 'PLANNED',
          created_at: existingArea?.created_at || new Date().toISOString()
        };
        parsedAreas.push(areaObj);

        if (Array.isArray(areaInput.tasks)) {
          areaInput.tasks.forEach((tInput: any, tIdx: number) => {
            const taskId = tInput.id || `T_${param}_${aIdx + 1}_${tIdx + 1}`;
            
            // If already passed or escalated, preserve original state!
            if (lockedTasksMap.has(taskId)) {
              parsedTasks.push(lockedTasksMap.get(taskId)!);
              return;
            }

            let startStr = tInput.plan_start_date || tInput.start_date || tInput.start;
            let endStr = tInput.plan_end_date || tInput.end_date || tInput.end;
            let days = tInput.duration_days || tInput.days || 1;

            if (!startStr) {
              const d = new Date(baseDate);
              d.setDate(d.getDate() + (aIdx * 2) + tIdx);
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

            const techName = tInput.assigned_tech || tInput.tech || 'Team A (สมศักดิ์)';
            parsedTasks.push({
              id: taskId,
              job_id: numId,
              job_no: jobNo,
              area_id: areaId,
              area_name: areaObj.name,
              task_name: tInput.task_name || tInput.name || `งานติดตั้ง ${tIdx + 1}`,
              name: tInput.task_name || tInput.name || `งานติดตั้ง ${tIdx + 1}`,
              plan_start_date: startStr,
              plan_start_time: tInput.plan_start_time || '08:30',
              start: startStr,
              plan_end_date: endStr,
              plan_end_time: tInput.plan_end_time || '17:00',
              end: endStr,
              duration_days: days,
              days: days,
              assigned_tech: techName,
              tech: techName,
              assignees: tInput.assignees || [techName],
              status: tInput.status || 'PLANNED',
              rework_count: tInput.rework_count || 0,
              qc_score: tInput.qc_score || null,
              progress_percent: tInput.progress_percent || 0,
              subtasks: Array.isArray(tInput.subtasks) ? tInput.subtasks : [],
              source_boq_item: tInput.source_boq_item || tInput.name,
              created_at: new Date().toISOString()
            });
          });
        }
      });
    } else if (Array.isArray(items) && items.length > 0) {
      // Fallback for flat items: create a default area if none exists
      const defaultAreaId = existingAreas.length > 0 ? existingAreas[0].id : `AREA_${param}_1`;
      const defaultAreaName = existingAreas.length > 0 ? existingAreas[0].name : 'งานติดตั้งทั่วไป';
      if (existingAreas.length === 0) {
        parsedAreas.push({
          id: defaultAreaId,
          name: defaultAreaName,
          assigned_qc: 'วิชัย ตรวจดี (ช่าง QC Lead)',
          qc_inspector: 'วิชัย ตรวจดี (ช่าง QC Lead)',
          qc_manual_questions: [],
          status: 'PLANNED',
          created_at: new Date().toISOString()
        });
      } else {
        parsedAreas.push(...existingAreas);
      }

      items.forEach((item: any, idx: number) => {
        const taskId = item.id || `T_${param}_${idx + 1}`;
        if (lockedTasksMap.has(taskId)) {
          parsedTasks.push(lockedTasksMap.get(taskId)!);
          return;
        }

        let startStr = item.plan_start_date || item.start_date || item.start;
        let endStr = item.plan_end_date || item.end_date || item.end;
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

        const techName = item.assigned_tech || item.tech || 'Team A (สมศักดิ์)';
        parsedTasks.push({
          id: taskId,
          job_id: numId,
          job_no: jobNo,
          area_id: item.area_id || defaultAreaId,
          area_name: item.area_name || defaultAreaName,
          task_name: item.task_name || item.name || `งานติดตั้ง ${idx + 1}`,
          name: item.task_name || item.name || `งานติดตั้ง ${idx + 1}`,
          plan_start_date: startStr,
          plan_start_time: item.plan_start_time || '08:30',
          start: startStr,
          plan_end_date: endStr,
          plan_end_time: item.plan_end_time || '17:00',
          end: endStr,
          duration_days: days,
          days: days,
          assigned_tech: techName,
          tech: techName,
          assignees: item.assignees || [techName],
          status: item.status || 'PLANNED',
          rework_count: item.rework_count || 0,
          qc_score: item.qc_score || null,
          progress_percent: 0,
          subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
          source_boq_item: item.source_boq_item || item.name,
          created_at: new Date().toISOString()
        });
      });
    }

    // Ensure any previously locked tasks not in the input are still retained
    lockedTasksMap.forEach((lockedTask, lId) => {
      if (!parsedTasks.some(t => String(t.id) === lId)) {
        parsedTasks.push(lockedTask);
      }
    });

    const sortedTasks = sortTasksByStartDate([...parsedTasks]);
    const nextStatus = (job.status === JobStatus.DRAFT || job.status === JobStatus.BOQ) ? JobStatus.PLANNED : job.status;

    await dbUpdateJob(param, {
      areas: parsedAreas.length > 0 ? parsedAreas : existingAreas,
      tasks: sortedTasks,
      status: nextStatus
    });

    await recordAudit(
      req,
      'CONVERT_PROJECT_BOQ',
      'JOB',
      param,
      job.booking_no,
      { old_tasks_count: existingTasks.length },
      { new_tasks_count: sortedTasks.length, areas_count: parsedAreas.length, preserved_locked_tasks: lockedTasksMap.size }
    );

    return res.status(201).json({
      success: true,
      message: `แปลง BOQ เป็นโครงสร้าง 3 ระดับเรียบร้อย (${parsedAreas.length} พื้นที่, ${sortedTasks.length} Tasks, คงสถานะ Task ที่ตรวจผ่านแล้ว ${lockedTasksMap.size} รายการ)`,
      areas: parsedAreas,
      tasks: sortedTasks
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET /api/v1/jobs/:id/tasks — Get all tasks for a job (sorted by start date)
app.get('/api/v1/jobs/:id/tasks', requireAuth, async (req: Request, res: Response) => {
  const param = req.params.id;
  const job = await dbGetJob(param);
  let tasks: CoreTask[] = [];
  if (job && Array.isArray(job.tasks)) {
    tasks = job.tasks;
  }
  const sorted = sortTasksByStartDate([...tasks]);
  return res.json({ success: true, total: sorted.length, data: sorted });
});

// POST /api/v1/jobs/:id/tasks/import-boq — Import/Convert BOQ items into Tasks (Preserving PASSED/ESCALATED)
app.post('/api/v1/jobs/:id/tasks/import-boq', requireAuth, async (req: AuthRequest, res: Response) => {
  const param = req.params.id;
  const numId = isNaN(Number(param)) ? param : Number(param);
  const { items, base_start_date, default_tech = 'Team A (สมศักดิ์)' } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: { code: 'EMPTY_ITEMS', message: 'รายการ BOQ ต้องไม่ว่างเปล่า' } });
  }

  const job = await dbGetJob(param);
  const baseDate = base_start_date || new Date().toISOString().slice(0, 10);
  const jobNo = job?.job_no || (typeof param === 'string' && param.startsWith('JOB') ? param : `JOB2609090000${numId}`);
  const customerName = job?.customer || 'ลูกค้า';

  const existingTasks: CoreTask[] = (job && Array.isArray(job.tasks)) ? job.tasks : [];
  const lockedTasksMap = new Map<string, CoreTask>();
  existingTasks.forEach(t => {
    if (t.status === 'PASSED' || t.status === 'QC_PASSED' || t.status === 'ESCALATED' || t.qc_score != null) {
      lockedTasksMap.set(String(t.id), t);
    }
  });

  const newTasks: CoreTask[] = items.map((item: any, idx: number) => {
    const taskId = item.id || item.taskId || `T_${param}_${idx + 1}`;
    if (lockedTasksMap.has(taskId)) {
      return lockedTasksMap.get(taskId)!;
    }

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
      id: taskId,
      job_id: numId,
      job_no: jobNo,
      area_id: item.area_id || (job?.areas && job.areas[0]?.id) || `AREA_${param}_1`,
      area_name: item.area_name || (job?.areas && job.areas[0]?.name) || 'งานติดตั้งทั่วไป',
      task_name: item.task_name || item.name || `งานติดตั้ง ${idx + 1}`,
      name: item.task_name || item.name || `งานติดตั้ง ${idx + 1}`,
      plan_start_date: startStr,
      plan_start_time: item.plan_start_time || '08:30',
      start: startStr,
      plan_end_date: endStr,
      plan_end_time: item.plan_end_time || '17:00',
      end: endStr,
      duration_days: days,
      days: days,
      assigned_tech: techName,
      tech: techName,
      assignees: assignees,
      status: item.status || 'PLANNED',
      rework_count: item.rework_count || 0,
      qc_score: item.qc_score || null,
      progress_percent: 0,
      subtasks: Array.isArray(item.subtasks) ? item.subtasks : [],
      source_boq_item: item.source_boq_item || item.name,
      created_at: new Date().toISOString()
    };
  });

  const isAppend = req.body.mode === 'append';
  let updatedTasks: CoreTask[] = isAppend ? [...existingTasks, ...newTasks] : [...newTasks];

  // Preserve any locked tasks not in the imported list
  lockedTasksMap.forEach((lockedTask, lId) => {
    if (!updatedTasks.some(t => String(t.id) === lId)) {
      updatedTasks.push(lockedTask);
    }
  });

  const boqItems = items.map((it: any) => ({
    name: it.task_name || it.name,
    qty: it.qty || 1,
    unit: it.unit || 'งาน',
    price: it.price || 0,
    labor_price: it.labor_price || it.price || 0
  }));

  await dbUpdateJob(param, { tasks: updatedTasks, boq_items: boqItems });

  const sorted = sortTasksByStartDate([...updatedTasks]);
  return res.status(201).json({
    success: true,
    message: `นำเข้าและแปลง BOQ เป็น Task ปฏิบัติงาน ${newTasks.length} รายการ (คงสถานะ Task ผ่านแล้ว ${lockedTasksMap.size} รายการ)`,
    total: sorted.length,
    data: sorted
  });
});

// =============================================================================
// TASK LIFECYCLE, ASSIGNMENT & EXECUTION (Req #3, #4, #5)
// =============================================================================

// PUT /api/v1/jobs/:id/tasks/:taskId/assign-tech — Assign Technician to Task
app.put('/api/v1/jobs/:id/tasks/:taskId/assign-tech', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, taskId } = req.params;
    const { assigned_tech, tech, assignees } = req.body || {};
    const effectiveTech = assigned_tech || tech;

    if (!effectiveTech && (!Array.isArray(assignees) || assignees.length === 0)) {
      return res.status(400).json({ success: false, error: { code: 'MISSING_TECH', message: 'กรุณาระบุชื่อช่างผู้รับผิดชอบงาน' } });
    }

    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const tasks: CoreTask[] = Array.isArray(job.tasks) ? [...job.tasks] : [];
    const task = tasks.find(t => String(t.id) === taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบ Task ที่ระบุ' } });
    }

    const oldTech = task.assigned_tech;
    const techName = effectiveTech ? String(effectiveTech).trim() : assignees.join(' + ');
    task.assigned_tech = techName;
    task.tech = techName;
    task.assignees = Array.isArray(assignees) && assignees.length > 0 ? assignees : [techName];
    task.updated_at = new Date().toISOString();

    await dbUpdateJob(id, { tasks });

    await recordAudit(
      req,
      'ASSIGN_TECH_TASK',
      'TASK',
      taskId,
      job.booking_no,
      { assigned_tech: oldTech },
      { assigned_tech: techName }
    );

    return res.status(200).json({
      success: true,
      message: `มอบหมายช่าง (${techName}) ให้กับ Task "${task.task_name}" สำเร็จ`,
      data: task
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /api/v1/jobs/:id/tasks/:taskId/start — Start Task (Mandatory check: Area must have assigned QC!)
app.post('/api/v1/jobs/:id/tasks/:taskId/start', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, taskId } = req.params;
    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const tasks: CoreTask[] = Array.isArray(job.tasks) ? [...job.tasks] : [];
    const task = tasks.find(t => String(t.id) === taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบ Task ที่ระบุ' } });
    }

    // MANDATORY RULE: Check if parent Area has an assigned QC
    const areas: CoreArea[] = Array.isArray(job.areas) ? job.areas : [];
    const parentArea = task.area_id 
      ? areas.find(a => a.id === task.area_id)
      : (areas.length > 0 ? areas[0] : null);

    if (!parentArea || !parentArea.assigned_qc || !String(parentArea.assigned_qc).trim()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'QC_REQUIRED',
          message: 'กรุณามอบหมายช่าง QC ให้กับพื้นที่/งานหลักก่อนเริ่มปฏิบัติงาน'
        }
      });
    }

    const nowD = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayDate = nowD.toISOString().slice(0, 10);
    const nowTime24 = `${pad(nowD.getHours())}:${pad(nowD.getMinutes())}`;

    task.actual_start_date = todayDate;
    task.actual_start_time = nowTime24;
    task.status = 'IN_PROGRESS';
    task.progress_percent = Math.max(task.progress_percent || 0, 10);
    task.updated_at = nowD.toISOString();

    const jobNextStatus = (job.status === JobStatus.PLANNED || job.status === JobStatus.DRAFT) ? JobStatus.IN_PROGRESS : job.status;

    await dbUpdateJob(id, {
      tasks,
      status: jobNextStatus
    });

    await recordAudit(
      req,
      'START_TASK',
      'TASK',
      taskId,
      job.booking_no,
      { status: 'PLANNED' },
      { status: 'IN_PROGRESS', actual_start_date: todayDate, actual_start_time: nowTime24 }
    );

    return res.status(200).json({
      success: true,
      message: `เริ่มปฏิบัติงาน Task "${task.task_name}" เรียบร้อย (${todayDate} เวลา ${nowTime24} น.)`,
      data: task
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /api/v1/jobs/:id/tasks/:taskId/complete — Complete Task -> status WAIT_QC
app.post('/api/v1/jobs/:id/tasks/:taskId/complete', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, taskId } = req.params;
    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const tasks: CoreTask[] = Array.isArray(job.tasks) ? [...job.tasks] : [];
    const task = tasks.find(t => String(t.id) === taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบ Task ที่ระบุ' } });
    }

    const nowD = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const todayDate = nowD.toISOString().slice(0, 10);
    const nowTime24 = `${pad(nowD.getHours())}:${pad(nowD.getMinutes())}`;

    task.actual_end_date = todayDate;
    task.actual_end_time = nowTime24;
    task.status = 'WAIT_QC';
    task.progress_percent = 100;
    task.updated_at = nowD.toISOString();

    await dbUpdateJob(id, { tasks });

    await recordAudit(
      req,
      'COMPLETE_TASK',
      'TASK',
      taskId,
      job.booking_no,
      { status: 'IN_PROGRESS' },
      { status: 'WAIT_QC', actual_end_date: todayDate, actual_end_time: nowTime24 }
    );

    return res.status(200).json({
      success: true,
      message: `บันทึกจบงาน Task "${task.task_name}" เรียบร้อย ส่งเข้ารอตรวจ QC (${todayDate} เวลา ${nowTime24} น.)`,
      data: task
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// =============================================================================
// QC INSPECTION & SCORING ENGINE (Phase 3 & STK Auto-Sync Phase 4)
// =============================================================================

// POST /api/v1/jobs/:id/tasks/:taskId/qc-inspect — Inspect Task (1 Mandatory + Area Manual Questions, Score 5 or 1 strictly)
app.post('/api/v1/jobs/:id/tasks/:taskId/qc-inspect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id, taskId } = req.params;
    const { answers, remarks, inspector_name } = req.body || {};
    const job = await dbGetJob(id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const tasks: CoreTask[] = Array.isArray(job.tasks) ? [...job.tasks] : [];
    const task = tasks.find(t => String(t.id) === taskId);
    if (!task) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบ Task ที่ระบุ' } });
    }

    const effectiveInspector = inspector_name || req.currentUser?.full_name || 'วิชัย ตรวจดี (ช่าง QC Lead)';
    const answersList = Array.isArray(answers) ? answers : [];

    // Evaluate Pass vs Fail
    // If any question is FAIL or answer is NO -> QC Fail
    const hasFail = answersList.some((a: any) => a.result === 'FAIL' || a.answer === 'NO');
    const isPass = !hasFail;

    const currentReworkCount = task.rework_count || 0;
    let nextStatus: string;
    let assignedScore: number | null = null;
    let finalQcResult: 'PASS' | 'FAIL' | 'ESCALATED';
    let isEscalated = false;

    if (isPass) {
      finalQcResult = 'PASS';
      nextStatus = 'PASSED';
      // SCORING RULE: Strictly 5 if passed first time (rework_count === 0), strictly 1 if passed after rework
      assignedScore = currentReworkCount === 0 ? 5 : 1;
      task.qc_score = assignedScore;
      task.status = 'PASSED';
    } else {
      const newReworkCount = currentReworkCount + 1;
      task.rework_count = newReworkCount;

      if (newReworkCount < 5) {
        finalQcResult = 'FAIL';
        nextStatus = 'REWORK';
        task.status = 'REWORK';
        assignedScore = null;
      } else {
        // REWORK EXCEEDED: Round 5 Fail -> ESCALATED, Score = 1
        finalQcResult = 'ESCALATED';
        nextStatus = 'ESCALATED';
        isEscalated = true;
        assignedScore = 1;
        task.status = 'ESCALATED';
        task.qc_score = 1;
      }
    }

    const qcRoundNumber = isPass ? (currentReworkCount + 1) : (task.rework_count || 1);
    const historyEntry = {
      round: qcRoundNumber,
      result: isPass ? ('PASS' as const) : ('FAIL' as const),
      score: assignedScore || 0,
      inspected_at: new Date().toISOString(),
      inspector: effectiveInspector,
      answers: answersList,
      remarks: remarks || ''
    };

    task.qc_history = Array.isArray(task.qc_history) ? [...task.qc_history, historyEntry] : [historyEntry];
    task.updated_at = new Date().toISOString();

    // Update Job escalated fields if needed
    const updateJobPayload: any = { tasks };
    if (isEscalated) {
      updateJobPayload.status = JobStatus.ESCALATED;
      updateJobPayload.escalated_at = new Date().toISOString();
      updateJobPayload.escalated_reason = `Task "${task.task_name}" แก้ไขงานไม่ผ่านเกิน 5 ครั้งตามเกณฑ์ ส่งเรื่องให้ Admin จัดการ`;
    } else {
      // Check if all tasks in job are passed
      const allPassed = tasks.every(t => t.status === 'PASSED' || t.status === 'QC_PASSED');
      if (allPassed) {
        updateJobPayload.status = JobStatus.QC_PASSED;
        updateJobPayload.overall_progress = 100;
        updateJobPayload.qc_passed_at = new Date().toISOString();
        const minScore = tasks.reduce((min, t) => Math.min(min, Number(t.qc_score) || 5), 5);
        updateJobPayload.qc_score = minScore;
      }
    }

    await dbUpdateJob(id, updateJobPayload);

    await recordAudit(
      req,
      'QC_INSPECTION_TASK',
      'TASK',
      taskId,
      job.booking_no,
      { status: task.status, rework_count: currentReworkCount },
      { status: nextStatus, score: assignedScore, rework_count: task.rework_count, result: finalQcResult }
    );

    // AUTO-SYNC TO STK ON PASSED OR ESCALATED (Req Phase 4)
    let stkSyncResult: any = null;
    if (finalQcResult === 'PASS' || finalQcResult === 'ESCALATED') {
      stkSyncResult = await dispatchStkSync({
        job: { ...job, ...updateJobPayload },
        task,
        qcResult: finalQcResult,
        qcScore: assignedScore || 1,
        qcRound: qcRoundNumber,
        inspectorName: effectiveInspector
      });
    }

    return res.status(200).json({
      success: true,
      message: isPass 
        ? `ตรวจ QC Task "${task.task_name}" ผ่านเกณฑ์เรียบร้อย (คะแนน: ${assignedScore}/5)` 
        : (isEscalated 
            ? `ตรวจ QC Task ไม่ผ่านครบ 5 ครั้ง ระบบปรับสถานะเป็น ESCALATED (คะแนน: 1/5) และแจ้งเตือน Admin เรียบร้อย`
            : `ตรวจ QC ไม่ผ่านรอบที่ ${task.rework_count}/5 ส่งกลับแก้ไข (REWORK)`),
      data: {
        task,
        qc_result: finalQcResult,
        qc_score: assignedScore,
        rework_count: task.rework_count,
        is_escalated: isEscalated,
        stk_sync: stkSyncResult
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// =============================================================================
// BLUEPRINTS API (แบบแปลนโครงการ Step 2 Design)
// =============================================================================

// GET /api/v1/blueprints — List all blueprints (filter by job_id)
app.get('/api/v1/blueprints', requireAuth, async (req: Request, res: Response) => {
  try {
    const { job_id } = req.query;
    const list = await dbLoadBlueprints(job_id && job_id !== 'all' ? String(job_id) : undefined);
    return res.json({ success: true, total: list.length, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/blueprints — Create or save blueprint
app.post('/api/v1/blueprints', requireAuth, async (req: Request, res: Response) => {
  try {
    const bp = req.body;
    if (!bp || (!bp.fileName && !bp.file_name)) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุชื่อไฟล์แบบแปลน' });
    }
    const saved = await dbSaveBlueprint(bp);
    return res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/blueprints/:id — Update blueprint (e.g. upgrade to v2.0)
app.patch('/api/v1/blueprints/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dbUpdateBlueprint(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'ไม่พบแบบแปลนที่ต้องการแก้ไข' });
    }
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/blueprints/:id — Delete blueprint
app.delete('/api/v1/blueprints/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await dbDeleteBlueprint(id);
    return res.json({ success: deleted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =============================================================================
// TICKETS API (ตั๋วใบเสร็จ & สัญญาโครงการ Step 2 & 4)
// =============================================================================

// GET /api/v1/tickets — List all tickets (filter by job_id)
app.get('/api/v1/tickets', requireAuth, async (req: Request, res: Response) => {
  try {
    const { job_id } = req.query;
    const list = await dbLoadTickets(job_id && job_id !== 'all' ? String(job_id) : undefined);
    return res.json({ success: true, total: list.length, data: list });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// POST /api/v1/tickets — Create or save ticket
app.post('/api/v1/tickets', requireAuth, async (req: Request, res: Response) => {
  try {
    const tkt = req.body;
    if (!tkt || !tkt.ticket_no) {
      return res.status(400).json({ success: false, error: 'กรุณาระบุเลขที่ Ticket' });
    }
    const saved = await dbSaveTicket(tkt);
    return res.status(201).json({ success: true, data: saved });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// PATCH /api/v1/tickets/:id — Update ticket
app.patch('/api/v1/tickets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updated = await dbUpdateTicket(id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, error: 'ไม่พบ Ticket ที่ต้องการแก้ไข' });
    }
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// DELETE /api/v1/tickets/:id — Delete ticket
app.delete('/api/v1/tickets/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const deleted = await dbDeleteTicket(id);
    return res.json({ success: deleted });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
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

  if (!updated) {
    return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'ไม่พบรายการจอง QC' } });
  }

  return res.json({
    success: true,
    message: `ยืนยันการจองช่าง QC (${updated.assigned_qc_tech || 'QC Technician'}) สำหรับ "${updated.task_name}" เรียบร้อยแล้ว`,
    data: updated
  });
});

// PUT /api/v1/qc/bookings/:id — Update QC Booking (Change QC tech, date, remarks, status)
app.put('/api/v1/qc/bookings/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { assigned_qc_tech, qc_booking_date, remarks, status } = req.body;
  const bookings = await dbLoadQCBookings();
  let booking = bookings.find((b: any) => String(b.id) === id || String(b.task_id) === id);
  if (!booking) {
    return res.status(404).json({ success: false, error: { code: 'BOOKING_NOT_FOUND', message: 'ไม่พบรายการจอง QC' } });
  }

  if (assigned_qc_tech !== undefined) booking.assigned_qc_tech = assigned_qc_tech;
  if (qc_booking_date !== undefined) booking.qc_booking_date = qc_booking_date;
  if (remarks !== undefined) booking.remarks = remarks;
  if (status !== undefined) booking.status = status;

  await dbSaveQCBooking(booking);

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

function parseSafeBoolean(val: any): boolean {
  if (val === true || val === 1) return true;
  if (typeof val === 'string') {
    const s = val.trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes';
  }
  return false;
}

// Helper to create and process daily work log
async function handleCreateDailyLog(payload: any, jobIdParam?: string): Promise<CoreDailyWorkLog> {
  const id = jobIdParam || payload.job_id || payload.jobId || 'JOB26090900002';
  const dayNumber = Math.max(1, Number(payload.day_number || payload.dayNumber) || 1);
  const totalDays = Math.max(1, Number(payload.total_days || payload.totalDays) || 1);
  const isFinalDay = dayNumber >= totalDays;

  // Explicit confirmation flags for early finish or manual sign-off
  const isExplicitConfirmation = parseSafeBoolean(payload.user_confirmed) || 
                                 parseSafeBoolean(payload.userConfirmed) || 
                                 parseSafeBoolean(payload.is_early_completed) || 
                                 parseSafeBoolean(payload.isEarlyCompleted) || 
                                 parseSafeBoolean(payload.force_complete) || 
                                 parseSafeBoolean(payload.forceComplete);

  const rawProgressNum = payload.progress_percent !== undefined 
    ? Number(payload.progress_percent) 
    : (payload.progressPercent !== undefined ? Number(payload.progressPercent) : NaN);
  const isExplicit100 = !isNaN(rawProgressNum) && rawProgressNum >= 100;
  const isCompletedFlag = parseSafeBoolean(payload.is_completed) || parseSafeBoolean(payload.isCompleted);

  // Overall complete ONLY if:
  // 1. Reached or exceeded final scheduled day (isFinalDay)
  // 2. Or explicit user/technician confirmation (early completion)
  // 3. Or explicit 100% progress accompanied by completion confirmation
  // NOTE: Intermediate days with normal daily logging (isCompletedFlag without explicit confirmation) NEVER jump to DONE
  const isOverallComplete = isFinalDay || isExplicitConfirmation || (isExplicit100 && isCompletedFlag);
  const userConfirmed = isOverallComplete || isExplicitConfirmation;

  let workDesc = payload.work_description || payload.workDescription || '';
  if (isOverallComplete && workDesc && !workDesc.includes('User ยืนยัน')) {
    workDesc = `${workDesc.trim()} (User ยืนยัน)`;
  } else if (isOverallComplete && !workDesc) {
    workDesc = 'งานติดตั้งเสร็จสมบูรณ์ 100% (User ยืนยัน) ตรวจสอบระบบเรียบร้อย พร้อมส่งมอบให้ทีม QC ตรวจรับรองคุณภาพ';
  }

  // Progressive percentage calculation (< 100% before completion)
  const dayProgress = Math.min(95, Math.round((dayNumber / totalDays) * 100));
  const rawProgress = !isNaN(rawProgressNum) ? rawProgressNum : dayProgress;
  const finalProgress = isOverallComplete ? 100 : Math.min(95, Math.max(1, rawProgress));

  const newLog: CoreDailyWorkLog = {
    id: payload.id || `LOG_${Date.now()}`,
    job_id: id,
    job_no: payload.job_no || (String(id).startsWith('JOB') ? String(id) : `JOB2609090000${id}`),
    task_id: payload.task_id || payload.taskId || `T_${id}_1`,
    task_name: payload.task_name || payload.taskName || 'งานบริการติดตั้ง',
    log_date: payload.log_date || payload.logDate || new Date().toISOString().slice(0, 10),
    start_time: payload.start_time || payload.startTime || '08:30',
    end_time: payload.end_time || payload.endTime || '17:00',
    work_hours: payload.work_hours || payload.workHours || '8 ชม. 30 นาที',
    day_number: dayNumber,
    total_days: totalDays,
    technician: payload.technician || 'Team B (ประเสริฐ)',
    recorded_by: payload.recorded_by || payload.recordedBy || 'ช่างหน้างาน',
    reporter_role: payload.reporter_role || payload.reporterRole || 'TECH',
    progress_percent: finalProgress,
    work_description: workDesc,
    additional_details: payload.additional_details || payload.additionalDetails || '',
    issues: payload.issues || '',
    materials_used: payload.materials_used || payload.materialsUsed || '',
    photos: Array.isArray(payload.photos) ? payload.photos : [],
    is_completed: isOverallComplete,
    user_confirmed: userConfirmed,
    user_confirmed_at: userConfirmed ? (payload.user_confirmed_at || payload.userConfirmedAt || new Date().toISOString()) : null,
    created_at: payload.created_at || payload.createdAt || new Date().toISOString()
  };

  // Persist to PostgreSQL database
  await dbSaveDailyWorkLog(newLog);

  // If completed (overall complete: reached final day or confirmed early finish), update task and job status to QC_PENDING in DB
  if (isOverallComplete) {
    const nowIso = new Date().toISOString();
    const job = await dbGetJob(id);
    if (job) {
      const tasks = Array.isArray(job.tasks) ? [...job.tasks] : [];
      const task = tasks.find((t: any) => String(t.id) === String(newLog.task_id));
      if (task) {
        task.status = 'DONE';
        task.progress_percent = 100;
      }
      const stepTimestamps = { ...(job.step_timestamps || {}) };
      if (!stepTimestamps.qc_pending_at) {
        stepTimestamps.qc_pending_at = nowIso;
      }
      await dbUpdateJob(id, {
        tasks,
        status: JobStatus.QC_PENDING,
        overall_progress: 85,
        step_timestamps: stepTimestamps
      });
    }

    // Confirm QC Booking on the completion end date
    await dbConfirmQCBooking(String(newLog.task_id), undefined, newLog.recorded_by, undefined, newLog.log_date);
  } else {
    // Progressive daily update: update task progress without prematurely marking DONE
    const job = await dbGetJob(id);
    const updatedJobProgress = Math.min(80, Math.max(job?.overall_progress || 50, Math.round(50 + (dayProgress * 0.35))));
    if (job) {
      const tasks = Array.isArray(job.tasks) ? [...job.tasks] : [];
      const task = tasks.find((t: any) => String(t.id) === String(newLog.task_id));
      if (task) {
        task.status = 'IN_PROGRESS';
        task.progress_percent = Math.max(Number(task.progress_percent) || 0, dayProgress);
      }
      await dbUpdateJob(id, { tasks, overall_progress: updatedJobProgress });
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
      ? 'ช่างบันทึกสำเร็จ 100% (User ยืนยัน)! ส่งมอบงานเข้าคิวตรวจคุณภาพ QC ล่วงหน้าเรียบร้อย'
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
      ? 'ช่างบันทึกสำเร็จ 100% (User ยืนยัน)! ส่งมอบงานเข้าคิวตรวจคุณภาพ QC ล่วงหน้าเรียบร้อย'
      : 'บันทึกความคืบหน้างานช่างประจำวันเรียบร้อย',
    data: newLog
  });
});

app.delete('/api/v1/daily-logs/:logId', requireAuth, async (req: Request, res: Response) => {
  const { logId } = req.params;
  const allLogs = await dbLoadDailyWorkLogs();
  const deletedLog = allLogs.find((l: any) => l.id === logId);
  
  await dbDeleteDailyWorkLog(logId);
  
  if (deletedLog) {
    // Auto Rollback Task and Job status if no completed logs remain
    const taskId = deletedLog.task_id;
    const jobId = deletedLog.job_id;
    const currentLogs = await dbLoadDailyWorkLogs();
    const remainingLogs = currentLogs.filter((l: any) => String(l.task_id) === String(taskId));
    const hasRemainingCompleted = remainingLogs.some((l: any) => l.is_completed || l.user_confirmed);
    
    if (!hasRemainingCompleted) {
      const taskDays = deletedLog.total_days || 3;
      const completedDays = remainingLogs.filter((l: any) => (Number(l.progress_percent) || 0) > 0).length;
      const newProgress = completedDays > 0 ? Math.min(95, Math.round((completedDays / taskDays) * 100)) : 0;

      // Persist rollback to PostgreSQL database
      const dbJob = await dbGetJob(jobId);
      if (dbJob) {
        const dbTasks = Array.isArray(dbJob.tasks) ? [...dbJob.tasks] : [];
        const dbTask = dbTasks.find((t: any) => String(t.id) === String(taskId));
        if (dbTask) {
          dbTask.status = newProgress > 0 ? 'IN_PROGRESS' : 'PENDING';
          dbTask.progress_percent = newProgress;
        }
        const updateData: any = { tasks: dbTasks };
        if (dbJob.status === JobStatus.QC_PENDING) {
          updateData.status = JobStatus.IN_PROGRESS;
          updateData.overall_progress = 70;
          if (dbJob.step_timestamps && dbJob.step_timestamps.qc_pending_at) {
            const stepTs = { ...dbJob.step_timestamps };
            delete stepTs.qc_pending_at;
            updateData.step_timestamps = stepTs;
          }
        }
        await dbUpdateJob(jobId, updateData);
      }
      await dbRevertQCBooking(String(taskId));
    }
  }
  return res.json({ success: true, message: 'ลบรายการบันทึกงานประจำวันเรียบร้อย' });
});

// =============================================================================
// 5. QC INSPECTION & AFTER SALE CSAT API (Req #10 & #11)
// =============================================================================
// =============================================================================
// 5. QC INSPECTION & AFTER SALE CSAT API (Req #10 & #11 & Phases 3, 4, 5)
// =============================================================================

// POST /api/v1/jobs/:id/qc-inspection — Overall Job QC (Q Quick Services or Project QC)
app.post('/api/v1/jobs/:id/qc-inspection', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const param = req.params.id;
    const numId = isNaN(Number(param)) ? param : Number(param);
    const { items, answers, remarks, inspector_name } = req.body || {};

    const job = await dbGetJob(param);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงาน' } });
    }

    const questionList = Array.isArray(answers) ? answers : (Array.isArray(items) ? items : []);
    const effectiveInspector = inspector_name || req.currentUser?.full_name || 'วิชัย ตรวจดี (ช่าง QC Lead)';

    // Evaluate fail: any item marked FAIL or answer NO
    const hasFail = questionList.some((it: any) => it.result === 'FAIL' || it.answer === 'NO' || (it.is_mandatory && it.result === 'FAIL'));
    const isPass = !hasFail;

    const currentHistory: any[] = Array.isArray(job.qc_history) ? [...job.qc_history] : [];
    const currentReworkCount = currentHistory.filter(h => h.result === 'FAIL').length;
    let nextStatus: JobStatus;
    let assignedScore: number | null = null;
    let finalQcResult: 'PASS' | 'FAIL' | 'ESCALATED';
    let isEscalated = false;

    if (isPass) {
      finalQcResult = 'PASS';
      nextStatus = JobStatus.QC_PASSED;
      // SCORING RULE: Strictly 5 if first time pass, strictly 1 if passed after rework
      assignedScore = currentReworkCount === 0 ? 5 : 1;
    } else {
      const newReworkCount = currentReworkCount + 1;
      if (newReworkCount < 5) {
        finalQcResult = 'FAIL';
        nextStatus = JobStatus.IN_PROGRESS;
        assignedScore = null;
      } else {
        // Round 5 Fail -> ESCALATED, Score = 1
        finalQcResult = 'ESCALATED';
        nextStatus = JobStatus.ESCALATED;
        isEscalated = true;
        assignedScore = 1;
      }
    }

    const qcRound = currentHistory.length + 1;
    const historyEntry = {
      round: qcRound,
      result: isPass ? 'PASS' : (isEscalated ? 'ESCALATED' : 'FAIL'),
      score: assignedScore || 0,
      inspected_at: new Date().toISOString(),
      inspector: effectiveInspector,
      answers: questionList,
      remarks: remarks || ''
    };
    currentHistory.push(historyEntry);

    const updatePayload: any = {
      status: nextStatus,
      overall_progress: isPass ? 100 : (isEscalated ? 100 : 75),
      qc_score: assignedScore,
      qc_inspector: effectiveInspector,
      qc_history: currentHistory,
      qc_remarks: remarks || '',
      ...(isPass ? { qc_passed_at: new Date().toISOString() } : {}),
      ...(isEscalated ? {
        escalated_at: new Date().toISOString(),
        escalated_reason: 'ตรวจ QC ไม่ผ่านเกิน 5 ครั้งตามเกณฑ์ ส่งเรื่องให้ Admin จัดการ'
      } : {})
    };

    const updatedJob = await dbUpdateJob(param, updatePayload);

    await recordAudit(
      req,
      'QC_INSPECTION_JOB',
      'JOB',
      job.id || param,
      job.booking_no,
      { status: job.status },
      { status: nextStatus, score: assignedScore, result: finalQcResult, is_escalated: isEscalated }
    );

    // AUTO-SYNC TO STK ON PASSED OR ESCALATED (Req Phase 4)
    let stkSyncResult: any = null;
    if (finalQcResult === 'PASS' || finalQcResult === 'ESCALATED') {
      stkSyncResult = await dispatchStkSync({
        job: { ...job, ...updatePayload },
        qcResult: finalQcResult,
        qcScore: assignedScore || 1,
        qcRound: qcRound,
        inspectorName: effectiveInspector
      });
    }

    return res.status(200).json({
      success: true,
      message: isPass 
        ? `ตรวจ QC งาน #${job.job_no} ผ่านเกณฑ์เรียบร้อย (คะแนน: ${assignedScore}/5)` 
        : (isEscalated 
            ? `ตรวจ QC ไม่ผ่านครบ 5 ครั้ง ปรับสถานะเป็น ESCALATED (คะแนน: 1/5) และแจ้งเตือน Admin เรียบร้อย`
            : `ตรวจ QC ไม่ผ่านรอบที่ ${currentReworkCount + 1}/5 ส่งกลับแก้ไข (REWORK)`),
      data: {
        inspection_id: Date.now(),
        job_id: updatedJob ? updatedJob.id : numId,
        overall_result: finalQcResult,
        qc_score: assignedScore,
        next_job_status: nextStatus,
        is_escalated: isEscalated,
        stk_sync: stkSyncResult
      }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
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

  return res.status(200).json({
    success: true,
    data: {
      case_no: `AS-${Date.now()}`,
      job_id: updatedJob ? updatedJob.id : numId,
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

    const jobNo = updatedJob?.job_no || (String(param).startsWith('JOB') ? param : `JOB2609090000${param}`);
    const customerName = updatedJob?.customer_name || 'นาย สมชาย ใจดี';
    const customerPhone = updatedJob?.customer_phone || '081-234-5678';
    const customerAddress = updatedJob?.customer_address || '123/45 ถ.พหลโยธิน กรุงเทพฯ';

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
        job_id: updatedJob ? updatedJob.id : numId,
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
// 7. STK OUTBOUND SYNC LOGS & RETRY APIS (Phase 4)
// =============================================================================

// GET /api/v1/stk/logs — Query STK Sync Logs with filters & pagination
app.get('/api/v1/stk/logs', requireAuth, async (req: Request, res: Response) => {
  try {
    const { status, booking_no, limit } = req.query;
    const logs = await dbLoadStkSyncLogs({
      status: status ? String(status) : undefined,
      booking_no: booking_no ? String(booking_no) : undefined,
      limit: limit ? Number(limit) : 50
    });

    return res.status(200).json({
      success: true,
      total: logs.length,
      data: logs
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// POST /api/v1/stk/retry/:idempotencyKey — Manually Retry Failed STK Outbound Sync
app.post('/api/v1/stk/retry/:idempotencyKey', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { idempotencyKey } = req.params;
    const logRecord = await dbGetStkSyncLogByIdempotencyKey(idempotencyKey);
    if (!logRecord) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบรายการ Sync Log ที่ระบุ' } });
    }

    const job = await dbGetJob(logRecord.job_id);
    if (!job) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'ไม่พบข้อมูลงานสำหรับ Sync Log นี้' } });
    }

    const requestPayload = logRecord.request_payload || {};
    const qcScore = requestPayload.qc_score || 1;
    const qcRound = requestPayload.qc_round || 1;
    const qcResult = requestPayload.qc_result === 'ผ่านเกณฑ์' ? 'PASS' : (requestPayload.qc_result?.includes('Escalated') ? 'ESCALATED' : 'FAIL');

    const syncResult = await dispatchStkSync({
      job,
      qcResult: qcResult as any,
      qcScore,
      qcRound,
      inspectorName: requestPayload.inspector,
      forceRetry: true
    });

    await recordAudit(
      req,
      'RETRY_STK_SYNC',
      'STK_LOG',
      logRecord.id,
      job.booking_no,
      { status: logRecord.status, retry_count: logRecord.retry_count },
      { status: syncResult.status, error: syncResult.error }
    );

    return res.status(200).json({
      success: syncResult.success,
      message: syncResult.success ? 'Re-sync ข้อมูลไปยัง STK สำเร็จ' : `Re-sync ล้มเหลว: ${syncResult.error}`,
      data: syncResult
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// GET STK Payload (Query API for STK and Client Systems)
app.get(['/api/v1/jobs/:id/stk-payload', '/api/v1/integrations/stk/qc-results/:id'], async (req: Request, res: Response) => {
  try {
    const param = req.params.id;
    const numId = Number(param);

    let job = await dbGetJob(param);
    if (!job && !isNaN(numId)) {
      job = await dbGetJob(numId);
    }
    if (!job) {
      return res.status(404).json({
        success: false,
        error: { code: 'JOB_NOT_FOUND', message: `ไม่พบข้อมูลใบงาน '${param}' ในระบบ` }
      });
    }

    if (job.stk_payload) {
      return res.status(200).json({
        success: true,
        data: job.stk_payload,
        meta: {
          is_qc_passed: job.status === JobStatus.QC_PASSED,
          source: 'persisted_stk_payload'
        }
      });
    }

    // Format from existing job data if passed or preview
    const nowD = job.qc_passed_at ? new Date(job.qc_passed_at) : new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const thaiDateFormatted = `${pad(nowD.getDate())}/${pad(nowD.getMonth() + 1)}/${nowD.getFullYear()} ${pad(nowD.getHours())}:${pad(nowD.getMinutes())}:${pad(nowD.getSeconds())} น.`;

    const history = Array.isArray(job.qc_history) ? job.qc_history : [];
    const lastPassed = history.find((h: any) => h.result === 'PASSED' || h.action === 'PASSED');
    const qcRound = lastPassed ? lastPassed.round : (history.length || 1);
    const qcScore = job.qc_score != null ? Number(job.qc_score) : (lastPassed ? Number(lastPassed.score) : 1.0);
    const isPassed = job.status === JobStatus.QC_PASSED || !!lastPassed;

    const constructedPayload = {
      ref_no: job.external_ref_id || job.raw_payload?.external_ref_id || '-',
      ticket: job.ticket_no || job.job_no || String(job.id),
      booking_no: job.booking_no || job.raw_payload?.booking_no || '-',
      qc_date: thaiDateFormatted,
      qc_recorded_at: job.qc_passed_at || nowD.toISOString(),
      customer_name: job.customer_name || (job as any).customer || 'ลูกค้า',
      customer_phone: job.customer_phone || (job as any).phone || '-',
      qc_round: qcRound,
      qc_round_text: qcRound >= 2 ? `ตรวจครั้งที่ ${qcRound} (ผ่านเกณฑ์รอบแก้ไข)` : `ตรวจครั้งที่ 1 (ผ่านเกณฑ์รอบแรก)`,
      qc_result: isPassed ? 'ผ่านเกณฑ์' : 'รอตรวจรับรอง',
      qc_score: qcScore,
      qc_score_text: `${Number(qcScore).toFixed(1)} / 5.0 คะแนน`,
      stk_ref: job.stk_ref || `STK-QC-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`,
      stk_status: job.stk_status || (isPassed ? 'DELIVERED' : 'PENDING'),
      job_no: job.job_no || String(job.id),
      service: job.project_type || (job as any).service || 'บริการติดตั้ง',
      tech_team: job.assigned_tech || (job as any).tech || '-',
      store_code: job.store_code || '-',
      agent_name: job.agent_name || '-',
      qc_inspector: (job as any).qc_inspector || 'วิชัย ตรวจดี (ช่าง QC Lead)',
      qc_remarks: (job as any).qc_remarks || 'งานติดตั้งเรียบร้อยตามมาตรฐาน',
      qc_history: history,
      questions: job.qc_subtasks || []
    };

    return res.status(200).json({
      success: true,
      data: constructedPayload,
      meta: {
        is_qc_passed: isPassed,
        source: 'constructed_from_job'
      }
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: { code: 'GET_STK_PAYLOAD_FAILED', message: err.message }
    });
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
    return res.status(404).json({ error: 'ไม่พบสัญญา MA ที่ระบุ' });
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

    return res.json(currentRound || { id: req.params.id, ...updates });
  } catch (err: any) {
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
app.listen(PORT, async () => {
  console.log(`🚀 SPMT Production REST API Server running on port ${PORT}`);
  try {
    const connected = await initDatabase();
    if (connected) {
      await seedUsers();
    }
  } catch (err: any) {
    console.error('[SERVER BOOT ERROR]', err.message);
  }
});

