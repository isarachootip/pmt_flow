/**
 * PMT Flow v2 API Client Wrapper
 * - Attaches Bearer token from 'pmt_token' (sessionStorage / localStorage)
 * - 10-second timeout enforcement via AbortController
 * - 401 redirect to /v2/login
 * - Friendly Thai error translation
 */

const TOKEN_KEY = 'pmt_token';
const USER_KEY = 'pmt_user';
const DEFAULT_TIMEOUT_MS = 10000;

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  pagination?: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}

export class ApiError extends Error {
  public status: number;
  public code: string;
  public details?: unknown;

  constructor(message: string, status = 500, code = 'UNKNOWN_ERROR', details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * Maps English backend errors / status codes into clear Thai messages
 */
function translateError(code: string, originalMessage?: string, status?: number): string {
  const codeMap: Record<string, string> = {
    INVALID_CREDENTIALS: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง',
    INVALID_PASSWORD: 'รหัสผ่านปัจจุบันไม่ถูกต้อง',
    USER_INACTIVE: 'บัญชีผู้ใช้นี้ถูกปิดการใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
    USER_NOT_FOUND: 'ไม่พบข้อมูลผู้ใช้งานในระบบ',
    UNAUTHORIZED: 'เซสชันการเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
    INVALID_TOKEN: 'โทเค็นยืนยันตัวตนไม่ถูกต้อง กรุณาเข้าสู่ระบบใหม่',
    TOKEN_EXPIRED: 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่อีกครั้ง',
    FORBIDDEN: 'คุณไม่มีสิทธิ์ในการเข้าถึงหรือดำเนินการในส่วนนี้',
    PERMISSION_DENIED: 'คุณไม่มีสิทธิ์ในการทำรายการนี้ตามบทบาท (Role) ของคุณ',
    NOT_FOUND: 'ไม่พบข้อมูลที่ต้องการในระบบ',
    JOB_NOT_FOUND: 'ไม่พบรหัสงานโครงการที่ระบุ',
    VALIDATION_ERROR: 'ข้อมูลที่ส่งมาไม่ถูกต้อง กรุณาตรวจสอบข้อมูลและลองใหม่',
    DUPLICATE_ENTRY: 'มีข้อมูลนี้อยู่ในระบบแล้ว ไม่สามารถสร้างซ้ำได้',
    OUT_OF_GEOFENCE: 'พิกัดของคุณอยู่นอกพื้นที่ทำงาน (เกินรัศมี 400 เมตรที่กำหนด)',
    QC_REQUIREMENTS_NOT_MET: 'ยังไม่สามารถตรวจ QC ได้ เนื่องจากยังมีงานในแผนงานไม่เสร็จสิ้น',
    TIMEOUT: 'การเชื่อมต่อไปยังเซิร์ฟเวอร์หมดเวลา (เกิน 10 วินาที) กรุณาลองใหม่อีกครั้ง',
    NETWORK_ERROR: 'ไม่สามารถติดต่อเซิร์ฟเวอร์ได้ กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต',
    SERVER_ERROR: 'เซิร์ฟเวอร์ขัดข้องภายใน กรุณาติดต่อทีมพัฒนาระบบ',
  };

  if (code && codeMap[code]) {
    return codeMap[code];
  }

  if (status === 401) return 'เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่';
  if (status === 403) return 'คุณไม่มีสิทธิ์ในการเข้าถึงข้อมูลนี้';
  if (status === 404) return 'ไม่พบข้อมูลในระบบ';
  if (status === 500) return 'เซิร์ฟเวอร์เกิดข้อผิดพลาด กรุณาลองใหม่';

  return originalMessage || 'เกิดข้อผิดพลาดในการประมวลผลคำขอ';
}

/**
 * Retrieves the stored authentication token
 */
export function getStoredToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

/**
 * Saves auth token to storage
 */
export function setStoredToken(token: string, persist = false): void {
  if (typeof window === 'undefined') return;
  if (persist) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
  }
}

/**
 * Clears authentication session and redirects to login
 */
export function handleUnauthorized(): void {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  const currentPath = window.location.pathname;
  if (!currentPath.includes('/login')) {
    window.location.replace('/v2/login');
  }
}

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

interface RawApiResponse {
  success?: boolean;
  data?: unknown;
  message?: string;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

/**
 * Centralized Fetch Wrapper
 */
export async function apiFetch<T = unknown>(endpoint: string, options: RequestOptions = {}): Promise<T> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, skipAuth = false, headers = {}, ...restOptions } = options;

  // Prefix URL if relative
  let url = endpoint;
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    if (!url.startsWith('/')) url = '/' + url;
  }

  // Setup abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  // Setup headers
  const reqHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  // Content-Type default (only for non-FormData)
  if (!(restOptions.body instanceof FormData) && !reqHeaders['Content-Type']) {
    reqHeaders['Content-Type'] = 'application/json';
  }

  // Attach token
  if (!skipAuth) {
    const token = getStoredToken();
    if (token && !reqHeaders['Authorization']) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, {
      ...restOptions,
      headers: reqHeaders,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Handle 401 Unauthorized immediately
    if (response.status === 401) {
      handleUnauthorized();
      throw new ApiError('เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่', 401, 'UNAUTHORIZED');
    }

    // Parse JSON
    let json: RawApiResponse;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      json = (await response.json()) as RawApiResponse;
    } else {
      const text = await response.text();
      try {
        json = JSON.parse(text) as RawApiResponse;
      } catch {
        json = { success: response.ok, message: text };
      }
    }

    // Check response status
    if (!response.ok) {
      const errorCode = json?.error?.code || `HTTP_${response.status}`;
      const errorMsg = translateError(errorCode, json?.error?.message || json?.message, response.status);
      throw new ApiError(errorMsg, response.status, errorCode, json?.error?.details || json);
    }

    // Handle standard { success: true, data: ... } wrapper
    if (json && typeof json === 'object' && 'success' in json) {
      if (json.success === false) {
        const code = json.error?.code || 'OPERATION_FAILED';
        const msg = translateError(code, json.error?.message, response.status);
        throw new ApiError(msg, response.status, code, json.error?.details);
      }
      return (json.data !== undefined ? json.data : json) as T;
    }

    return json as unknown as T;
  } catch (err: unknown) {
    clearTimeout(timeoutId);

    if (err instanceof ApiError) {
      throw err;
    }

    const errorObj = err as { name?: string; message?: string };
    if (errorObj.name === 'AbortError') {
      throw new ApiError(translateError('TIMEOUT'), 408, 'TIMEOUT');
    }

    throw new ApiError(translateError('NETWORK_ERROR', errorObj.message), 0, 'NETWORK_ERROR');
  }
}

/**
 * Convenient HTTP verb helpers
 */
export const api = {
  get: <T = unknown>(url: string, options?: RequestOptions) =>
    apiFetch<T>(url, { ...options, method: 'GET' }),

  post: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    apiFetch<T>(url, {
      ...options,
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  put: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PUT',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  patch: <T = unknown>(url: string, data?: unknown, options?: RequestOptions) =>
    apiFetch<T>(url, {
      ...options,
      method: 'PATCH',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),

  delete: <T = unknown>(url: string, options?: RequestOptions) =>
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};
