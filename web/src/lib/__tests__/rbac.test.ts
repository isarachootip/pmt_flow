import { describe, it, expect } from 'vitest';
import { canAccess, getMenuForRole } from '../rbac';

describe('RBAC', () => {
  it('ADMIN can access all routes', () => {
    expect(canAccess('ADMIN', '/admin/users')).toBe(true);
    expect(canAccess('ADMIN', '/orders')).toBe(true);
    expect(canAccess('ADMIN', '/qc')).toBe(true);
  });

  it('AE cannot access /admin/* routes', () => {
    expect(canAccess('AE', '/admin/users')).toBe(false);
    expect(canAccess('AE', '/admin/settings')).toBe(false);
  });

  it('QC can access /qc but not /conversion', () => {
    expect(canAccess('QC', '/qc')).toBe(true);
    expect(canAccess('QC', '/conversion')).toBe(false);
  });

  it('CONTACT_CENTER has limited menu', () => {
    expect(canAccess('CONTACT_CENTER', '/dashboard')).toBe(true);
    expect(canAccess('CONTACT_CENTER', '/orders')).toBe(true);
    expect(canAccess('CONTACT_CENTER', '/gantt')).toBe(true);
    expect(canAccess('CONTACT_CENTER', '/km')).toBe(true);
    
    // Denied access to others
    expect(canAccess('CONTACT_CENTER', '/admin/users')).toBe(false);
    expect(canAccess('CONTACT_CENTER', '/conversion')).toBe(false);
  });

  it('getMenuForRole returns correct items per role', () => {
    const adminMenu = getMenuForRole('ADMIN');
    // ADMIN has all groups
    expect(adminMenu.length).toBeGreaterThan(0);
    expect(adminMenu.some(g => g.group === 'ระบบ')).toBe(true);

    const aeMenu = getMenuForRole('AE');
    // AE doesn't have system group except KM
    const systemGroupAE = aeMenu.find(g => g.group === 'ระบบ');
    expect(systemGroupAE?.items.map(i => i.key)).toEqual(['km']);

    const qcMenu = getMenuForRole('QC');
    // QC doesn't have "รายงาน"
    expect(qcMenu.some(g => g.group === 'รายงาน')).toBe(false);
    // In Pipeline, QC has orders, gantt, qc
    const pipelineGroupQC = qcMenu.find(g => g.group === 'ขั้นตอนงาน (Pipeline)');
    expect(pipelineGroupQC?.items.map(i => i.key)).toEqual(['orders', 'gantt', 'qc']);
  });
});
