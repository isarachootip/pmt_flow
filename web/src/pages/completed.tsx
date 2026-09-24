
import { useState } from 'react';
import { useJobs } from '@/features/jobs/api';
import { useCSAT, useCloseJob, useExportSTK } from '@/features/qc/api';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { CsatForm } from '@/features/qc/csat-form';

export default function CompletedPage() {
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [showCsatForm, setShowCsatForm] = useState(false);

  // Load jobs that are in statuses handled by this page
  const { data, isLoading } = useJobs({ status: 'QC_PASS,COMPLETED,CLOSED' });
  const jobs = data?.data || [];

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

  const columns: ColumnDef<any>[] = [
    { id: 'job_no', header: 'รหัสงาน', accessorKey: 'job_no' },
    { id: 'customer', header: 'ลูกค้า', cell: ({ row }: any) => typeof row.customer === 'string' ? row.customer : row.customer?.name || '-' },
    { id: 'services', header: 'บริการ', cell: ({ row }: any) => row.services?.join(', ') || '-' },
    { id: 'qc_date', header: 'วันที่ QC ผ่าน', cell: ({ row }: any) => {
      // Dummy check since step_timestamps might have it
      if (row.step_timestamps?.qc_pass) {
        const d = new Date(row.step_timestamps.qc_pass);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth()+1).padStart(2, '0')}/${d.getFullYear()}`;
      }
      return '-';
    }},
    { id: 'csat', header: 'CSAT', cell: ({ row }: any) => row.csat_score ? `${row.csat_score}/5` : '-' },
    { id: 'status', header: 'สถานะ', cell: ({ row }: any) => <StatusBadge status={row.status as any} /> },
    { id: 'actions', header: '', cell: ({ row }: any) => {
        const status = row.status;
        return (
          <div className="flex gap-2">
            {status === 'QC_PASS' && (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); setSelectedJob(row); setShowCsatForm(true); }}>ประเมิน CSAT</Button>
            )}
            {status === 'COMPLETED' && (
              <Button size="sm" onClick={(e) => { e.stopPropagation(); handleCloseAndBmt(row.id); }}>ปิดงาน & ส่ง STK</Button>
            )}
            {status === 'CLOSED' && (
              <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); handleExportStk(row.id); }}>ส่ง STK</Button>
            )}
          </div>
        );
      } 
    },
  ];

  return (
    <div className="h-full flex flex-col p-6 space-y-6 overflow-hidden bg-bg">
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="flex-1 flex flex-col bg-card rounded-xl border border-border-soft overflow-hidden shadow-card">
          <DataGrid
            columns={columns}
            data={jobs}
            isLoading={isLoading}
            onRowSelect={(row: any) => setSelectedJob(row)}
            getRowId={(row) => String(row.id)}
          />
        </div>
        
        {selectedJob && (
          <div className="w-[600px] flex flex-col">
            <JobDetailTabs 
              job={selectedJob} 
              defaultTab="history" 
              onClose={() => setSelectedJob(null)} 
            />
          </div>
        )}
      </div>

      <Dialog open={showCsatForm} onOpenChange={setShowCsatForm}>
        <DialogContent className="sm:max-w-[500px]">
          {selectedJob && (
            <CsatForm
              jobId={selectedJob.id}
              onSubmit={handleCsatSubmit}
              onCancel={() => setShowCsatForm(false)}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
