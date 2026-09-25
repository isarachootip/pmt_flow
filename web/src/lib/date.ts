import { format, isValid } from 'date-fns';

/**
 * Normalizes any date/datetime input into a real Date (datetime) object or null.
 * Strictly guarantees that datetime values are represented as Date objects, not strings.
 */
export function toDateTime(input: Date | string | number | null | undefined): Date | null {
  if (!input) return null;
  if (input instanceof Date) return isValid(input) ? input : null;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    // 1. If format is DD/MM/YYYY with or without 24-hr time
    if (trimmed.includes('/')) {
      const parsed = parseDateTimeDMY(trimmed);
      if (parsed) return parsed;
    }
    // 2. Date-only ISO string YYYY-MM-DD (construct in local time to avoid UTC-offset timezone shifts)
    const ymdMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
    if (ymdMatch) {
      const year = parseInt(ymdMatch[1], 10);
      const month = parseInt(ymdMatch[2], 10) - 1;
      const day = parseInt(ymdMatch[3], 10);
      const d = new Date(year, month, day);
      return isValid(d) ? d : null;
    }
    // 3. Local datetime string YYYY-MM-DD HH:mm(:ss) without timezone suffix
    const ymdTimeMatch = /^(\d{4})-(\d{2})-(\d{2})[\sT](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
    if (ymdTimeMatch && !trimmed.endsWith('Z') && !trimmed.includes('+')) {
      const year = parseInt(ymdTimeMatch[1], 10);
      const month = parseInt(ymdTimeMatch[2], 10) - 1;
      const day = parseInt(ymdTimeMatch[3], 10);
      const hour = parseInt(ymdTimeMatch[4], 10);
      const min = parseInt(ymdTimeMatch[5], 10);
      const sec = ymdTimeMatch[6] ? parseInt(ymdTimeMatch[6], 10) : 0;
      const d = new Date(year, month, day, hour, min, sec);
      return isValid(d) ? d : null;
    }
    // 4. ISO 8601 string or standard timestamp string
    const d = new Date(trimmed);
    return isValid(d) ? d : null;
  }

  if (typeof input === 'number') {
    const d = new Date(input);
    return isValid(d) ? d : null;
  }

  return null;
}

/**
 * Formats a date into DD/MM/YYYY format (e.g. 24/09/2026)
 * Strictly conforms to PMT Flow Date Standard.
 */
export function formatDMY(date: Date | string | number | null | undefined, fallback = '-'): string {
  const d = toDateTime(date);
  if (!d) return fallback;
  return format(d, 'dd/MM/yyyy');
}

/**
 * Formats a date into DD/MM/YYYY HH:mm (24-hour format)
 * If includeSeconds is true, formats into DD/MM/YYYY HH:mm:ss
 * Strictly NO AM/PM across PMT Flow.
 */
export function formatDateTimeDMY(
  date: Date | string | number | null | undefined,
  includeSeconds = false,
  fallback = '-'
): string {
  const d = toDateTime(date);
  if (!d) return fallback;
  const pattern = includeSeconds ? 'dd/MM/yyyy HH:mm:ss' : 'dd/MM/yyyy HH:mm';
  return format(d, pattern);
}

/**
 * Converts a date into ISO Date string (YYYY-MM-DD) for backend REST APIs
 */
export function toISODate(date: Date | string | number | null | undefined): string {
  const d = toDateTime(date);
  if (!d) return '';
  return format(d, 'yyyy-MM-dd');
}

/**
 * Converts any date/datetime into ISO 8601 Datetime string (YYYY-MM-DDTHH:mm:ss.sssZ)
 */
export function toISODateTime(date: Date | string | number | null | undefined): string {
  const d = toDateTime(date);
  if (!d) return '';
  return d.toISOString();
}

/**
 * Parses a string in DD/MM/YYYY format into a Date (datetime) object
 * Sets hours/minutes/seconds to 00:00:00.
 */
export function parseDMY(dmyStr: string): Date | null {
  if (!dmyStr || typeof dmyStr !== 'string') return null;
  const trimmed = dmyStr.trim();
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(trimmed);
  if (!match) return null;

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const year = parseInt(match[3], 10);
  if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1000 || year > 9999) return null;

  const d = new Date(year, month, day);
  // Verify date didn't overflow into next month (e.g. 31/02/2026)
  if (isValid(d) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day) {
    return d;
  }
  return null;
}

/**
 * Parses DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss into a Date (datetime) object
 * If only DD/MM/YYYY is provided, parses with time at 00:00:00.
 */
