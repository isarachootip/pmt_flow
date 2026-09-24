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
  const jobs: Job[] = Array.isArray(data) ? data : (data?.data || []);

  const selectedJob = React.useMemo(() => {
    return jobs.find(j => j.job_no === jobNo) || null;
  }, [jobs, jobNo]);

  const handleRowClick = (row: Job) => {
    navigate(`/orders/${row.job_no}`);
  };

  const columns: ColumnDef<Job>[] = [
    { id: 'job_no', header: 'รหัสงาน', accessorKey: 'job_no', width: 120 },
    { id: 'customer_name', header: 'ลูกค้า', cell: ({ row }) => typeof row.customer === 'string' ? row.customer : (row.customer?.name || (row as any).customer_name || '-') },
    { id: 'customer_phone', header: 'เบอร์โทร', width: 120, cell: ({ row }) => typeof row.customer === 'string' ? '-' : (row.customer?.phone || (row as any).customer_phone || '-') },
    { id: 'services', header: 'บริการ', width: 150, cell: ({ row }) => Array.isArray(row.services) ? row.services.join(', ') : (row.services || (row as any).project_sub_type || '-') },
    { id: 'project_type', header: 'ประเภท', accessorKey: 'project_type', width: 120, cell: ({ row }) => row.project_type || (row as any).job_type || '-' },
    { id: 'plan_date', header: 'วันนัด', width: 120, cell: ({ row }) => formatDMY(row.plan_date || (row as any).created_at) },
    { id: 'status', header: 'สถานะ', width: 120, cell: ({ row }) => <StatusBadge status={row.status === 'QC_PENDING' ? 'PENDING' : row.status} /> },
    { id: 'grand_total', header: 'ยอดสุทธิ', width: 120, cell: ({ row }) => {
      const amt = Number(row.grand_total || (row as any).boq_grand_total || 0);
      return amt > 0 ? amt.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '-';
    }},
    { id: 'assigned_tech', header: 'ช่าง', accessorKey: 'assigned_tech', width: 120, cell: ({ row }) => row.assigned_tech || '-' },
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
