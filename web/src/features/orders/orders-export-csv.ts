import { Job } from '@/features/jobs/api';
import { formatDMY, format24HourTimeBadge } from '@/lib/date';
import { toast } from 'sonner';

/**
 * Exports current active queue jobs to a formatted CSV file.
 * Formats 24-hr time badges, appointment dates, and escapes CSV special characters.
 */
export function exportOrdersToCSV(jobs: Job[]) {
  if (jobs.length === 0) {
    toast.info('ไม่มีข้อมูลให้ส่งออก');
    return;
  }

  const headers = [
    'รหัสงาน',
    'Booking No',
    'Ref ID',
    'ลูกค้า',
    'เบอร์โทร',
    'บริการ',
    'ประเภท',
    'วันนัด',
    'สถานะ',
    'ยอดสุทธิ',
    'ช่าง'
  ];

  const rows = jobs.map(j => {
    const custName = typeof j.customer === 'string'
      ? j.customer
      : (j.customer?.name || (j as any).customer_name || '-');
    const custPhone = typeof j.customer === 'object' && j.customer?.phone
      ? j.customer.phone
      : ((j as any).customer_phone || (j as any).phone || '-');
    const bookingNo = j.booking_no || (j as any).bookingNo || (j as any).vfix_no || '-';
    const refId = j.external_ref_id || (j as any).ref_id || (j as any).stk_ref || '-';
    const rawDate = j.plan_date || (j as any).appointment_date || (j as any).survey_date || (j as any).date;

    let appointmentCol = '-';
    if (rawDate) {
      const dateFormatted = formatDMY(rawDate);
      if (dateFormatted !== '-') {
        const rawTime = (j.plan_time || (j as any).time_slot || (j as any).survey_time || (j as any).time || (j as any).appointment_time || '') as string;
        const timeBadge = format24HourTimeBadge(rawTime, rawDate);
        appointmentCol = `${dateFormatted} ${timeBadge}`;
      }
    }

    const services = Array.isArray(j.services) ? j.services.join('; ') : (j.services || '-');
    const amt = Number(j.grand_total || (j as any).boq_grand_total || 0);

    return [
      `"${String(j.job_no || j.id || '').replace(/"/g, '""')}"`,
      `"${String(bookingNo).replace(/"/g, '""')}"`,
      `"${String(refId).replace(/"/g, '""')}"`,
      `"${String(custName).replace(/"/g, '""')}"`,
      `"${String(custPhone).replace(/"/g, '""')}"`,
      `"${String(services).replace(/"/g, '""')}"`,
      `"${String(j.project_type || '').replace(/"/g, '""')}"`,
      `"${appointmentCol}"`,
      `"${String(j.status || '').replace(/"/g, '""')}"`,
      `"${amt.toFixed(2)}"`,
      `"${String(j.assigned_tech || '-').replace(/"/g, '""')}"`
    ].join(',');
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  if (typeof window !== 'undefined' && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `PMT_Orders_Intake_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  toast.success('ส่งออกข้อมูลคิวรับงานเป็น CSV เรียบร้อยแล้ว');
}
