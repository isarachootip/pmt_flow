import { useState } from 'react';
import { MasterDetailLayout } from '@/features/layout/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { useBlueprints, Blueprint } from '@/features/blueprints/api';
import { useJobs, Job } from '@/features/jobs/api';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Button } from '@/components/ui/button';

export default function BlueprintsPage() {
  const { data: blueprintsData, isLoading } = useBlueprints();
  const { data: jobsData } = useJobs({});
  
  const blueprints: Blueprint[] = Array.isArray(blueprintsData) ? blueprintsData : (blueprintsData?.data || []);
  const allJobs: Job[] = Array.isArray(jobsData) ? jobsData : (jobsData?.data || []);

  const [selectedBlueprint, setSelectedBlueprint] = useState<Blueprint | null>(null);
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const handleRowClick = (row: Blueprint) => {
    setSelectedBlueprint(row);
    const job = allJobs.find((j: Job) => j.id.toString() === row.job_id || j.job_no === row.job_no);
    if (job) setSelectedJob(job);
  };

  const columns: ColumnDef<Blueprint>[] = [
    { id: 'file_name', header: 'ไฟล์', accessorKey: 'file_name', width: 200 },
    { id: 'job_no', header: 'งาน', accessorKey: 'job_no', width: 120 },
    { id: 'file_type', header: 'ประเภท', accessorKey: 'file_type', width: 100 },
    { id: 'version', header: 'เวอร์ชัน', accessorKey: 'version', width: 80 },
    { id: 'created_by', header: 'ผู้อัปโหลด', accessorKey: 'created_by', width: 150 },
    { 
      id: 'created_at', 
      header: 'วันที่', 
      accessorKey: 'created_at', 
      width: 150,
      cell: ({ row }) => {
        const val = row.created_at;
        if (!val) return '-';
        const d = new Date(val);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
      }
    }
  ];

  return (
    <MasterDetailLayout
      masterTitle="แบบติดตั้ง (Blueprints)"
      masterActions={<Button variant="primary">+ เพิ่มแบบ</Button>}
      hasDetail={!!selectedJob}
      master={
        <div className="h-full bg-card rounded-xl border border-soft shadow-card p-4 overflow-hidden flex flex-col">
          <div className="flex-1 min-h-0">
            <DataGrid
              columns={columns}
              data={blueprints}
              isLoading={isLoading}
              onRowSelect={handleRowClick}
              getRowId={(row) => row.id.toString()}
              selectedRowId={selectedBlueprint?.id.toString()}
            />
          </div>
        </div>
      }
      detail={
        selectedJob ? (
          <JobDetailTabs 
            job={selectedJob} 
            defaultTab="blueprint" 
            onClose={() => { setSelectedJob(null); setSelectedBlueprint(null); }} 
          />
        ) : null
      }
    />
  );
}
