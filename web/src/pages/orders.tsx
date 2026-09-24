import * as React from 'react';
import { useJobs, Job } from '@/features/jobs/api';
import { PageHeader } from '@/components/ui/page-header';
import { MasterDetailLayout } from '@/components/ui/master-detail-layout';
import { DataGrid, ColumnDef } from '@/components/ui/data-grid';
import { JobDetailTabs } from '@/features/jobs/job-detail-tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { formatDMY } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { useNavigate, useParams } from 'react-router-dom';

export default function OrdersPage() {
  const navigate = useNavigate();
  const { jobNo } = useParams<{ jobNo?: string }>();
  
  const { data, isLoading } = useJobs({ page: 1, limit: 50 });
  const jobs: Job[] = data?.data || [];

  const selectedJob = React.useMemo(() => {
    return jobs.find(j => j.job_no === jobNo) || null;
  }, [jobs, jobNo]);

  const handleRowClick = (row: Job) => {
    navigate(`/orders/${row.job_no}`);
  };

  const columns: ColumnDef<Job>[] = [
    { id: 'job_no', header: 'รหัสงาน', accessorKey: 'job_no', width: 120 },
    { id: 'customer_name', header: 'ลูกค้า', cell: ({ row }) => typeof row.customer === 'string' ? row.customer : row.customer?.name },
    { id: 'customer_phone', header: 'เบอร์โทร', width: 120, cell: ({ row }) => typeof row.customer === 'string' ? '-' : row.customer?.phone },
    { id: 'services', header: 'บริการ', width: 150, cell: ({ row }) => row.services?.join(', ') || '-' },
    { id: 'project_type', header: 'ประเภท', accessorKey: 'project_type', width: 120 },
    { id: 'plan_date', header: 'วันนัด', width: 120, cell: ({ row }) => formatDMY(row.plan_date) },
    { id: 'status', header: 'สถานะ', width: 120, cell: ({ row }) => <StatusBadge status={row.status === 'QC_PENDING' ? 'PENDING' : row.status} /> },
    { id: 'grand_total', header: 'ยอดสุทธิ์', width: 120, cell: ({ row }) => row.grand_total?.toLocaleString('th-TH') || '0' },
    { id: 'assigned_tech', header: 'ช่าง', accessorKey: 'assigned_tech', width: 120 },
  ];

  const actions = (
    <div className="flex gap-2">
      <Button variant="secondary">ส่งออก</Button>
      <Button variant="primary">+ สร้างงาน</Button>
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-subtle p-6 overflow-hidden">
      <PageHeader title="รับงาน & คิวงาน" pageKey="orders" actions={actions} />
      
      <div className="flex-1 min-h-0 mt-4">
        <MasterDetailLayout
          pageKey="orders"
          masterContent={
            <DataGrid
              columns={columns}
              data={jobs}
              isLoading={isLoading}
              getRowId={(row) => String(row.id)}
              onRowSelect={handleRowClick}
              selectedRowId={selectedJob ? String(selectedJob.id) : undefined}
            />
          }
          detailContent={
            selectedJob ? (
              <JobDetailTabs 
                job={selectedJob} 
                onClose={() => navigate('/orders')} 
              />
            ) : (
              <div className="flex h-full items-center justify-center text-text-secondary bg-card border border-soft rounded-xl shadow-card">
                เลือกรายการเพื่อดูรายละเอียด
              </div>
            )
          }
        />
      </div>
    </div>
  );
}
