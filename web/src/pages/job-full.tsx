import * as React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useJobs, Job } from '@/features/jobs/api';
import { PageHeader } from '@/components/ui/page-header';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDMY } from '@/lib/date';

export default function JobFullPage() {
  const { jobNo } = useParams<{ jobNo: string }>();
  const navigate = useNavigate();
  
  const { data, isLoading } = useJobs({ search: jobNo });
  const jobList: Job[] = Array.isArray(data) ? data : (data?.data || []);
  const job = React.useMemo(() => jobList.find((j: Job) => j.job_no === jobNo), [jobList, jobNo]);

  if (isLoading) {
    return <div className="p-6 space-y-4"><Skeleton className="h-20" /><Skeleton className="h-64" /></div>;
  }

  if (!job) {
    return <div className="p-6">ไม่พบข้อมูลงาน</div>;
  }

  const actions = (
    <div className="flex gap-2">
      <Button variant="secondary" onClick={() => navigate(-1)}>กลับ</Button>
      <Button variant="primary">อัปเดตสถานะ</Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle overflow-auto p-6 space-y-6">
      <PageHeader title={`รายละเอียดงาน: ${job.job_no}`} pageKey={`job-${job.job_no}`} actions={actions} />
      
      <div className="bg-card rounded-2xl p-6 shadow-card border border-soft">
        <div className="flex justify-between mb-4">
          <h2 className="font-semibold text-lg">ข้อมูลลูกค้า</h2>
          <Button variant="secondary" size="sm">แก้ไข</Button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-text-secondary mr-2">ชื่อลูกค้า:</span>
            <span>{typeof job.customer === 'string' ? job.customer : job.customer?.name}</span>
          </div>
          <div>
            <span className="text-text-secondary mr-2">เบอร์โทร:</span>
            <span>{typeof job.customer === 'string' ? '-' : job.customer?.phone}</span>
          </div>
          <div>
            <span className="text-text-secondary mr-2">ประเภท:</span>
            <span>{job.project_type}</span>
          </div>
          <div>
            <span className="text-text-secondary mr-2">บริการ:</span>
            <span>{job.services?.join(', ')}</span>
          </div>
          <div>
            <span className="text-text-secondary mr-2">วันนัด:</span>
            <span>{formatDMY(job.plan_date)}</span>
          </div>
          <div className="flex items-center">
            <span className="text-text-secondary mr-2">สถานะ:</span>
            <StatusBadge status={(job.status === 'QC_PENDING' ? 'PENDING' : job.status) as any} />
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-[500px]">
        <JobDetailTabs job={job} />
      </div>
    </div>
  );
}
