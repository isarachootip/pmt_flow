import { useState, useMemo } from 'react';
import { useJobs, Job } from '@/features/jobs/api';
import { useCSAT, useCloseJob, useExportSTK } from '@/features/qc/api';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { PageHeader } from '@/components/ui/page-header';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CsatForm } from '@/features/qc/csat-form';
import { formatDMY } from '@/lib/date';

export default function CompletedPage() {
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [showCsatForm, setShowCsatForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load jobs that are in statuses handled by this page
  const { data, isLoading } = useJobs({ status: 'QC_PASS,COMPLETED,CLOSED' });
  const rawJobs: Job[] = Array.isArray(data) ? data : (data?.data || []);
  const jobs = rawJobs.length > 0 ? rawJobs : [];

  const csatMutation = useCSAT();
  const closeMutation = useCloseJob();
  const stkMutation = useExportSTK();

  const handleCsatSubmit = (formData: any) => {
    if (selectedJob) {
      csatMutation.mutate({ jobId: selectedJob.id, data: formData }, {
        onSuccess: () => setShowCsatForm(false)
      });
    }
  };

  const handleCloseAndBmt = (jobId: number) => {
    closeMutation.mutate(jobId);
  };

  const handleExportStk = (jobId: number) => {
    stkMutation.mutate(jobId);
  };

  const filteredJobs = useMemo(() => {
    if (!searchQuery.trim()) return jobs;
    const q = searchQuery.toLowerCase().trim();
    return jobs.filter((j: any) => {
      const jobNo = String(j.job_no || j.id || '').toLowerCase();
      const cust = String(typeof j.customer === 'string' ? j.customer : j.customer?.name || '').toLowerCase();
      const ref = String(j.external_ref_id || j.stk_ref || '').toLowerCase();
      return jobNo.includes(q) || cust.includes(q) || ref.includes(q);
    });
  }, [jobs, searchQuery]);

  const columns: ColumnDef<Job>[] = [
    { 
      id: 'job_no', 
      header: 'รหัสงาน', 
      accessorKey: 'job_no', 
      width: 140,
      cell: ({ row }) => <span className="font-semibold text-black">{row.job_no}</span>
    },
    { 
      id: 'customer', 
      header: 'ลูกค้า', 
      width: 180,
      cell: ({ row }) => {
        const val = row.customer;
        const name = typeof val === 'string' ? val : (val as any)?.name || '-';
        return <span className="text-black font-medium">{name}</span>;
      }
    },
    { 
      id: 'services', 
      header: 'บริการ', 
      width: 220,
      cell: ({ row }) => {
        const text = Array.isArray(row.services) ? row.services.join(', ') : (row.services || '-');
        return <div className="truncate max-w-[210px] text-black" title={text}>{text}</div>;
      }
    },
    { 
      id: 'qc_date', 
      header: 'วันที่ QC ผ่าน', 
      width: 140,
      cell: ({ row }: any) => {
        const val = row.step_timestamps?.qc_pass || row.updated_at;
        return <span className="text-black font-medium">{val ? formatDMY(val) : '-'}</span>;
      }
    },
    { 
      id: 'csat', 
      header: 'คะแนน CSAT', 
      width: 120,
      cell: ({ row }: any) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-50 border border-emerald-200 text-black">
          {row.csat_score ? `${row.csat_score} / 5 ⭐` : 'รอประเมิน'}
        </span>
      )
    },
    { 
      id: 'status', 
      header: 'สถานะ', 
      width: 130,
      cell: ({ row }) => <StatusBadge status={row.status as any} /> 
    },
    { 
      id: 'actions', 
      header: 'จัดการ', 
      width: 200,
      cell: ({ row }: any) => {
        const status = row.status;
        return (
          <div className="flex gap-1.5">
            {status === 'QC_PASS' && (
              <Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); setSelectedJob(row); setShowCsatForm(true); }} className="text-black text-xs font-semibold">
                ประเมิน CSAT
              </Button>
            )}
            {status === 'COMPLETED' && (
              <Button size="sm" variant="primary" onClick={(e) => { e.stopPropagation(); handleCloseAndBmt(row.id); }} className="text-black text-xs font-semibold">
                ปิดงาน & ส่ง STK
              </Button>
            )}
            {status === 'CLOSED' && (
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleExportStk(row.id); }} className="text-black text-xs">
                ส่ง STK ซ้ำ
              </Button>
            )}
          </div>
        );
      } 
    },
  ];

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="ปิดงาน & ส่ง STK" pageKey="completed" />

      {/* Search & Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-4 py-3 px-1">
        <div className="flex items-center gap-3">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-black" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหา (รหัสงาน, ลูกค้า, Ref ID)..."
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
          แสดง <span className="font-bold text-black">{filteredJobs.length}</span> จากทั้งหมด <span className="font-bold text-black">{jobs.length}</span> รายการ
        </div>
      </div>

      <div className="flex-1 min-h-0 mt-2">
        <MasterDetailLayout
          pageKey="completed"
          masterContent={
            <DataGrid
              columns={columns}
              data={filteredJobs}
              isLoading={isLoading}
              onRowSelect={(row: any) => setSelectedJob(row)}
              getRowId={(row) => String(row.id || row.job_no)}
              selectedRowId={selectedJob ? String(selectedJob.id || selectedJob.job_no) : undefined}
            />
          }
          detailContent={
            selectedJob ? (
              <JobDetailTabs 
                job={selectedJob} 
                defaultTab="stk" 
                onClose={() => setSelectedJob(null)} 
              />
            ) : (
              <div className="flex h-full items-center justify-center text-black bg-card border border-soft rounded-xl shadow-card font-medium">
                เลือกรายการเพื่อดูข้อมูลส่งออก STK และปิดโครงการ
              </div>
            )
          }
        />
      </div>

      <Dialog open={showCsatForm} onOpenChange={setShowCsatForm}>
        <DialogContent className="sm:max-w-[500px] bg-white text-black p-6">
          {selectedJob && (
            <CsatForm
              jobId={Number(selectedJob.id) || 1}
              onSubmit={handleCsatSubmit}
              onCancel={() => setShowCsatForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
