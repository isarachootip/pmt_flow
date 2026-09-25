import { describe, it, expect } from 'vitest';
import {
  formatDMY,
  formatDateTimeDMY,
  toISODate,
  toISODateTime,
  parseDMY,
  parseDateTimeDMY,
  toDateTime,
  isValidDMY,
  isValidDateTimeDMY,
  format24HourTimeBadge,
} from './date';

describe('PMT Flow Date & Datetime Utilities (Strict Standards)', () => {
  const sampleDate = new Date(2026, 8, 24, 15, 30, 45); // 24 September 2026 15:30:45

  describe('toDateTime (Strict Datetime Object Return)', () => {
    it('returns a native Date object from Date', () => {
      const res = toDateTime(sampleDate);
      expect(res).toBeInstanceOf(Date);
      expect(typeof res).not.toBe('string');
      expect(res?.getFullYear()).toBe(2026);
    });

    it('converts ISO string into a native Date object', () => {
      const res = toDateTime('2026-09-24T15:30:45Z');
      expect(res).toBeInstanceOf(Date);
      expect(typeof res).not.toBe('string');
    });

    it('converts DD/MM/YYYY HH:mm string into a native Date object', () => {
      const res = toDateTime('24/09/2026 15:30');
      expect(res).toBeInstanceOf(Date);
      expect(typeof res).not.toBe('string');
      expect(res?.getHours()).toBe(15);
      expect(res?.getMinutes()).toBe(30);
    });

    it('returns null on invalid input', () => {
      expect(toDateTime(null)).toBeNull();
      expect(toDateTime('invalid')).toBeNull();
    });
  });

  describe('formatDMY', () => {
    it('formats Date object into DD/MM/YYYY', () => {
      expect(formatDMY(sampleDate)).toBe('24/09/2026');
    });

    it('formats ISO date string into DD/MM/YYYY', () => {
      expect(formatDMY('2026-09-24T10:00:00Z')).toMatch(/24\/09\/2026/);
    });

    it('returns fallback for null or undefined or invalid', () => {
      expect(formatDMY(null)).toBe('-');
      expect(formatDMY(undefined)).toBe('-');
      expect(formatDMY('invalid-date')).toBe('-');
      expect(formatDMY(null, 'N/A')).toBe('N/A');
    });
  });

  describe('formatDateTimeDMY', () => {
    it('formats in 24-hour clock without AM/PM', () => {
      const formatted = formatDateTimeDMY(sampleDate);
      expect(formatted).toBe('24/09/2026 15:30');
      expect(formatted).not.toContain('AM');
      expect(formatted).not.toContain('PM');
    });

    it('includes seconds when requested', () => {
      expect(formatDateTimeDMY(sampleDate, true)).toBe('24/09/2026 15:30:45');
    });

    it('handles midnight and noon correctly in 24h clock', () => {
      const midnight = new Date(2026, 8, 24, 0, 5, 0);
      expect(formatDateTimeDMY(midnight)).toBe('24/09/2026 00:05');
      const noon = new Date(2026, 8, 24, 12, 0, 0);
      expect(formatDateTimeDMY(noon)).toBe('24/09/2026 12:00');
    });
  });

  describe('toISODate and toISODateTime', () => {
    it('converts Date object to YYYY-MM-DD for APIs', () => {
      expect(toISODate(sampleDate)).toBe('2026-09-24');
    });

    it('converts Date object to full ISO Datetime string for APIs', () => {
      const iso = toISODateTime(sampleDate);
      expect(iso).toMatch(/^2026-09-24T/);
      expect(iso).toContain('Z');
    });

    it('returns empty string on null or invalid', () => {
      expect(toISODate(null)).toBe('');
      expect(toISODateTime(null)).toBe('');
    });
  });

  describe('parseDateTimeDMY and isValidDateTimeDMY', () => {
    it('parses DD/MM/YYYY HH:mm into a real Date (datetime) object', () => {
      const d = parseDateTimeDMY('24/09/2026 15:30');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getDate()).toBe(24);
      expect(d?.getMonth()).toBe(8);
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getHours()).toBe(15);
      expect(d?.getMinutes()).toBe(30);
    });

    it('parses DD/MM/YYYY HH:mm:ss into a real Date (datetime) object', () => {
      const d = parseDateTimeDMY('24/09/2026 15:30:45');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getSeconds()).toBe(45);
    });

    it('parses DD/MM/YYYY falling back to 00:00:00 time', () => {
      const d = parseDateTimeDMY('24/09/2026');
      expect(d).toBeInstanceOf(Date);
      expect(d?.getHours()).toBe(0);
      expect(d?.getMinutes()).toBe(0);
    });

    it('validates DD/MM/YYYY HH:mm format correctly', () => {
      expect(isValidDateTimeDMY('24/09/2026 15:30')).toBe(true);
      expect(isValidDateTimeDMY('24/09/2026')).toBe(true);
      expect(isValidDateTimeDMY('2026-09-24 15:30')).toBe(false);
      expect(isValidDateTimeDMY('invalid')).toBe(false);
    });
  });

  describe('parseDMY and isValidDMY', () => {
    it('parses valid DD/MM/YYYY correctly', () => {
      const d = parseDMY('24/09/2026');
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(8);
      expect(d?.getDate()).toBe(24);
    });

    it('returns null for invalid strings', () => {
      expect(parseDMY('2026-09-24')).toBeNull();
      expect(parseDMY('invalid')).toBeNull();
      expect(parseDMY('')).toBeNull();
    });

    it('validates DD/MM/YYYY format correctly', () => {
      expect(isValidDMY('24/09/2026')).toBe(true);
      expect(isValidDMY('01/01/2025')).toBe(true);
      expect(isValidDMY('2026-09-24')).toBe(false);
      expect(isValidDMY('32/01/2026')).toBe(false);
    });
  });

  describe('format24HourTimeBadge (24-Hour Time Standard, Strictly NO AM/PM)', () => {
    it('formats standard 24-hr time correctly with น. suffix', () => {
      expect(format24HourTimeBadge('09:00')).toBe('09:00 น.');
      expect(format24HourTimeBadge('9:00')).toBe('09:00 น.');
      expect(format24HourTimeBadge('13:30')).toBe('13:30 น.');
      expect(format24HourTimeBadge('13:30 น.')).toBe('13:30 น.');
      expect(format24HourTimeBadge('09:00:00')).toBe('09:00 น.');
    });

    it('converts 12-hour AM/PM format into strictly 24-hour time without AM/PM', () => {
      expect(format24HourTimeBadge('01:30 PM')).toBe('13:30 น.');
      expect(format24HourTimeBadge('1:30 pm')).toBe('13:30 น.');
      expect(format24HourTimeBadge('09:00 AM')).toBe('09:00 น.');
      expect(format24HourTimeBadge('12:00 PM')).toBe('12:00 น.');
      expect(format24HourTimeBadge('12:00 AM')).toBe('00:00 น.');
    });

    it('converts Thai preset slots into standard 24-hr badge times', () => {
      expect(format24HourTimeBadge('ช่วงเช้า')).toBe('09:00 น.');
      expect(format24HourTimeBadge('ช่วงบ่าย')).toBe('13:00 น.');
      expect(format24HourTimeBadge('ช่วงเย็น')).toBe('17:00 น.');
    });

    it('preserves 24-hour range formats', () => {
      expect(format24HourTimeBadge('09:00 - 12:00')).toBe('09:00 - 12:00 น.');
      expect(format24HourTimeBadge('13:00-16:00')).toBe('13:00 - 16:00 น.');
    });

    it('extracts time from Date object when time string is empty', () => {
      const dt = new Date(2026, 8, 25, 14, 45, 0);
      expect(format24HourTimeBadge('', dt)).toBe('14:45 น.');
    });

    it('formats 24-hr time using Thai dot notation correctly', () => {
      expect(format24HourTimeBadge('13.30')).toBe('13:30 น.');
      expect(format24HourTimeBadge('13.30 น.')).toBe('13:30 น.');
      expect(format24HourTimeBadge('09.00 - 12.00')).toBe('09:00 - 12:00 น.');
      expect(format24HourTimeBadge('08.30')).toBe('08:30 น.');
    });
  });

  describe('toDateTime Date-only ISO String Safety (No Timezone Shift)', () => {
    it('creates local Date object for YYYY-MM-DD without UTC day rollback', () => {
      const d = toDateTime('2026-09-24');
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(8); // September
      expect(d?.getDate()).toBe(24);
      expect(formatDMY(d)).toBe('24/09/2026');
    });

    it('parses local space-separated timestamp string in local time', () => {
      const d = toDateTime('2026-09-24 15:30:00');
      expect(d).not.toBeNull();
      expect(d?.getFullYear()).toBe(2026);
      expect(d?.getMonth()).toBe(8);
      expect(d?.getDate()).toBe(24);
      expect(d?.getHours()).toBe(15);
      expect(d?.getMinutes()).toBe(30);
    });
  });

  describe('parseDMY Flexible Input Support', () => {
    it('parses single-digit day and month correctly', () => {
      const d1 = parseDMY('5/9/2026');
      expect(d1).not.toBeNull();
      expect(d1?.getDate()).toBe(5);
      expect(d1?.getMonth()).toBe(8);
      expect(d1?.getFullYear()).toBe(2026);

      const d2 = parseDMY('24/9/2026');
      expect(d2?.getDate()).toBe(24);
      expect(d2?.getMonth()).toBe(8);
    });

    it('rejects nonexistent calendar dates like 31/02/2026', () => {
      expect(parseDMY('31/02/2026')).toBeNull();
      expect(parseDMY('29/02/2026')).toBeNull(); // 2026 is not a leap year
      expect(parseDMY('32/01/2026')).toBeNull();
    });
  });
});
