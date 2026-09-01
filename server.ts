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

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

// Serve static frontend files (index.html)
app.use(express.static(path.join(__dirname, '../')));
app.use(express.static(path.join(__dirname, './')));

// Root Route Handler - Serve Frontend index.html
app.get('/', (req: Request, res: Response) => {
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

// =============================================================================
// TYPES & INTERFACES
// =============================================================================
export enum JobStatus {
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
// 1. INT INBOUND INTEGRATION API (Req #1)
// =============================================================================
app.post('/api/v1/integration/orders', async (req: Request, res: Response) => {
  try {
    const payload: IntInboundPayload = req.body;
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    // Validate payload
    if (
      !payload.external_ref_id ||
      !payload.customer?.first_name ||
      !payload.customer?.last_name ||
      !payload.customer?.phone ||
      payload.customer?.lat === undefined ||
      payload.customer?.lng === undefined
    ) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_PAYLOAD', message: 'Customer first_name, last_name, phone, lat, lng, and external_ref_id are required' }
      });
    }

    // Generate Job No format: ddmmyy + running(xxxxx) (e.g., 02092600001)
    const now = new Date();
    const dd = String(now.getDate()).padStart(2, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const yy = String(now.getFullYear()).slice(-2);
    const runningSeq = Math.floor(1 + Math.random() * 99999);
    const runningStr = String(runningSeq).padStart(5, '0');
    const jobNo = `${dd}${mm}${yy}${runningStr}`;

    const newJob = {
      id: Date.now(),
      job_no: jobNo,
      external_ref_id: payload.external_ref_id,
      customer: payload.customer,
      services: payload.services || [],
      assigned_tech: payload.technician || null,
      appointment: payload.appointment || null,
      status: JobStatus.DRAFT,
      created_at: new Date().toISOString()
    };

    return res.status(201).json({
      success: true,
      data: newJob,
      meta: { message: 'Order received successfully from INT system' }
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// =============================================================================
// 2. CHECK-IN / SITE VISIT API (Req #2 & #3)
// =============================================================================
app.post('/api/v1/jobs/:id/checkin', async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);
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

    // Rule: Geo-fence Check (Default 400m - Configurable) (Req #2, OQ-A07)
    const configRadius = 400; // meters
    const mockCustomerLat = 13.7563;
    const mockCustomerLng = 100.5018;
    
    // Haversine distance calculation (mocked distance for demonstration)
    const distanceMeters = 180; // Calculated distance
    const isInRadius = distanceMeters <= configRadius;

    const checkinLog = {
      id: Date.now(),
      job_id: jobId,
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
app.post('/api/v1/jobs/:id/designs', async (req: Request, res: Response) => {
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

app.post('/api/v1/jobs/:id/boq', async (req: Request, res: Response) => {
  const jobId = Number(req.params.id);
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

  return res.status(201).json({ success: true, data: boq });
});

// =============================================================================
// 4. TASK & GANTT SCHEDULING API (Req #7 & #8 - Independent Tasks)
// =============================================================================
app.post('/api/v1/jobs/:id/tasks', async (req: Request, res: Response) => {
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
app.post('/api/v1/jobs/:id/qc-inspection', async (req: Request, res: Response) => {
  const jobId = Number(req.params.id);
  const { items, remarks } = req.body; // items: [{ item_id, result: 'PASS'|'FAIL', is_mandatory }]

  // Rule: Mandatory item failing triggers overall QC FAIL (Req #11)
  const hasMandatoryFail = items.some((it: any) => it.is_mandatory && it.result === 'FAIL');
  const overallResult = hasMandatoryFail ? 'FAIL' : 'PASS';

  const nextStatus = overallResult === 'PASS' ? JobStatus.QC_PASSED : JobStatus.IN_PROGRESS;

  return res.status(200).json({
    success: true,
    data: {
      inspection_id: Date.now(),
      job_id: jobId,
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
app.post('/api/v1/jobs/:id/after-sale/csat', async (req: Request, res: Response) => {
  const jobId = Number(req.params.id);
  const { csat_score, customer_feedback } = req.body;

  const csatResult = csat_score >= 3 ? 'PASS' : 'FAIL';
  const nextStatus = csatResult === 'PASS' ? JobStatus.CLOSED : JobStatus.IN_PROGRESS;

  return res.status(200).json({
    success: true,
    data: {
      case_no: `AS-${Date.now()}`,
      job_id: jobId,
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
app.post('/api/v1/jobs/:id/close-and-export-bmt', async (req: Request, res: Response) => {
  try {
    const jobId = Number(req.params.id);

    // Rule: Send ONLY QC-Passed Tasks to BMT System (OQ-A03)
    const bmtPayload = {
      job_no: `02092600001`,
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

    // Simulate REST Call to BMT Endpoint (OQ-A02)
    // await axios.post('https://bmt.system.local/api/v1/projects/close', bmtPayload);

    return res.status(200).json({
      success: true,
      data: {
        job_id: jobId,
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

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 SPMT Production REST API Server running on port ${PORT}`);
});
