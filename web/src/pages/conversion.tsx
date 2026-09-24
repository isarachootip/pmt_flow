import { useState } from 'react';
import { MasterDetailLayout } from '@/features/layout/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { useJobs, Job } from '@/features/jobs/api';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Button } from '@/components/ui/button';
import { ConvertBoqDrawer } from '@/features/jobs/convert-boq-drawer';

export default function ConversionPage() {
  const { data: jobsData, isLoading } = useJobs({});
  
  // Master grid: Jobs ready to convert or manage BOQ
  const conversionJobs = jobsData?.data?.filter((job: Job) => ['BOQ', 'DESIGNING', 'SURVEYED', 'IN_PROGRESS'].includes(job.status?.toUpperCase())) || jobsData?.data || [];
  
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleRowClick = (row: Job) => {
    setSelectedJob(row);
  };

  const columns: ColumnDef<Job>[] = [
    { id: 'job_no', header: 'เลขที่งาน', accessorKey: 'job_no', width: 150 },
    { 
      id: 'customer', 
      header: 'ลูกค้า', 
      accessorKey: 'customer', 
      width: 250,
      cell: ({ row }) => {
        const val = row.customer;
        return typeof val === 'string' ? val : (val as any)?.name || '-';
      }
    },
    { id: 'status', header: 'สถานะ', accessorKey: 'status', width: 150 }
  ];

  return (
    <>
      <MasterDetailLayout
        masterTitle="แปลง BOQ เป็น Task"
        masterActions={
          <Button 
            variant="primary" 
            disabled={!selectedJob} 
            onClick={() => setDrawerOpen(true)}
          >
            แปลง BOQ เป็น Task
          </Button>
        }
        hasDetail={!!selectedJob}
        master={
          <div className="h-full bg-card rounded-xl border border-soft shadow-card p-4 overflow-hidden flex flex-col">
            <div className="flex-1 min-h-0">
              <DataGrid
                columns={columns}
                data={conversionJobs}
                isLoading={isLoading}
                onRowSelect={handleRowClick}
                getRowId={(row) => row.id.toString()}
                selectedRowId={selectedJob?.id.toString()}
              />
            </div>
          </div>
        }
        detail={
          selectedJob ? (
            <JobDetailTabs 
              job={selectedJob} 
              defaultTab="boq" 
              onClose={() => { setSelectedJob(null); }} 
            />
          ) : null
        }
      />

      {selectedJob && (
        <ConvertBoqDrawer
          job={selectedJob}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
        />
      )}
    </>
  );
}