export function parseDateTimeDMY(dmyTimeStr: string): Date | null {
  if (!dmyTimeStr || typeof dmyTimeStr !== 'string') return null;
  const trimmed = dmyTimeStr.trim();

  // 1. DD/MM/YYYY HH:mm:ss
  const m1 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[:.](\d{2})[:.](\d{2})$/.exec(trimmed);
  if (m1) {
    const day = parseInt(m1[1], 10);
    const month = parseInt(m1[2], 10) - 1;
    const year = parseInt(m1[3], 10);
    const h = parseInt(m1[4], 10);
    const m = parseInt(m1[5], 10);
    const s = parseInt(m1[6], 10);
    if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1000 || year > 9999 || h < 0 || h > 23 || m < 0 || m > 59 || s < 0 || s > 59) return null;
    const d = new Date(year, month, day, h, m, s);
    if (isValid(d) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day && d.getHours() === h && d.getMinutes() === m && d.getSeconds() === s) {
      return d;
    }
  }

  // 2. DD/MM/YYYY HH:mm
  const m2 = /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2})[:.](\d{2})$/.exec(trimmed);
  if (m2) {
    const day = parseInt(m2[1], 10);
    const month = parseInt(m2[2], 10) - 1;
    const year = parseInt(m2[3], 10);
    const h = parseInt(m2[4], 10);
    const m = parseInt(m2[5], 10);
    if (month < 0 || month > 11 || day < 1 || day > 31 || year < 1000 || year > 9999 || h < 0 || h > 23 || m < 0 || m > 59) return null;
    const d = new Date(year, month, day, h, m, 0);
    if (isValid(d) && d.getFullYear() === year && d.getMonth() === month && d.getDate() === day && d.getHours() === h && d.getMinutes() === m) {
      return d;
    }
  }

  // 3. Fallback: DD/MM/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmed)) {
    return parseDMY(trimmed);
  }

  return null;
}

/**
 * Checks if a string matches valid DD/MM/YYYY format
 */
export function isValidDMY(dmyStr: string): boolean {
  return parseDMY(dmyStr) !== null;
}

/**
 * Checks if a string matches valid DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss format
 */
export function isValidDateTimeDMY(dmyTimeStr: string): boolean {
  return parseDateTimeDMY(dmyTimeStr) !== null;
}

/**
 * Normalizes appointment time string or Date into a strict 24-hour time badge format (e.g. "09:00 น.", "13:30 น.")
 * Strictly NO AM/PM across PMT Flow. Supports colon (:) and Thai dot (.) notation.
 */
export function format24HourTimeBadge(
  timeInput?: string | null,
  dateInput?: Date | string | number | null,
  defaultFallback = '09:00 น.'
): string {
  let timeStr = (timeInput || '').trim();

  // If timeInput is empty, try to extract time from dateInput if it has time component
  if (!timeStr && dateInput) {
    const d = toDateTime(dateInput);
    if (d && (d.getHours() !== 0 || d.getMinutes() !== 0)) {
      timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }
  }

  if (!timeStr) {
    return defaultFallback;
  }

  // Handle Thai preset slots
  if (timeStr.includes('เช้า')) return '09:00 น.';
  if (timeStr.includes('บ่าย')) return '13:00 น.';
  if (timeStr.includes('เย็น')) return '17:00 น.';

  // Check 12-hour AM/PM format (e.g. "09:00 AM", "1:30 pm", "12:00 PM", "12:00 AM", with colon or dot)
  const matchAmPm = timeStr.match(/^(\d{1,2})[:.](\d{2})(?:[:.]\d{2})?\s*(AM|PM)$/i);
  if (matchAmPm) {
    let h = parseInt(matchAmPm[1], 10);
    const m = matchAmPm[2];
    const isPm = matchAmPm[3].toUpperCase() === 'PM';
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
    return `${String(h).padStart(2, '0')}:${m} น.`;
  }

  // Check 24-hour range format (e.g. "09:00 - 12:00", "09:00-12:00", "09.00 - 12.00")
  const matchRange = timeStr.match(/^(\d{1,2})[:.](\d{2})\s*-\s*(\d{1,2})[:.](\d{2})/);
  if (matchRange) {
    const startH = matchRange[1].padStart(2, '0');
    const startM = matchRange[2];
    const endH = matchRange[3].padStart(2, '0');
    const endM = matchRange[4];
    return `${startH}:${startM} - ${endH}:${endM} น.`;
  }

  // Check standard 24-hour time (e.g. "09:00", "13:30", "13.30", "9:00:00", "09:00 น.")
  const match24 = timeStr.match(/^(\d{1,2})[:.](\d{2})/);
  if (match24) {
    const h = match24[1].padStart(2, '0');
    const m = match24[2];
    return `${h}:${m} น.`;
  }

  return defaultFallback;
}
