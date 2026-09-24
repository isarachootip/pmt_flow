
import { useState } from 'react';
import { useQCBookings } from '@/features/qc/api';
import { useJob } from '@/features/jobs/api';
import { KpiCard } from '@/components/ui/kpi-card';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { QcInspectionForm } from '@/features/qc/qc-inspection-form';
import { useConfirmBooking, useQCInspection } from '@/features/qc/api';

export default function QcPage() {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showQcForm, setShowQcForm] = useState(false);

  const { data, isLoading } = useQCBookings();
  const bookings = data?.data || [];

  const { data: jobData } = useJob(selectedBooking?.job_id);
  const confirmBooking = useConfirmBooking();
  const qcInspection = useQCInspection();

  const handleConfirmBooking = (bookingId: number) => {
    confirmBooking.mutate({ id: bookingId, data: { confirmed_by: 'System', confirmed_at: new Date().toISOString() } });
  };

  const handleQcSubmit = (formData: any) => {
    if (selectedBooking) {
      qcInspection.mutate({ jobId: selectedBooking.job_id, data: formData }, {
        onSuccess: () => {
          setShowQcForm(false);
        }
      });
    }
  };

  const columns: ColumnDef<any>[] = [
    { id: 'job_no', header: 'รหัสงาน', accessorKey: 'job_no' },
    { id: 'customer', header: 'ลูกค้า', cell: ({ row }: any) => row.customer?.name || '-' },
    { id: 'task_name', header: 'Task', accessorKey: 'task_name' },
    { id: 'booking_date', header: 'วันนัด QC', cell: ({ row }: any) => {
      if (!row.booking_date) return '-';
      const d = new Date(row.booking_date);
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
    }},
    { id: 'time_slot', header: 'ช่วงเวลา', accessorKey: 'time_slot' },
    { id: 'status', header: 'สถานะ', cell: ({ row }: any) => <StatusBadge status={row.original.status as any} /> },
    { id: 'inspector', header: 'ผู้ตรวจ', accessorKey: 'inspector' },
    { id: 'actions', header: '', cell: ({ row }: any) => (
        <div className="flex gap-2">
          {row.original.status === 'PENDING' && (
            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleConfirmBooking(row.original.id); }}>ยืนยันนัด QC</Button>
          )}
          {(row.original.status === 'CONFIRMED' || row.original.status === 'PENDING') && (
            <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedBooking(row.original); setShowQcForm(true); }}>เริ่มตรวจ QC</Button>
          )}
        </div>
      ) 
    },
  ];

  const pendingCount = bookings.filter((b: any) => b.status === 'PENDING').length;
  const confirmedCount = bookings.filter((b: any) => b.status === 'CONFIRMED').length;
  // Assume pass/fail logic from job status if available or just dummy since booking status is PENDING/CONFIRMED/DONE
  const passCount = 0; // Needs backend integration for exact stats
  const failCount = 0;

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden bg-bg">
      <div className="flex gap-4">
        <KpiCard className="flex-1" label="ทั้งหมด" value={bookings.length} />
        <KpiCard className="flex-1" label="รอตรวจ" value={pendingCount} />
        <KpiCard className="flex-1" label="ยืนยันแล้ว" value={confirmedCount} />
        <KpiCard className="flex-1" label="ผ่าน" value={passCount} />
        <KpiCard className="flex-1" label="ไม่ผ่าน" value={failCount} />
      </div>

      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 flex flex-col bg-card rounded-xl border border-border-soft overflow-hidden shadow-card">
          <DataGrid
            columns={columns}
            data={bookings}
            isLoading={isLoading}
            onRowSelect={(row: any) => setSelectedBooking(row)}
            getRowId={(row) => String(row.id)}
          />
        </div>
        
        {selectedBooking && jobData?.data && (
          <div className="w-[600px] flex flex-col">
            <JobDetailTabs 
              job={jobData.data} 
              defaultTab="qc" 
              onClose={() => setSelectedBooking(null)} 
            />
          </div>
        )}
      </div>

      <Dialog open={showQcForm} onOpenChange={setShowQcForm}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedBooking && (
            <QcInspectionForm
              jobId={selectedBooking.job_id}
              onSubmit={handleQcSubmit}
              onCancel={() => setShowQcForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
