import { describe, it, expect } from 'vitest';
import { normalizeJob } from './job';
import { formatDMY } from '@/lib/date';

describe('normalizeJob and Job Entity Model', () => {
  it('strictly separates plan_date as a Date object and plan_time as a 24-hr time string', () => {
    const rawApiJob = {
      id: 101,
      job_no: 'JOB-2026-001',
      customer_name: 'คุณวิชัย ทดสอบ',
      plan_date: '2026-09-24',
      plan_time: '08:30 - 12:00',
      status: 'IN_PROGRESS',
      job_type: 'quick',
      created_at: '2026-09-24T08:00:00.000Z',
      updated_at: '2026-09-24T08:30:00.000Z',
    };

    const job = normalizeJob(rawApiJob);

    // 1. plan_date must be a real Date object
    expect(job.plan_date).toBeInstanceOf(Date);
    expect(formatDMY(job.plan_date)).toBe('24/09/2026');

    // 2. plan_time is strictly separated and untouched
    expect(job.plan_time).toBe('08:30 - 12:00');
    expect(job.time_slot).toBe('08:30 - 12:00');

    // 3. Timestamps are Date objects
    expect(job.created_at).toBeInstanceOf(Date);
    expect(job.updated_at).toBeInstanceOf(Date);
  });

  it('handles fallback time slot from schedule_plan and fallback dates', () => {
    const rawApiJob = {
      id: 102,
      job_no: 'JOB-2026-002',
      customer_name: 'คุณสมศักดิ์',
      date: '2026-10-15',
      schedule_plan: {
        time_slot: '13:00 - 17:00',
      },
      status: 'NEW',
      job_type: 'renovate',
      created_at: '2026-10-10T10:00:00.000Z',
      updated_at: '2026-10-10T10:00:00.000Z',
    };

    const job = normalizeJob(rawApiJob);

    expect(job.plan_date).toBeInstanceOf(Date);
    expect(formatDMY(job.plan_date)).toBe('15/10/2026');
    expect(job.plan_time).toBe('13:00 - 17:00');
  });

  it('handles null / empty plan_date and plan_time gracefully', () => {
    const rawApiJob = {
      id: 103,
      job_no: 'JOB-2026-003',
      plan_date: null,
      plan_time: null,
      created_at: '2026-09-24T08:00:00.000Z',
      updated_at: '2026-09-24T08:00:00.000Z',
    };

    const job = normalizeJob(rawApiJob);

    expect(job.plan_date).toBeNull();
    expect(job.plan_time).toBeNull();
  });
});
