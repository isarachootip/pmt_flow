import { useState, useMemo } from 'react';
import { useQCBookings } from '@/features/qc/api';
import { useJob, useJobs } from '@/features/jobs/api';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { QcInspectionForm } from '@/features/qc/qc-inspection-form';
import { useConfirmBooking, useQCInspection } from '@/features/qc/api';
import { formatDMY } from '@/lib/date';

export default function QcPage() {
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [showQcForm, setShowQcForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading } = useQCBookings();
  const bookings = Array.isArray(data) ? data : (data?.data || []);

  const { data: allJobsData } = useJobs({});
  const allJobs = Array.isArray(allJobsData) ? allJobsData : (allJobsData?.data || []);

  const { data: jobData } = useJob(selectedBooking?.job_id);
  const selectedJob = jobData?.data || jobData || allJobs.find((j: any) => String(j.id) === String(selectedBooking?.job_id) || j.job_no === selectedBooking?.job_no);

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

  const filteredBookings = useMemo(() => {
    if (!searchQuery.trim()) return bookings;
    const q = searchQuery.toLowerCase().trim();
    return bookings.filter((b: any) => {
      const jobNo = String(b.job_no || '').toLowerCase();
      const cust = String(b.customer?.name || b.customer || '').toLowerCase();
      const task = String(b.task_name || '').toLowerCase();
      const inspector = String(b.inspector || '').toLowerCase();
      return jobNo.includes(q) || cust.includes(q) || task.includes(q) || inspector.includes(q);
    });
  }, [bookings, searchQuery]);

  const columns: ColumnDef<any>[] = [
    { 
      id: 'job_no', 
      header: 'รหัสงาน', 
      width: 140,
      cell: ({ row }: any) => <span className="font-semibold text-black">{row.job_no}</span> 
    },
    { 
      id: 'customer', 
      header: 'ลูกค้า', 
      width: 180,
      cell: ({ row }: any) => {
        const val = row.customer;
        const name = typeof val === 'string' ? val : val?.name || '-';
        return <span className="text-black font-medium">{name}</span>;
      }
    },
    { 
      id: 'task_name', 
      header: 'Task งาน', 
      width: 200,
      cell: ({ row }: any) => <span className="text-black font-medium">{row.task_name || '-'}</span> 
    },
    { 
      id: 'booking_date', 
      header: 'วันนัด QC', 
      width: 140,
      cell: ({ row }: any) => {
        if (!row.booking_date) return <span className="text-black font-medium">-</span>;
        return <span className="text-black font-medium">{formatDMY(row.booking_date)}</span>;
      }
    },
    { 
      id: 'time_slot', 
      header: 'ช่วงเวลา', 
      width: 120,
      cell: ({ row }: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-blue-50 border border-blue-200 text-black">
          {row.time_slot || '-'}
        </span>
      )
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      width: 130,
      cell: ({ row }: any) => <StatusBadge status={row.status as any} /> 
    },
    { 
      id: 'inspector', 
      header: 'ผู้ตรวจ QC', 
      width: 150,
      cell: ({ row }: any) => <span className="text-black font-medium">{row.inspector || 'รอระบุ'}</span> 
    },
    { 
      id: 'actions', 
      header: 'จัดการ', 
      width: 180,
      cell: ({ row }: any) => (
        <div className="flex gap-1.5">
          {row.status === 'PENDING' && (
            <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleConfirmBooking(row.id); }} className="text-black text-xs">
              ยืนยันนัด QC
            </Button>
          )}
          {(row.status === 'CONFIRMED' || row.status === 'PENDING') && (
            <Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); setSelectedBooking(row); setShowQcForm(true); }} className="text-black text-xs font-semibold">
              เริ่มตรวจ QC
            </Button>
          )}
        </div>
      ) 
    },
  ];

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="ตรวจรับงาน QC" pageKey="qc" />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (รหัสงาน, ลูกค้า, Task, ผู้ตรวจ)..."
              className="pl-9 h-9 text-sm text-black placeholder:text-gray-500 bg-white border-gray-300"
            />
          </div>
          {searchQuery && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchQuery('')}
              className="h-9 text-xs text-black font-medium hover:bg-gray-100"
            >
              ล้างตัวกรอง
            </Button>
          )}
        </div>

        <div className="text-xs text-black font-medium">
          แสดง <span className="font-bold text-black">{filteredBookings.length}</span> จากทั้งหมด <span className="font-bold text-black">{bookings.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="qc"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredBookings}
              isLoading={isLoading}
              onRowSelect={(row: any) => setSelectedBooking(row)}
              getRowId={(row) => String(row.id || row.job_no)}
              selectedRowId={selectedBooking ? String(selectedBooking.id || selectedBooking.job_no) : undefined}
            />
          }
          detailContent={
            selectedJob ? (
              <JobDetailTabs 
                job={selectedJob} 
                defaultTab="qc" 
                onClose={() => setSelectedBooking(null)} 
              />
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือกรายการเพื่อดูรายละเอียดผลตรวจ QC
              </div>
            )
          }
        />
      </div>

      {/* QC Form Modal Dialog */}
      <Dialog open={showQcForm} onOpenChange={setShowQcForm}>
        <DialogContent className="sm:max-w-[550px] bg-white text-black p-6">
          {selectedBooking && (
            <QcInspectionForm
              jobId={Number(selectedBooking.job_id) || 1}
              onSubmit={handleQcSubmit}
              onCancel={() => setShowQcForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
