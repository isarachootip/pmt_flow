import { format, parse, isValid } from 'date-fns';

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
    // 2. ISO 8601 string or standard timestamp string
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

  const parsed = parse(trimmed, 'dd/MM/yyyy', new Date());
  return isValid(parsed) ? parsed : null;
}

/**
 * Parses DD/MM/YYYY HH:mm or DD/MM/YYYY HH:mm:ss into a Date (datetime) object
 * If only DD/MM/YYYY is provided, parses with time at 00:00:00.
 */
export function parseDateTimeDMY(dmyTimeStr: string): Date | null {
  if (!dmyTimeStr || typeof dmyTimeStr !== 'string') return null;
  const trimmed = dmyTimeStr.trim();

  // 1. DD/MM/YYYY HH:mm:ss
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}:\d{2}$/.test(trimmed)) {
    const d = parse(trimmed, 'dd/MM/yyyy HH:mm:ss', new Date());
    if (isValid(d)) return d;
  }

  // 2. DD/MM/YYYY HH:mm
  if (/^\d{1,2}\/\d{1,2}\/\d{4}\s+\d{1,2}:\d{2}$/.test(trimmed)) {
    const d = parse(trimmed, 'dd/MM/yyyy HH:mm', new Date());
    if (isValid(d)) return d;
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
